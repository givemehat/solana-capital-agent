import { describe, it, expect, beforeEach } from "vitest";
import { MultiHopperClient } from "../multihopper/client.js";

describe("MultiHopperClient (Mock & Integration)", () => {
  let client: MultiHopperClient;

  beforeEach(() => {
    client = new MultiHopperClient({ isMock: true });
  });

  it("should calculate fee estimation with correct tier and lamports per hop", async () => {
    const estimate = await client.estimateFee({
      tokenMint: "So11111111111111111111111111111111111111112",
      amountRaw: "1000000000",
      tokenDecimals: 9,
      hops: 5,
    });

    expect(estimate.tier).toBe("standard");
    expect(estimate.percentFeeBps).toBe(50); // 0.5%
    expect(estimate.totalFlatFeeLamports).toBe(30000); // 5 hops * 6000 lamports
    expect(estimate.usdEquivalent).toBeGreaterThan(0);
  });

  it("should create a multi-hop transfer quote in awaiting_signature state", async () => {
    const quote = await client.createTransfer({
      tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amountRaw: "50000000", // 50 USDC
      amountTokens: "50.0",
      tokenDecimals: 6,
      tokenSymbol: "USDC",
      sourceOwner: "SourceWallet111111111111111111111111111111111",
      recipientWallet: "DestWallet1111111111111111111111111111111111",
      hops: 4,
    });

    expect(quote.id).toBeDefined();
    expect(quote.status).toBe("awaiting_signature");
    expect(quote.hops).toBe(4);
    expect(quote.recipientWallet).toBe("DestWallet1111111111111111111111111111111111");
  });

  it("should prepare transaction bundles with route, orchestrator, and keeper funding txs", async () => {
    const quote = await client.createTransfer({
      tokenMint: "So11111111111111111111111111111111111111112",
      amountRaw: "1000000000",
      amountTokens: "1.0",
      tokenDecimals: 9,
      tokenSymbol: "SOL",
      sourceOwner: "SourceWallet111111111111111111111111111111111",
      recipientWallet: "DestWallet1111111111111111111111111111111111",
      hops: 3,
    });

    const prepared = await client.prepareTransfer(quote.id);

    expect(prepared.preparedTxs).toBeDefined();
    expect(prepared.preparedTxs.keeperFundingTx).toBeDefined();
    expect(prepared.preparedTxs.orchestratorInitTx).toBeDefined();
    expect(prepared.preparedTxs.routeInitTxs.length).toBeGreaterThan(0);
    expect(prepared.preparedTxs.recentBlockhash).toBeDefined();
  });

  it("should confirm broadcast and advance status", async () => {
    const quote = await client.createTransfer({
      tokenMint: "So11111111111111111111111111111111111111112",
      amountRaw: "1000000000",
      amountTokens: "1.0",
      tokenDecimals: 9,
      tokenSymbol: "SOL",
      sourceOwner: "SourceWallet111111111111111111111111111111111",
      recipientWallet: "DestWallet1111111111111111111111111111111111",
      hops: 3,
    });

    const res = await client.confirmBroadcast(quote.id, {
      keeperFundingSignature: "mock_sig_keeper",
      orchestratorInitSignature: "mock_sig_orch",
      routeInitSignatures: ["mock_sig_route_1"],
      sessionInitSignatures: ["mock_sig_session_1"],
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("processing");

    const status = await client.getTransferStatus(quote.id);
    expect(status.status).toBe("completed");
  });
});
