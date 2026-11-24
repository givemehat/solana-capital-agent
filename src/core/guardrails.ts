import { GuardrailConfig } from "../types/index.js";

export interface SpendRecord {
  amountRaw: bigint;
  timestampMs: number;
}

export class GuardrailEngine {
  private config: GuardrailConfig;
  private spendHistory: SpendRecord[] = [];

  constructor(config: GuardrailConfig) {
    this.config = { ...config };
  }

  public getConfig(): Readonly<GuardrailConfig> {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public pause(): void {
    this.config.isPaused = true;
  }

  public resume(): void {
    this.config.isPaused = false;
  }

  /**
   * Computes total spend in the rolling 24-hour window.
   */
  public getRolling24hSpend(nowMs: number = Date.now()): bigint {
    const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
    // Evict old records
    this.spendHistory = this.spendHistory.filter((r) => r.timestampMs >= oneDayAgo);
    return this.spendHistory.reduce((sum, r) => sum + r.amountRaw, 0n);
  }

  /**
   * Evaluates whether a proposed capital transfer passes all guardrails.
   * Throws a descriptive Error if any rule is violated.
   */
  public validateAction(params: {
    tokenMint: string;
    recipientAddress: string;
    amountRaw: bigint;
    estimatedFeeBps?: number;
    nowMs?: number;
  }): { approved: boolean; remainingDailyBudget: bigint } {
    const nowMs = params.nowMs ?? Date.now();

    // 1. Circuit breaker check
    if (this.config.isPaused) {
      throw new Error("Guardrail Violation: Emergency circuit breaker is active (Agent is paused).");
    }

    // 2. Amount must be positive
    if (params.amountRaw <= 0n) {
      throw new Error("Guardrail Violation: Transfer amount must be strictly greater than 0.");
    }

    // 3. Token allowlist
    if (
      this.config.allowedTokenMints.length > 0 &&
      !this.config.allowedTokenMints.includes(params.tokenMint)
    ) {
      throw new Error(
        `Guardrail Violation: Token mint ${params.tokenMint} is not permitted by allowlist.`
      );
    }

    // 4. Recipient allowlist (if configured)
    if (
      this.config.allowedRecipients &&
      this.config.allowedRecipients.length > 0 &&
      !this.config.allowedRecipients.includes(params.recipientAddress)
    ) {
      throw new Error(
        `Guardrail Violation: Recipient ${params.recipientAddress} is not in approved allowlist.`
      );
    }

    // 5. Per-transaction limit
    if (params.amountRaw > this.config.maxPerTxAmount) {
      throw new Error(
        `Guardrail Violation: Requested amount ${params.amountRaw} exceeds maximum single-tx limit of ${this.config.maxPerTxAmount}.`
      );
    }

    // 6. Fee boundary limit
    if (
      params.estimatedFeeBps !== undefined &&
      params.estimatedFeeBps > this.config.maxFeeBps
    ) {
      throw new Error(
        `Guardrail Violation: Estimated fee ${params.estimatedFeeBps} bps exceeds max allowed fee cap of ${this.config.maxFeeBps} bps.`
      );
    }

    // 7. Daily budget limit
    const currentSpent = this.getRolling24hSpend(nowMs);
    const projectedSpend = currentSpent + params.amountRaw;
    if (projectedSpend > this.config.dailyBudgetLimit) {
      const remaining = this.config.dailyBudgetLimit > currentSpent
        ? this.config.dailyBudgetLimit - currentSpent
        : 0n;
      throw new Error(
        `Guardrail Violation: Requested amount ${params.amountRaw} would exceed 24h rolling budget limit. Remaining budget: ${remaining}.`
      );
    }

    const remainingDailyBudget = this.config.dailyBudgetLimit - projectedSpend;
    return { approved: true, remainingDailyBudget };
  }

  /**
   * Records a confirmed spend into the rolling window.
   */
  public recordSpend(amountRaw: bigint, timestampMs: number = Date.now()): void {
    this.spendHistory.push({ amountRaw, timestampMs });
  }

  public clearHistory(): void {
    this.spendHistory = [];
  }
}
