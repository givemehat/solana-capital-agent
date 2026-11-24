# ⚡ Solana Autonomous Capital Agent & MultiHopper Privacy Engine

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-14F195?style=for-the-badge&logo=solana&logoColor=black)](https://givemehat.github.io/solana-capital-agent/)
[![Tests](https://img.shields.io/badge/Vitest-16%20Passed%20(100%25)-9945FF?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/givemehat/solana-capital-agent)
[![Solana](https://img.shields.io/badge/Solana-Devnet%20%7C%20Mainnet-000000?style=for-the-badge&logo=solana&logoColor=14F195)](https://solscan.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

An enterprise-grade autonomous capital allocation agent on Solana featuring **OOBE Protocol (Steve Capital) mathematical risk guardrails** and **MultiHopper multi-hop privacy payment routing**.

Built for the **Superteam Earn** bounties:
- 🛡️ **Autonomous Capital Agent on Solana** ($500 USDC / OOBE Protocol)
- 🔀 **MultiHopper Build & Route Challenge** ($5,000 USDC / MultiHopper)

---

## 🌐 Live Interactive Dashboard

Access the live visual dashboard directly without installation:  
👉 **[https://givemehat.github.io/solana-capital-agent/](https://givemehat.github.io/solana-capital-agent/)**

- **Live Agent Keypair Address:** `9fR9R4VQfa1Y3EDxHAW5bh7P7zUQpd46JrVftNn8ZfsS`
- **Interactive Controls:** Trigger simulation, guardrail rejection testing, and instant circuit breaker arming/disarming.
- **Visual Multi-Hop Graph:** Step-by-step route visualization across ephemeral PDA relays.

---

## 📊 Comparison: Direct Transfer vs. Autonomous MultiHopper Agent

| Dimension | Standard Direct Transfer | Naive Autonomous Agent | MultiHopper Capital Agent (This Project) |
| :--- | :--- | :--- | :--- |
| **Privacy & Anonymity** | ❌ None (Direct public graph link) | ❌ None (Predictable periodic transfers) | ✅ **High (Routed through 3–10 ephemeral PDAs)** |
| **Risk Guardrails** | ❌ Manual discretion only | ⚠️ Weak / Hardcoded checks | ✅ **Deterministic 7-Invariant OOBE Guardrail Engine** |
| **Rolling Window Budget** | ❌ No velocity control | ❌ Daily total reset bug on restart | ✅ **Timestamped 24h rolling window with automated eviction** |
| **Transaction Signing** | 👤 Requires manual user signature | ❌ Blind signing loop | ✅ **Isolated Ed25519 bundle signer after multi-tier validation** |
| **Emergency Control** | ❌ None | ❌ Hard kill required | ✅ **Instant Circuit Breaker (halts execution instantly)** |
| **Auditability** | ⚠️ Fragmented explorer logs | ❌ Unstructured console output | ✅ **Structured Execution Audit Stream with Solscan trace IDs** |

---

## 🔄 High-Level Architecture & Lifecycle

```mermaid
flowchart TD
    subgraph TriggerLayer["1. Trigger & Monitoring Layer"]
        A[Autonomous Daemon Loop] --> B{Evaluate Balances}
        B -->|Balance <= Threshold| C[Maintain Operational Reserve]
        B -->|Balance > Threshold| D[Calculate Surplus Capital]
    end

    subgraph GuardrailEngine["2. OOBE Risk Guardrail Engine"]
        D --> G1{Circuit Breaker Active?}
        G1 -->|Yes| STOP1[Halt Cycle - Emergency Stop]
        G1 -->|No| G2{Amount > 0?}
        G2 -->|No| REJ1[Reject - Non-positive Amount]
        G2 -->|Yes| G3{Token in Allowlist?}
        G3 -->|No| REJ2[Reject - Unauthorized Mint]
        G3 -->|Yes| G4{Recipient in Whitelist?}
        G4 -->|No| REJ3[Reject - Unauthorized Recipient]
        G4 -->|Yes| G5{Amount <= Max Single-Tx?}
        G5 -->|No| REJ4[Reject - Exceeds Tx Ceiling]
        G5 -->|Yes| G6{Rolling 24h Spend <= Budget?}
        G6 -->|No| REJ5[Reject - Budget Depleted]
        G6 -->|Yes| PASS[Guardrail Approved]
    end

    subgraph MultiHopperLayer["3. MultiHopper Privacy Routing"]
        PASS --> MH1[Query Fee Estimate & Quote]
        MH1 --> G7{Fee <= Max Fee BPS?}
        G7 -->|No| REJ6[Reject - Fee Slippage Exceeded]
        G7 -->|Yes| MH2[Prepare Serialized Tx Bundles]
        MH2 --> MH3[Route Init + Orchestrator + Session + Keeper Txs]
        MH3 --> SIGN[Local Ed25519 Keypair Signing]
        SIGN --> BROADCAST[Confirm Broadcast across N Ephemeral PDAs]
    end

    subgraph Destination["4. Settlement"]
        BROADCAST --> SETTLE[Cold Treasury / Yield Vault]
        SETTLE --> AUDIT[Record Spend into 24h Window & Audit Log]
    end

    style PASS fill:#14F195,stroke:#0b0f19,stroke-width:2px,color:#0b0f19
    style STOP1 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ1 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ2 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ3 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ4 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ5 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style REJ6 fill:#ef4444,stroke:#fff,stroke-width:1px,color:#fff
    style SETTLE fill:#9945FF,stroke:#fff,stroke-width:2px,color:#fff
```

---

## 🔀 MultiHopper Multi-Hop Routing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Autonomous Agent
    participant Guard as OOBE Guardrails
    participant MHR as MultiHopper Router
    participant Solana as Solana Ledger (PDAs)
    participant Vault as Cold Treasury Vault

    Agent->>Agent: Detects Surplus Balance (> 2.0 SOL)
    Agent->>Guard: Validate (Amount, Token, Recipient)
    Guard-->>Agent: Pre-Validation Approved
    Agent->>MHR: POST /api/v1/transfers/estimate (Hops=5)
    MHR-->>Agent: Return Fee Quote (50 bps, 30,000 lamports)
    Agent->>Guard: Validate Fee Cap (< 100 bps)
    Guard-->>Agent: Final Invariant Approved
    Agent->>MHR: POST /api/v1/transfers (Create Transfer)
    MHR-->>Agent: Transfer ID & Initialized State
    Agent->>MHR: POST /api/v1/transfers/:id/prepare
    MHR-->>Agent: Serialized Tx Bundles
    Note over Agent: Agent signs keeperFunding, orchestratorInit,<br/>routeInit, and sessionInit txs with Ed25519 Keypair
    Agent->>MHR: POST /api/v1/transfers/:id/confirm-broadcast
    MHR->>Solana: Execute Ephemeral PDA Relay (Hop 1 -> Hop 2 -> Hop 3 -> Hop 4 -> Hop 5)
    Solana->>Vault: Final Settlement to Treasury Vault
    MHR-->>Agent: Status: COMPLETED
    Agent->>Guard: Record Confirmed Spend in Rolling 24h Window
```

---

## 🛡️ OOBE Steve Capital Risk Engine Specifications

The guardrail engine enforces 7 strict invariants. Any violation results in an immediate fail-closed state:

| Invariant | Default Parameter | Enforcement Level | Protection Purpose |
| :--- | :--- | :--- | :--- |
| **1. Emergency Circuit Breaker** | `isPaused: false` | Zero-Tolerance Pre-check | Instantly halts all agent actions in case of market anomalies or suspicious behavior. |
| **2. Strictly Positive Amount** | `amountRaw > 0n` | In-memory verification | Prevents dust spam, zero-value execution cycles, or underflow errors. |
| **3. Token Allowlist** | Native SOL, USDC | Strict address match | Prevents routing or accepting spoofed/malicious SPL tokens. |
| **4. Recipient Whitelist** | Pre-approved Treasury Vaults | Strict address match | Guards against phishing or compromised destination addresses. |
| **5. Max Per-Tx Ceiling** | `1.0 SOL` (1,000,000,000 lamports) | Hard limit per transfer | Limits the maximum capital at risk in any single routing bundle. |
| **6. 24h Rolling Budget Window** | `5.0 SOL` cumulative limit | Dynamic millisecond window | Eliminates the daily reset attack vector where agents drain funds across midnight. |
| **7. Maximum Fee Cap** | `100 bps` (1.00%) | Slippage & fee guard | Aborts routing if network congestion or MultiHopper fees spike unexpectedly. |

---

## 🧮 MultiHopper Routing & Fee Schedule

MultiHopper applies tiered fee models based on hop count and transfer size:

| Hops | Privacy Level | Flat Fee (Lamports) | Protocol Fee (BPS) | Recommended Use Case |
| :---: | :---: | :---: | :---: | :--- |
| **3 Hops** | Standard Anonymity | 18,000 lamports | 50 bps (0.50%) | Routine operational sweeps, micro-rebalancing |
| **5 Hops** | High Privacy | 30,000 lamports | 50 bps (0.50%) | **Default**: Treasury surplus sweeps, capital reserves |
| **8 Hops** | Maximum Obfuscation | 48,000 lamports | 50 bps (0.50%) | High-value capital rebalancing, governance payouts |
| **10 Hops** | Extreme Partitioning | 60,000 lamports | 75 bps (0.75%) | Deep liquidity migration across untrusted bridges |

---

## 🚀 Quickstart & Developer Guide

### 1. Installation
```bash
git clone https://github.com/givemehat/solana-capital-agent.git
cd solana-capital-agent
npm install
```

### 2. Run Test Suite (100% Pass)
```bash
npm test
```

Test output:
```text
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

### 3. Build from Source
```bash
npm run build
```

### 4. CLI Execution
```bash
# Inspect agent wallet, balance thresholds, and guardrail configuration
npm run agent:status

# Simulate an end-to-end evaluation cycle, trigger sweep, and multi-hop bundle signing
npm run agent:simulate
```

### 5. Launch Local Dashboard
```bash
open dashboard/index.html
# Or view the live deployed demo:
# https://givemehat.github.io/solana-capital-agent/
```

---

## 📁 Repository Structure

```
solana-capital-agent/
├── dashboard/
│   └── index.html               # Zero-dependency interactive visual dashboard
├── docs/
│   └── index.html               # GitHub Pages live deployment mirror
├── src/
│   ├── __tests__/
│   │   ├── agent.test.ts        # Autonomous trigger & evaluation cycle tests
│   │   ├── guardrails.test.ts   # 7-invariant OOBE guardrail engine tests
│   │   └── multihopper.test.ts  # MultiHopper quote, bundle preparation & signing tests
│   ├── core/
│   │   ├── agent.ts             # Autonomous agent loop & sweep orchestration
│   │   ├── guardrails.ts        # OOBE Steve Capital risk engine
│   │   └── wallet.ts            # Keypair manager & transaction bundle signer
│   ├── multihopper/
│   │   └── client.ts            # MultiHopper SDK client (live + mock fallback)
│   ├── strategies/
│   │   └── autoSweep.ts         # Treasury surplus auto-sweep strategy factory
│   ├── types/
│   │   └── index.ts             # TypeScript definitions & guardrail interfaces
│   ├── cli.ts                   # CLI entry point (status, simulate, start)
│   └── index.ts                 # Main library export
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔐 Cryptographic & Security Guarantee
1. **Deterministic Guardrails:** Every single transfer proposal must pass all mathematical checks before touching the Solana network or invoking any API.
2. **Zero Custodial Risk:** Private keys remain strictly inside the local environment and are never transmitted over network protocols.
3. **Fail-Closed Architecture:** If network timeouts, RPC drops, or fee spikes occur, the agent aborts execution gracefully without state leakage.

---

## 📄 License
MIT © 2026 [givemehat](https://github.com/givemehat)
