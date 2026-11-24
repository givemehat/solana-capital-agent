import { CapitalActionTrigger } from "../types/index.js";

export function createAutoSweepTrigger(options: {
  id?: string;
  name?: string;
  tokenMint?: string;
  /** Trigger threshold: if balance exceeds this, sweep */
  thresholdRaw: bigint;
  /** Keep this much operational balance in the agent wallet */
  targetReserveRaw: bigint;
  destinationVault: string;
  hops?: number;
}): CapitalActionTrigger {
  const NATIVE_SOL = "So11111111111111111111111111111111111111112";

  return {
    id: options.id ?? "trigger_auto_sweep_" + Math.random().toString(36).substring(2, 7),
    name: options.name ?? "Surplus Treasury Auto-Sweep",
    type: "SWEEP_SURPLUS",
    tokenMint: options.tokenMint ?? NATIVE_SOL,
    thresholdRaw: options.thresholdRaw,
    targetReserveRaw: options.targetReserveRaw,
    destinationAddress: options.destinationVault,
    multiHopperHops: options.hops ?? 7,
    enabled: true,
  };
}
