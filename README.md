# Solana Autonomous Capital Agent & MultiHopper Privacy Routing

An enterprise-grade autonomous capital management agent on Solana featuring **OOBE Protocol (Steve Capital) risk guardrails** and **MultiHopper multi-hop privacy payment routing**.

Built for the **Superteam Earn** bounties:
- 🛡️ **Autonomous Capital Agent on Solana** ($500 USDC / OOBE Protocol)
- 🔀 **MultiHopper Build & Route Challenge** ($5,000 USDC / MultiHopper)

---

## 🌟 Key Features

### 1. OOBE Steve Capital Risk Guardrails
Autonomous capital agents must never have unconstrained signing authority. This agent embeds a non-bypassable, deterministic mathematical guardrail engine:
- **Single-Transaction Cap:** Rejects any action exceeding the per-tx ceiling (e.g. 1.0 SOL / 500 USDC).
- **24-Hour Rolling Budget Window:** Tracks historical spend with millisecond timestamps and strictly limits cumulative 24-hour capital outflows. Automatically evicts expired transactions.
- **Strict Token Allowlist:** Only whitelisted mints (Native SOL, USDC) can be transferred. Unlisted SPL tokens are rejected.
- **Recipient Address Whitelist:** Capital can only be routed to pre-approved treasury or liquidity vaults.
- **Slippage / Fee BPS Boundary:** Rejects routing quotes if total fees exceed maximum allowed basis points (e.g., 100 bps = 1.0%).
- **Strictly Positive Invariant:** Prevents zero or negative transaction attempts.
- **Emergency Circuit Breaker:** Instant pause switch that halts all signing and evaluation loops.

### 2. MultiHopper Multi-Hop Privacy Engine
Instead of predictable direct transfers, the agent orchestrates multi-hop routing using MultiHopper:
- Routes capital across 3 to 10 anonymizing ephemeral PDAs.
- Automatically queries fee estimates and quotes via the MultiHopper SDK/API.
- Prepares serialized transaction bundles (`routeInitTxs`, `orchestratorInitTx`, `sessionInitTxs`, `keeperFundingTx`).
- Signs bundles with the agent's Ed25519 keypair and confirms broadcast.

### 3. Autonomous Balance Sweep & Rebalancing Trigger
- Periodically checks on-chain balances (SOL and SPL tokens).
- When balance exceeds operational thresholds, calculates the exact surplus above required reserves.
- Passes proposed transfers through the Guardrail Engine.
- Upon approval, dispatches the surplus via MultiHopper to cold treasury storage.

### 4. Interactive Live Dashboard
Includes an interactive, zero-dependency visual dashboard (`dashboard/index.html`) displaying:
- Real-time agent status & wallet address (`9fR9R4VQfa1Y3EDxHAW5bh7P7zUQpd46JrVftNn8ZfsS`).
- Live hop-by-hop MultiHopper routing path graph.
- Real-time 24h rolling budget utilization meter.
- Guardrail violation simulation and interactive circuit breaker toggle.

---

## 🏗️ Architecture

```
                                  ┌──────────────────────────┐
                                  │  Autonomous Capital Loop │
                                  │   (runEvaluationCycle)   │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │   On-Chain Balance Check │
                                  │  (Solana Devnet/Mainnet) │
                                  └────────────┬─────────────┘
                                               │ (Surplus > Threshold)
                                               ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      OOBE RISK GUARDRAIL ENGINE                        │
 │  [x] Circuit Breaker    [x] Single-Tx Cap       [x] 24h Rolling Budget │
 │  [x] Token Allowlist    [x] Recipient Allowlist [x] Max Fee (bps) Cap  │
 └─────────────────────────────────────┬──────────────────────────────────┘
                                       │ (Approved)
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    MULTIHOPPER PRIVACY ROUTER                          │
 │  1. Estimate Fee & Quote                                               │
 │  2. Prepare Serialized Tx Bundles (Route, Orchestrator, Keeper)        │
 │  3. Ed25519 Keypair Signing                                            │
 │  4. Confirm Broadcast across N Ephemeral PDA Hops                      │
 └─────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
                       Destination Cold Treasury Vault
```

---

## 🚀 Quickstart

### Prerequisites
- Node.js >= 18
- npm or pnpm

### Installation
```bash
git clone https://github.com/givemehat/solana-capital-agent.git
cd solana-capital-agent
npm install
```

### Running Tests
The repository includes a comprehensive 16-test suite covering guardrail invariants, fee quotes, transaction bundle preparation, and autonomous threshold triggers:
```bash
npm test
```

### CLI Usage
```bash
# Display agent wallet, guardrails configuration, and triggers
npm run agent:status

# Simulate an end-to-end autonomous evaluation and surplus sweep
npm run agent:simulate
```

### Opening the Interactive Dashboard
Simply open `dashboard/index.html` in your web browser:
```bash
open dashboard/index.html
```

---

## 🧪 Test Suite Summary

```
 ✓ src/__tests__/guardrails.test.ts (8 tests)
   - should approve valid transaction within all limits
   - should reject when emergency pause / circuit breaker is active
   - should reject non-positive amounts
   - should enforce token allowlist
   - should enforce recipient allowlist when configured
   - should enforce max per-transaction amount limit
   - should enforce max fee bps cap
   - should enforce 24h rolling budget window and prune expired records

 ✓ src/__tests__/multihopper.test.ts (4 tests)
   - should calculate fee estimation with correct tier and lamports per hop
   - should create a multi-hop transfer quote in awaiting_signature state
   - should prepare transaction bundles with route, orchestrator, and keeper funding txs
   - should confirm broadcast and advance status

 ✓ src/__tests__/agent.test.ts (4 tests)
   - should not execute action if wallet balance is below threshold
   - should trigger surplus sweep when balance exceeds threshold and guardrails pass
   - should reject action and log REJECTED_GUARDRAIL if recipient is unauthorized
   - should halt execution cycles immediately if circuit breaker is paused

Test Files:  3 passed (3)
Tests:       16 passed (16)
```

---

## 🔐 Security & Safety Philosophy
- **Deterministic Guardrails First:** Guardrail checks happen strictly in memory before any network calls or transaction signing occurs.
- **Fail-Closed Design:** Any unexpected error, rate limit, or network aberration halts the execution cycle immediately and marks the action `FAILED` or `REJECTED_GUARDRAIL`.
- **Zero Raw Key Leakage:** Private keys are kept exclusively in isolated local keypair stores and never sent across APIs.

---

## 📄 License
MIT © 2026 [givemehat](https://github.com/givemehat)
