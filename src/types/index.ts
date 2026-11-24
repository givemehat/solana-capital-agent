export type Network = "mainnet-beta" | "devnet" | "testnet";

export interface GuardrailConfig {
  /** Maximum amount in base units (lamports/micro-USDC) per single transaction */
  maxPerTxAmount: bigint;
  /** Maximum total expenditure allowed per 24-hour rolling window */
  dailyBudgetLimit: bigint;
  /** Allowed token mint addresses (e.g., native SOL, USDC) */
  allowedTokenMints: string[];
  /** Allowed destination recipient addresses (optional whitelist) */
  allowedRecipients?: string[];
  /** Maximum allowable fee in basis points (1 bps = 0.01%) */
  maxFeeBps: number;
  /** Emergency pause switch */
  isPaused: boolean;
}

export interface MultiHopperEstimateRequest {
  tokenMint: string;
  amountRaw: string;
  tokenDecimals: number;
  hops: number;
}

export interface MultiHopperEstimateResponse {
  tier: string;
  percentFeeBps: number;
  totalFlatFeeLamports: number;
  usdEquivalent: number;
}

export interface MultiHopperCreateTransferRequest {
  tokenMint: string;
  amountRaw: string;
  amountTokens: string;
  tokenDecimals: number;
  tokenSymbol: string;
  sourceOwner: string;
  recipientWallet: string;
  hops: number;
  arrivalSeconds?: number;
  externalId?: string;
}

export interface MultiHopperTransferQuote {
  id: string | number;
  status: "awaiting_signature" | "processing" | "completed" | "failed";
  tokenMint: string;
  amountRaw: string;
  sourceOwner: string;
  recipientWallet: string;
  hops: number;
  percentFeeBps: number;
  totalFeeLamports: number;
  createdAt: string;
}

export interface MultiHopperPrepareResponse {
  transfer: Record<string, unknown>;
  preparedTxs: {
    routeInitTxs: Array<{ base64: string }>;
    orchestratorInitTx: string;
    sessionInitTxs: string[];
    keeperFundingTx: string;
    recentBlockhash: string;
    lastValidBlockHeight: number;
  };
}

export interface MultiHopperConfirmBroadcastRequest {
  routeInitSignatures: string[];
  orchestratorInitSignature: string;
  sessionInitSignatures: string[];
  keeperFundingSignature: string;
}

export interface CapitalActionTrigger {
  id: string;
  name: string;
  type: "SWEEP_SURPLUS" | "REBALANCE" | "STREAM_PAYOUT";
  tokenMint: string;
  /** Balance threshold that activates the action */
  thresholdRaw: bigint;
  /** Amount to keep as active operational reserve */
  targetReserveRaw: bigint;
  /** Destination for surplus capital */
  destinationAddress: string;
  /** Number of privacy hops to execute via MultiHopper */
  multiHopperHops: number;
  enabled: boolean;
}

export interface ExecutionLog {
  actionId: string;
  triggerName: string;
  amountRaw: bigint;
  tokenMint: string;
  multiHopperTransferId?: string | number;
  destination: string;
  status: "SUCCESS" | "REJECTED_GUARDRAIL" | "FAILED";
  reason?: string;
  txSignatures?: string[];
  timestamp: string;
}
