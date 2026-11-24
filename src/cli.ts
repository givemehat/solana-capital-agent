import { Keypair } from "@solana/web3.js";
import fs from "fs";
import { AgentWalletManager } from "./core/wallet.js";
import { GuardrailEngine } from "./core/guardrails.js";
import { AutonomousCapitalAgent } from "./core/agent.js";
import { MultiHopperClient } from "./multihopper/client.js";
import { createAutoSweepTrigger } from "./strategies/autoSweep.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  // Load wallet from saved credentials if available
  const credsPath = "/Users/rajnishsingh/.gemini/antigravity/scratch/solana_wallet_credentials.json";
  let walletMgr: AgentWalletManager;

  if (fs.existsSync(credsPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    walletMgr = new AgentWalletManager({
      secretKeyBase58: creds.secretKeyBase58,
      network: "devnet",
    });
  } else {
    const kp = Keypair.generate();
    walletMgr = new AgentWalletManager({ keypair: kp, network: "devnet" });
  }

  // Configure OOBE Steve Capital Risk Guardrails
  const guardrails = new GuardrailEngine({
    maxPerTxAmount: 5_000_000_000n, // 5 SOL max per single transaction
    dailyBudgetLimit: 20_000_000_000n, // 20 SOL max daily budget
    allowedTokenMints: [
      "So11111111111111111111111111111111111111112", // Native SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC Mainnet
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC Devnet
    ],
    maxFeeBps: 100, // 1% max fee cap
    isPaused: false,
  });

  const multiHopper = new MultiHopperClient({ isMock: true });

  const agent = new AutonomousCapitalAgent({
    wallet: walletMgr,
    guardrails,
    multiHopper,
  });

  // Attach a Treasury Auto-Sweep strategy
  const treasuryVault = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  agent.addTrigger(
    createAutoSweepTrigger({
      name: "Automated Treasury Surplus Sweep (7 Hops)",
      thresholdRaw: 10_000_000_000n, // 10 SOL threshold
      targetReserveRaw: 2_000_000_000n, // Keep 2 SOL operational balance
      destinationVault: treasuryVault,
      hops: 7,
    })
  );

  console.log("==================================================================");
  console.log("⚡ Solana Autonomous Capital Agent | Powered by MultiHopper & OOBE");
  console.log("==================================================================");
  console.log(`Agent Public Address: ${walletMgr.getAddress()}`);
  console.log(`Network:              ${walletMgr.network}`);
  console.log(`Guardrails Status:    ${guardrails.getConfig().isPaused ? "PAUSED" : "ACTIVE & ENFORCED"}`);
  console.log(`Max Per-Tx Limit:     ${Number(guardrails.getConfig().maxPerTxAmount) / 1e9} SOL`);
  console.log(`Daily Budget Cap:     ${Number(guardrails.getConfig().dailyBudgetLimit) / 1e9} SOL`);
  console.log(`Configured Triggers:  ${agent.getTriggers().length}`);
  console.log("==================================================================\n");

  if (command === "simulate") {
    console.log("Running simulation with simulated 4 SOL surplus transfer...");
    // Mock simulation within 5 SOL maxPerTxAmount
    const result = await agent.executeSurplusTransfer({
      trigger: agent.getTriggers()[0],
      amountRaw: 4_000_000_000n, // 4 SOL surplus (within 5 SOL limit)
      tokenDecimals: 9,
      tokenSymbol: "SOL",
    });
    const jsonSafe = (obj: any) =>
      JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

    console.log("Execution Result:", jsonSafe(result));
    console.log("\nRemaining 24h Rolling Budget:", guardrails.getRolling24hSpend().toString(), "lamports spent");
  } else {
    console.log("Agent ready. Run 'npm run agent:simulate' to test full MultiHopper execution.");
  }
}

main().catch(console.error);
