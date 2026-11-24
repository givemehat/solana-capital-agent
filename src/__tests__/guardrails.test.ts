import { describe, it, expect, beforeEach } from "vitest";
import { GuardrailEngine } from "../core/guardrails.js";
import { GuardrailConfig } from "../types/index.js";

describe("GuardrailEngine", () => {
  let defaultConfig: GuardrailConfig;
  let engine: GuardrailEngine;

  beforeEach(() => {
    defaultConfig = {
      maxPerTxAmount: 1_000_000_000n, // 1 SOL (1e9 lamports)
      dailyBudgetLimit: 5_000_000_000n, // 5 SOL
      allowedTokenMints: [
        "So11111111111111111111111111111111111111112", // Native SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      ],
      allowedRecipients: ["Dest1111111111111111111111111111111111111111"],
      maxFeeBps: 100, // 1%
      isPaused: false,
    };
    engine = new GuardrailEngine(defaultConfig);
  });

  it("should approve valid transaction within all limits", () => {
    const result = engine.validateAction({
      tokenMint: "So11111111111111111111111111111111111111112",
      recipientAddress: "Dest1111111111111111111111111111111111111111",
      amountRaw: 500_000_000n,
      estimatedFeeBps: 50,
    });

    expect(result.approved).toBe(true);
    expect(result.remainingDailyBudget).toBe(4_500_000_000n);
  });

  it("should reject when emergency pause / circuit breaker is active", () => {
    engine.pause();
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 100_000_000n,
      })
    ).toThrow(/circuit breaker is active/i);

    engine.resume();
    expect(
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 100_000_000n,
      }).approved
    ).toBe(true);
  });

  it("should reject non-positive amounts", () => {
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 0n,
      })
    ).toThrow(/strictly greater than 0/i);

    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: -100n,
      })
    ).toThrow(/strictly greater than 0/i);
  });

  it("should enforce token allowlist", () => {
    expect(() =>
      engine.validateAction({
        tokenMint: "RandomScamToken1111111111111111111111111111111",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 100_000_000n,
      })
    ).toThrow(/not permitted by allowlist/i);
  });

  it("should enforce recipient allowlist when configured", () => {
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "UnauthorizedRecipientAddress111111111111111",
        amountRaw: 100_000_000n,
      })
    ).toThrow(/not in approved allowlist/i);
  });

  it("should enforce max per-transaction amount limit", () => {
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 1_000_000_001n, // 1 lamport over limit
      })
    ).toThrow(/exceeds maximum single-tx limit/i);
  });

  it("should enforce max fee bps cap", () => {
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 500_000_000n,
        estimatedFeeBps: 150, // 1.5% > 1.0% limit
      })
    ).toThrow(/exceeds max allowed fee cap/i);
  });

  it("should enforce 24h rolling budget window and prune expired records", () => {
    const baseTime = 1_700_000_000_000;

    // First spend: 3 SOL at T=0
    engine.recordSpend(3_000_000_000n, baseTime);
    expect(engine.getRolling24hSpend(baseTime)).toBe(3_000_000_000n);

    // Second spend request: 2.5 SOL at T + 1 hour -> should exceed 5 SOL budget (3 + 2.5 = 5.5 SOL)
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 1_000_000_000n, // within tx limit, but 3 + 1 = 4 is fine
        nowMs: baseTime + 3600_000,
      })
    ).not.toThrow();

    // Now record that 1.5 SOL spend
    engine.recordSpend(1_500_000_000n, baseTime + 3600_000);
    // Total spent is now 4.5 SOL. Only 0.5 SOL remaining.
    expect(() =>
      engine.validateAction({
        tokenMint: "So11111111111111111111111111111111111111112",
        recipientAddress: "Dest1111111111111111111111111111111111111111",
        amountRaw: 800_000_000n, // 0.8 SOL exceeds remaining 0.5 SOL
        nowMs: baseTime + 7200_000,
      })
    ).toThrow(/exceed 24h rolling budget limit/i);

    // After 25 hours from baseTime, the first 3 SOL spend expires
    const after25Hours = baseTime + 25 * 3600_000;
    expect(engine.getRolling24hSpend(after25Hours)).toBe(1_500_000_000n);

    // Now 1 SOL spend is approved because remaining budget is 3.5 SOL
    const result = engine.validateAction({
      tokenMint: "So11111111111111111111111111111111111111112",
      recipientAddress: "Dest1111111111111111111111111111111111111111",
      amountRaw: 1_000_000_000n,
      nowMs: after25Hours,
    });
    expect(result.approved).toBe(true);
    expect(result.remainingDailyBudget).toBe(2_500_000_000n);
  });
});
