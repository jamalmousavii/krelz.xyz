# Krelz Network

Decentralized LLM Network - Share your GPU, earn KRELZ tokens

## Links

| Service | URL |
|---------|-----|
| Website | https://krelz.xyz |
| Chat AI | https://krelz.xyz/chat |
| Miner Install | https://krelz.xyz/miner |
| Explorer | https://krelz.xyz/explorer |
| API Health | https://krelz.xyz/api/health |

## Features

- **Decentralized LLM Inference** — GPU miners serve AI models via WebSocket
- **Multi-Coin Payments** — BTC, ETH, BNB, USDT, TRX, DOGE, XRP via NowPayments
- **Daily Free Tokens** — 1,000 free AI inference tokens per user per day (UTC reset)
- **Per-Model Pricing** — 11 models from 300M to 70B parameters, priced 30-50% cheaper than DeepSeek
- **Chat Sessions** — Persistent chat history with auto-generated subjects
- **Profile Dashboard** — Balance, daily tokens, wallet, miner settings, resource monitoring
- **Wallet Integration** — MetaMask + Trust Wallet support (EIP-1193)
- **Miner CLI Mode** — Headless CLI for servers (no Electron needed)
- **Resource Monitoring** — CPU, RAM, GPU VRAM, Disk usage tracking
- **Auth System** — Google OAuth + email/password, password reset
- **Uninstall Scripts** — Clean removal for Ubuntu/Debian and RedHat/Fedora
- **Smart Model Fallback** — Auto-selects closest available model when exact model not found
- **Free Cloud AI** — Round-robin routing across Groq, OpenRouter, Cerebras, Cloudflare (free tiers)
- **Install Self-Cleanup** — Install scripts auto-delete after successful installation
- **Daily Free Tokens in Chat** — Shows remaining free tokens next to chat input
- **Miner Earnings** — 90% of paid usage goes to miners
- **Multi-Miner Accounts** — unlimited miners per user (one row per machine), add/remove/rename from profile, no cap
- **Internationalization** — English (default) + Farsi with RTL support

## Quick Install (Miner)

### Ubuntu / Debian

```bash
wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh
```

### RedHat / Fedora / CentOS

```bash
wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh
```

The install script automatically sets up:
- Node.js 20
- Ollama
- Selected AI models (11 available)
- Krelz Miner (CLI mode, systemd service)

### Add another miner (same account, unlimited)
Use the **same email + miner token** (from profile page) on the new machine.
Give it a different **Miner Name** when asked — each machine gets its own
`machine_id` row, dashboard card, model setting and earnings. Remove any miner
anytime from profile (history is preserved, soft delete).

### Uninstall

```bash
# Ubuntu/Debian
wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/uninstall-ubuntu.sh && bash uninstall-ubuntu.sh

# RedHat/Fedora
wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/uninstall-redhat.sh && bash uninstall-redhat.sh
```

Choose to remove miner only or everything (miner + Ollama + models).

## AI Models & Pricing

| Model | Size | Input/1M | Output/1M | vs DeepSeek |
|-------|------|----------|-----------|-------------|
| nomic-embed-text | 274M | $0.070 | $0.140 | -50% |
| embeddinggemma | 300M | $0.073 | $0.146 | -48% |
| bge-m3 | 567M | $0.076 | $0.152 | -46% |
| llama3.1:8b | 8B | $0.079 | $0.158 | -44% |
| qwen3-vl:8b | 8B | $0.082 | $0.164 | -42% |
| gemma4:12b | 12B | $0.085 | $0.170 | -40% |
| qwen3.6:27b | 27B | $0.088 | $0.176 | -38% |
| qwen3-coder:30b | 30B | $0.091 | $0.182 | -36% |
| qwen2.5-coder:32b | 32B | $0.094 | $0.188 | -34% |
| llama3.3:70b | 70B | $0.097 | $0.194 | -32% |
| deepseek-r1:70b | 70B | $0.098 | $0.196 | -30% |

**Reference:** DeepSeek V4 Flash — $0.14 input / $0.28 output per 1M tokens

## Daily Free Tokens

Every user gets **1,000 free AI inference tokens per day**:
- Resets at UTC 00:00
- Does not accumulate
- If exceeded, charges from paid balance (crypto deposits)
- Tracked in `daily_tokens` table

## Project Structure

```
krelz.xyz/
├── backend/                    # API Server (Node.js/Express)
│   ├── src/
│   │   ├── server.js          # Entry point (v3.12.0)
│   │   ├── models.js          # AI models + pricing
│   │   ├── database/
│   │   │   ├── pool.js        # PostgreSQL connection
│   │   │   └── migrate.js     # DB migration (14 tables + resource columns)
│   │   ├── routes/
│   │   │   ├── auth.js        # Authentication
│   │   │   ├── miners.js      # Miner management
│   │   │   ├── chat.js        # LLM chat + daily tokens
│   │   │   ├── payments.js    # Multi-coin payments
│   │   │   ├── token.js       # Balance + daily tokens
│   │   │   ├── stats.js       # Network stats
│   │   │   └── models.js      # Model list API
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT auth
│   │   └── cache.js           # Redis caching
│   └── package.json
├── frontend/                   # UI (Next.js 14 + Tailwind CSS)
│   ├── pages/
│   │   ├── index.js           # Home page
│   │   ├── chat.js            # Chat with AI (sessions + balance)
│   │   ├── profile.js         # Dashboard + settings
│   │   ├── miner.js           # Miner install
│   │   └── explorer.js        # Network explorer
│   ├── components/
│   │   ├── Navbar.js          # Navigation + auth
│   │   ├── GoogleLogin.js     # Google OAuth
│   │   └── LanguageSwitcher.js
│   ├── i18n/
│   │   ├── translations.js    # EN/FA translations
│   │   └── LanguageContext.js
│   └── package.json
├── miner-app/                  # Miner install scripts
└── docs/                       # Documentation
```

## Database Schema (14 Tables)

| Table | Purpose |
|-------|---------|
| users | User accounts |
| miners | GPU miner registrations (multi-miner: `machine_id` + `name` per machine) |
| tasks | Chat task history |
| transactions | Token transactions |
| staking | Staking records |
| user_balances | KRELZ token balance |
| deposits | Deposit history |
| api_keys | API key management |
| user_coin_balances | Multi-coin balances |
| coin_deposits | Crypto deposit history |
| coin_withdrawals | Crypto withdrawal history |
| miner_coin_earnings | Miner earnings |
| chat_sessions | Chat session groups |
| daily_tokens | Daily free token tracking |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Node.js 20, Express, PostgreSQL, Redis |
| LLM | Ollama, 11 models (Llama, Qwen, Gemma, DeepSeek, BGE) |
| Auth | Google OAuth 2.0, JWT |
| Payments | NowPayments (7 cryptocurrencies) |
| Server | Ubuntu 24.04, Nginx, Let's Encrypt |
| i18n | English (default), Farsi (RTL) |

## Development

### Backend

```bash
cd backend
npm install
node src/server.js
# Runs at http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:3001
```

## License

MIT License

---

Built with love for the decentralized community
