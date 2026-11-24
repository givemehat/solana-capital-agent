import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutonomousCapitalAgent } from "../core/agent.js";
import { AgentWalletManager } from "../core/wallet.js";
import { GuardrailEngine } from "../core/guardrails.js";
import { MultiHopperClient } from "../multihopper/client.js";
import { CapitalActionTrigger } from "../types/index.js";

describe("AutonomousCapitalAgent", () => {
  let wallet: AgentWalletManager;
  let guardrails: GuardrailEngine;
  let multiHopper: MultiHopperClient;
  let agent: AutonomousCapitalAgent;

  beforeEach(() => {
    wallet = new AgentWalletManager({});
    guardrails = new GuardrailEngine({
      maxPerTxAmount: 2_000_000_000n, // 2 SOL
      dailyBudgetLimit: 10_000_000_000n, // 10 SOL
      allowedTokenMints: [
        "So11111111111111111111111111111111111111112",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      ],
      allowedRecipients: ["TreasuryVault11111111111111111111111111111"],
      maxFeeBps: 100,
      isPaused: false,
    });
    multiHopper = new MultiHopperClient({ isMock: true });
    agent = new AutonomousCapitalAgent({ wallet, guardrails, multiHopper });
  });

  it("should not execute action if wallet balance is below threshold", async () => {
    vi.spyOn(wallet, "getSolBalance").mockResolvedValue({
      lamports: 1_500_000_000n, // 1.5 SOL
      sol: 1.5,
    });

    const trigger: CapitalActionTrigger = {
      id: "trig-1",
      name: "Sweep Surplus Treasury",
      type: "SWEEP_SURPLUS",
      tokenMint: "So11111111111111111111111111111111111111112",
      thresholdRaw: 2_000_000_000n, // 2.0 SOL threshold
      targetReserveRaw: 1_000_000_000n, // 1.0 SOL reserve
      destinationAddress: "TreasuryVault11111111111111111111111111111",
      multiHopperHops: 3,
      enabled: true,
    };

    agent.addTrigger(trigger);
    const logs = await agent.runEvaluationCycle();

    expect(logs.length).toBe(0);
    expect(agent.getExecutionHistory().length).toBe(0);
  });

  it("should trigger surplus sweep when balance exceeds threshold and guardrails pass", async () => {
    vi.spyOn(wallet, "getSolBalance").mockResolvedValue({
      lamports: 2_500_000_000n, // 2.5 SOL
      sol: 2.5,
    });

    const trigger: CapitalActionTrigger = {
      id: "trig-2",
      name: "Auto-Sweep to Cold Treasury",
      type: "SWEEP_SURPLUS",
      tokenMint: "So11111111111111111111111111111111111111112",
      thresholdRaw: 2_000_000_000n, // 2.0 SOL
      targetReserveRaw: 1_000_000_000n, // 1.0 SOL reserve -> surplus is 1.5 SOL
      destinationAddress: "TreasuryVault11111111111111111111111111111",
      multiHopperHops: 5,
      enabled: true,
    };

    agent.addTrigger(trigger);
    const logs = await agent.runEvaluationCycle();

    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.status).toBe("SUCCESS");
    expect(log.amountRaw).toBe(1_500_000_000n);
    expect(log.destination).toBe("TreasuryVault11111111111111111111111111111");
    expect(log.multiHopperTransferId).toBeDefined();
    expect(log.txSignatures?.length).toBeGreaterThan(0);

    // Guardrail rolling spend should have recorded 1.5 SOL
    expect(guardrails.getRolling24hSpend()).toBe(1_500_000_000n);
  });

  it("should reject action and log REJECTED_GUARDRAIL if recipient is unauthorized", async () => {
    vi.spyOn(wallet, "getSolBalance").mockResolvedValue({
      lamports: 3_000_000_000n,
      sol: 3.0,
    });

    const unauthorizedTrigger: CapitalActionTrigger = {
      id: "trig-scam",
      name: "Unauthorized Route",
      type: "SWEEP_SURPLUS",
      tokenMint: "So11111111111111111111111111111111111111112",
      thresholdRaw: 2_000_000_000n,
      targetReserveRaw: 1_000_000_000n,
      destinationAddress: "HackerWallet1111111111111111111111111111111",
      multiHopperHops: 3,
      enabled: true,
    };

    agent.addTrigger(unauthorizedTrigger);
    const logs = await agent.runEvaluationCycle();

    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("REJECTED_GUARDRAIL");
    expect(logs[0].reason).toContain("not in approved allowlist");
  });

  it("should halt execution cycles immediately if circuit breaker is paused", async () => {
    vi.spyOn(wallet, "getSolBalance").mockResolvedValue({
      lamports: 5_000_000_000n,
      sol: 5.0,
    });

    agent.guardrails.pause();

    const trigger: CapitalActionTrigger = {
      id: "trig-paused",
      name: "Should Not Run",
      type: "SWEEP_SURPLUS",
      tokenMint: "So11111111111111111111111111111111111111112",
      thresholdRaw: 2_000_000_000n,
      targetReserveRaw: 1_000_000_000n,
      destinationAddress: "TreasuryVault11111111111111111111111111111",
      multiHopperHops: 3,
      enabled: true,
    };

    agent.addTrigger(trigger);
    const logs = await agent.runEvaluationCycle();

    expect(logs.length).toBe(0);
  });
});
