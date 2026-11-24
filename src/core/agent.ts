import { AgentWalletManager } from "./wallet.js";
import { GuardrailEngine } from "./guardrails.js";
import { MultiHopperClient } from "../multihopper/client.js";
import {
  CapitalActionTrigger,
  ExecutionLog,
  GuardrailConfig,
} from "../types/index.js";

export interface AgentOptions {
  wallet: AgentWalletManager;
  guardrails: GuardrailEngine | GuardrailConfig;
  multiHopper?: MultiHopperClient;
  triggers?: CapitalActionTrigger[];
}

export class AutonomousCapitalAgent {
  public readonly wallet: AgentWalletManager;
  public readonly guardrails: GuardrailEngine;
  public readonly multiHopper: MultiHopperClient;
  private triggers: CapitalActionTrigger[] = [];
  private executionHistory: ExecutionLog[] = [];

  constructor(options: AgentOptions) {
    this.wallet = options.wallet;
    this.guardrails =
      options.guardrails instanceof GuardrailEngine
        ? options.guardrails
        : new GuardrailEngine(options.guardrails);
    this.multiHopper = options.multiHopper ?? new MultiHopperClient();
    this.triggers = options.triggers ?? [];
  }

  public addTrigger(trigger: CapitalActionTrigger): void {
    this.triggers.push(trigger);
  }

  public getTriggers(): ReadonlyArray<CapitalActionTrigger> {
    return this.triggers;
  }

  public getExecutionHistory(): ReadonlyArray<ExecutionLog> {
    return this.executionHistory;
  }

  /**
   * Evaluates all triggers against current wallet balances.
   * If any threshold is breached, executes an automated multi-hop transfer
   * while enforcing all guardrails.
   */
  public async runEvaluationCycle(): Promise<ExecutionLog[]> {
    const cycleLogs: ExecutionLog[] = [];

    // Check circuit breaker first
    if (this.guardrails.getConfig().isPaused) {
      return cycleLogs;
    }

    const solBalance = await this.wallet.getSolBalance();

    for (const trigger of this.triggers) {
      if (!trigger.enabled) continue;

      let currentBalanceRaw = 0n;
      let decimals = 9;
      let symbol = "SOL";

      const NATIVE_SOL = "So11111111111111111111111111111111111111112";

      if (trigger.tokenMint === NATIVE_SOL || trigger.tokenMint === "SOL") {
        currentBalanceRaw = solBalance.lamports;
        decimals = 9;
        symbol = "SOL";
      } else {
        const tokenBal = await this.wallet.getTokenBalance(trigger.tokenMint);
        currentBalanceRaw = tokenBal.raw;
        decimals = 6; // Standard USDC decimals
        symbol = "USDC";
      }

      // Check if threshold is breached
      if (currentBalanceRaw > trigger.thresholdRaw) {
        const surplusAmount = currentBalanceRaw - trigger.targetReserveRaw;
        if (surplusAmount <= 0n) continue;

        const log = await this.executeSurplusTransfer({
          trigger,
          amountRaw: surplusAmount,
          tokenDecimals: decimals,
          tokenSymbol: symbol,
        });

        cycleLogs.push(log);
        this.executionHistory.push(log);
      }
    }

    return cycleLogs;
  }

  /**
   * Executes a multi-hop transfer via MultiHopper through the guardrail engine.
   */
  public async executeSurplusTransfer(params: {
    trigger: CapitalActionTrigger;
    amountRaw: bigint;
    tokenDecimals: number;
    tokenSymbol: string;
  }): Promise<ExecutionLog> {
    const { trigger, amountRaw, tokenDecimals, tokenSymbol } = params;

    // 1. Guardrail pre-validation
    try {
      this.guardrails.validateAction({
        tokenMint: trigger.tokenMint,
        recipientAddress: trigger.destinationAddress,
        amountRaw,
      });
    } catch (err) {
      return {
        actionId: "act_" + Math.random().toString(36).substring(2, 9),
        triggerName: trigger.name,
        amountRaw,
        tokenMint: trigger.tokenMint,
        destination: trigger.destinationAddress,
        status: "REJECTED_GUARDRAIL",
        reason: (err as Error).message,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. MultiHopper Quote & Fee Estimation
    try {
      const estimate = await this.multiHopper.estimateFee({
        tokenMint: trigger.tokenMint,
        amountRaw: amountRaw.toString(),
        tokenDecimals,
        hops: trigger.multiHopperHops,
      });

      // Post-estimate guardrail fee check
      this.guardrails.validateAction({
        tokenMint: trigger.tokenMint,
        recipientAddress: trigger.destinationAddress,
        amountRaw,
        estimatedFeeBps: estimate.percentFeeBps,
      });

      const quote = await this.multiHopper.createTransfer({
        tokenMint: trigger.tokenMint,
        amountRaw: amountRaw.toString(),
        amountTokens: (Number(amountRaw) / 10 ** tokenDecimals).toString(),
        tokenDecimals,
        tokenSymbol,
        sourceOwner: this.wallet.getAddress(),
        recipientWallet: trigger.destinationAddress,
        hops: trigger.multiHopperHops,
        externalId: `cap_sweep_${Date.now()}`,
      });

      // 3. Prepare serialized transaction bundles
      const prepared = await this.multiHopper.prepareTransfer(quote.id);

      // 4. Sign transactions with Agent Keypair
      const keeperFundingSig = this.wallet.signSerializedTx(
        prepared.preparedTxs.keeperFundingTx
      );
      const orchestratorInitSig = this.wallet.signSerializedTx(
        prepared.preparedTxs.orchestratorInitTx
      );
      const routeInitSigs = prepared.preparedTxs.routeInitTxs.map((tx) =>
        this.wallet.signSerializedTx(tx.base64)
      );
      const sessionInitSigs = prepared.preparedTxs.sessionInitTxs.map((tx) =>
        this.wallet.signSerializedTx(tx)
      );

      // 5. Confirm broadcast with MultiHopper
      await this.multiHopper.confirmBroadcast(quote.id, {
        keeperFundingSignature: keeperFundingSig,
        orchestratorInitSignature: orchestratorInitSig,
        routeInitSignatures: routeInitSigs,
        sessionInitSignatures: sessionInitSigs,
      });

      // Record successful spend in guardrails rolling window
      this.guardrails.recordSpend(amountRaw);

      return {
        actionId: "act_" + Math.random().toString(36).substring(2, 9),
        triggerName: trigger.name,
        amountRaw,
        tokenMint: trigger.tokenMint,
        multiHopperTransferId: quote.id,
        destination: trigger.destinationAddress,
        status: "SUCCESS",
        txSignatures: [keeperFundingSig, orchestratorInitSig],
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        actionId: "act_" + Math.random().toString(36).substring(2, 9),
        triggerName: trigger.name,
        amountRaw,
        tokenMint: trigger.tokenMint,
        destination: trigger.destinationAddress,
        status: "FAILED",
        reason: (err as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
