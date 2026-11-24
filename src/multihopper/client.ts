import {
  MultiHopperEstimateRequest,
  MultiHopperEstimateResponse,
  MultiHopperCreateTransferRequest,
  MultiHopperTransferQuote,
  MultiHopperPrepareResponse,
  MultiHopperConfirmBroadcastRequest,
} from "../types/index.js";

export interface MultiHopperClientConfig {
  apiKey?: string;
  baseUrl?: string;
  isMock?: boolean;
}

export class MultiHopperClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isMock: boolean;
  private mockTransferStore = new Map<string | number, MultiHopperTransferQuote>();

  constructor(config: MultiHopperClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.MULTI_HOPPER_API_KEY ?? "mh_test_mock_developer_key";
    this.baseUrl = config.baseUrl ?? (process.env.MULTI_HOPPER_ENV === "production"
      ? "https://multihopper.com"
      : "https://devnet.multihopper.com");
    this.isMock = config.isMock ?? (!process.env.MULTI_HOPPER_API_KEY || process.env.MULTI_HOPPER_MOCK === "true");
  }

  /**
   * Estimates routing fees for a given asset and hop count.
   */
  public async estimateFee(
    request: MultiHopperEstimateRequest
  ): Promise<MultiHopperEstimateResponse> {
    if (this.isMock) {
      // Standard MultiHopper fee schedule: 0.5% (50 bps) base, ~6,000 lamports per hop
      const hops = request.hops || 5;
      const flatFee = 6000 * hops;
      return {
        tier: "standard",
        percentFeeBps: 50,
        totalFlatFeeLamports: flatFee,
        usdEquivalent: Number(request.amountRaw) * 0.000000001 * 180 * 0.005,
      };
    }

    const res = await fetch(`${this.baseUrl}/api/v1/transfers/estimate`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`MultiHopper API estimate error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as MultiHopperEstimateResponse;
  }

  /**
   * Initializes a multi-hop transfer and receives a quote.
   */
  public async createTransfer(
    request: MultiHopperCreateTransferRequest
  ): Promise<MultiHopperTransferQuote> {
    if (this.isMock) {
      const id = "mh_mock_" + Math.random().toString(36).substring(2, 9);
      const quote: MultiHopperTransferQuote = {
        id,
        status: "awaiting_signature",
        tokenMint: request.tokenMint,
        amountRaw: request.amountRaw,
        sourceOwner: request.sourceOwner,
        recipientWallet: request.recipientWallet,
        hops: request.hops,
        percentFeeBps: 50,
        totalFeeLamports: 30000,
        createdAt: new Date().toISOString(),
      };
      this.mockTransferStore.set(id, quote);
      return quote;
    }

    const res = await fetch(`${this.baseUrl}/api/v1/transfers`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`MultiHopper API createTransfer error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as MultiHopperTransferQuote;
  }

  /**
   * Prepares the serialized transaction bundles for signing.
   */
  public async prepareTransfer(transferId: string | number): Promise<MultiHopperPrepareResponse> {
    if (this.isMock) {
      return {
        transfer: { id: transferId, status: "awaiting_signature" },
        preparedTxs: {
          routeInitTxs: [{ base64: Buffer.from("mock_route_init_tx").toString("base64") }],
          orchestratorInitTx: Buffer.from("mock_orchestrator_tx").toString("base64"),
          sessionInitTxs: [Buffer.from("mock_session_tx_1").toString("base64")],
          keeperFundingTx: Buffer.from("mock_keeper_funding_tx").toString("base64"),
          recentBlockhash: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
          lastValidBlockHeight: 300000000,
        },
      };
    }

    const res = await fetch(`${this.baseUrl}/api/v1/transfers/${transferId}/prepare`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`MultiHopper API prepare error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as MultiHopperPrepareResponse;
  }

  /**
   * Confirms broadcast of signed transaction bundles.
   */
  public async confirmBroadcast(
    transferId: string | number,
    signatures: MultiHopperConfirmBroadcastRequest
  ): Promise<{ success: boolean; status: string; transferId: string | number }> {
    if (this.isMock) {
      const quote = this.mockTransferStore.get(transferId);
      if (quote) {
        quote.status = "processing";
      }
      return {
        success: true,
        status: "processing",
        transferId,
      };
    }

    const res = await fetch(`${this.baseUrl}/api/v1/transfers/${transferId}/confirm-broadcast`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signatures),
    });

    if (!res.ok) {
      throw new Error(`MultiHopper API confirmBroadcast error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as { success: boolean; status: string; transferId: string | number };
  }

  /**
   * Queries transfer status on MultiHopper.
   */
  public async getTransferStatus(
    transferId: string | number
  ): Promise<MultiHopperTransferQuote> {
    if (this.isMock) {
      const quote = this.mockTransferStore.get(transferId);
      if (quote) {
        return { ...quote, status: "completed" };
      }
      return {
        id: transferId,
        status: "completed",
        tokenMint: "So11111111111111111111111111111111111111112",
        amountRaw: "1000000000",
        sourceOwner: "mock_source",
        recipientWallet: "mock_dest",
        hops: 5,
        percentFeeBps: 50,
        totalFeeLamports: 30000,
        createdAt: new Date().toISOString(),
      };
    }

    const res = await fetch(`${this.baseUrl}/api/v1/transfers/${transferId}`, {
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`MultiHopper API getTransferStatus error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as MultiHopperTransferQuote;
  }
}
