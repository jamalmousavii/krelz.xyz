# Krelz Network

Decentralized LLM Network - Share your GPU, earn KRELZ tokens

## Links

| Service | URL |
|---------|-----|
| Website | https://krelz.xyz |
| Chat AI | https://krelz.xyz (homepage = chat) |
| Miner Install | https://krelz.xyz/miner |
| Explorer | https://krelz.xyz/explorer |
| API Health | https://krelz.xyz/health |

## Features

- **Decentralized LLM Inference** — GPU miners serve AI models via WebSocket
- **Multi-Coin Payments (v3.18.0)** — USD wallet; Top Up via NowPayments (BTC, ETH, BNB, USDT, TRX, DOGE, XRP on checkout); withdraw USDT TRC-20 min $5
- **Chat Source Badge (v3.18.3)** — each reply shows `⛏️ via miner` / `⚡ via provider` / `💻 local`
- **Default Model (v3.18.3)** — chat defaults to `llama3.1:8b` (online miner); `free-cloud-ai` always available
- **Daily Free Tokens** — 1,000 free AI inference tokens per user per day (UTC reset)
- **Per-Model Pricing** — 11 models from 300M to 70B parameters, priced 30-50% cheaper than DeepSeek
- **Chat Sessions** — Persistent chat history with auto-generated subjects
- **Profile Dashboard** — USD balance, daily tokens, logout, quick-nav
- **Miner CLI Mode** — Headless CLI for servers (no Electron needed)
- **Resource Monitoring** — CPU, RAM, GPU VRAM, Disk usage tracking
- **Auth System** — Google OAuth + email/password, password reset
- **Uninstall Scripts** — Clean removal for Ubuntu/Debian and RedHat/Fedora
- **Smart Model Fallback** — Auto-selects closest available model when exact model not found
- **Free Cloud AI** — Round-robin routing across Groq, OpenRouter, Cerebras, Cloudflare (free tiers)
- **Install Self-Cleanup** — Install scripts auto-delete after successful installation
- **Miner Earnings** — 90% of paid usage goes to miners
- **Multi-Miner Accounts** — unlimited miners per user, each with its own unique token; add/remove/rename from `/miners`, no cap
- **Internationalization (v3.16.0)** — 33 languages with country flags; browser auto-detect; session-persisted user choice; RTL for FA/AR/HE/UR
- **Global Version Footer (v3.16.0)** — every page shows a one-line footer sentence including the current version
- **USD Wallet (v3.18.0)** — Settings/Profile show `$` balance; Top Up → NowPayments; withdraw USDT-TRC20
- **Chat-First Homepage (v3.15.0)** — Landing page IS the chat: centered model picker + input; after start, history sidebar left + input bottom
- **Split Pages (v3.15.0)** — Dashboard (`/profile`), Miners (`/miners`), Settings (`/settings`) separated
- **Light Sky Theme (v3.15.0)** — Sky-blue light UI across all pages
- **Install Self-Cleanup** — Install scripts auto-delete after successful installation (`rm -f "$0"`)
- **Miner Docs vs Interactive (v3.16.0)** — `/miner`: full install/connect/delete guide + GitHub; `/miners`: copy-command Quick Install + miner cards

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
Each server-miner gets its **own unique token** (the token IS the miner identity).
1. Profile → Miner Settings → **+ Add Miner** (optional name) → copy its token
2. On the new machine, install with **that token**:
```bash
wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token kz_... --name my-second-miner
```
3. The new miner appears as its own card (status, model, earnings). Remove any
miner anytime from profile (history is preserved, soft delete).

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
| qwen3-coder:30b | 30B | $0.091 | $0.182 | -36% |
| qwen2.5-coder:32b | 32B | $0.094 | $0.188 | -34% |
| llama3.3:70b | 70B | $0.097 | $0.194 | -32% |
| deepseek-r1:70b | 70B | $0.098 | $0.196 | -30% |

**Reference:** DeepSeek V4 Flash — $0.14 input / $0.28 output per 1M tokens

## Daily Free Tokens

Every user gets **1,000 free AI inference tokens per day**:
- Resets at UTC 00:00
- Does not accumulate
- If exceeded, charges from paid USD balance (NowPayments deposits)
- Tracked in `daily_tokens` table

## Project Structure

```
krelz.xyz/
├── backend/                    # API Server (Node.js/Express)
│   ├── src/
│   │   ├── server.js          # Entry point (v3.18.3)
│   │   ├── models.js          # AI models + pricing
│   │   ├── database/
│   │   │   ├── pool.js        # PostgreSQL connection
│   │   │   └── migrate.js     # DB migration (14 tables + resource columns)
│   │   ├── routes/
│   │   │   ├── auth.js        # Authentication
│   │   │   ├── miners.js      # Miner management
│   │   │   ├── chat.js        # LLM chat + daily tokens
│   │   │   ├── payments.js    # USD wallet + NowPayments
│   │   │   ├── token.js       # Balance + daily tokens
│   │   │   ├── stats.js       # Network stats
│   │   │   └── models.js      # Model list API
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT auth
│   │   └── cache.js           # Redis caching
│   └── package.json
├── frontend/                   # UI (Next.js 14 + Tailwind CSS)
│   ├── pages/
│   │   ├── index.js           # Chat homepage (chat-first; default llama3.1:8b, v3.18.3)
│   │   ├── chat.js            # Redirects to / (chat is homepage now)
│   │   ├── profile.js         # Dashboard (balance, daily tokens)
│   │   ├── miners.js          # Miner management + Quick Install copy (v3.16.0)
│   │   ├── settings.js        # Settings (USD wallet, 33-lang dropdown, password)
│   │   ├── miner.js           # Miner docs: install/connect/delete + GitHub (v3.16.0)
│   │   ├── explorer.js        # Network explorer (not in nav)
│   │   ├── leaderboard.js     # Top miners/users
│   │   └── admin.js           # Admin panel
│   ├── components/
│   │   ├── Navbar.js          # Nav (Miner, Leaderboard) + auth + lang dropdown
│   │   ├── Footer.js          # Global version footer (v3.16.0)
│   │   ├── GoogleLogin.js     # Google OAuth
│   │   ├── ErrorBoundary.js   # Error boundary
│   │   └── LanguageSwitcher.js # 33-lang dropdown with flags
│   ├── i18n/
│   │   ├── translations.js    # Aggregator + LANGUAGES + detectLanguage
│   │   ├── translations/      # One file per language (33 files)
│   │   └── LanguageContext.js  # Provider (browser detect + sessionStorage)
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
| miners | GPU miner registrations (multi-miner: unique `miner_token` per row) |
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
| Payments | NowPayments — USD wallet, 7 coins at checkout, USDT TRC-20 withdraw |
| Server | Ubuntu 24.04, Nginx, Let's Encrypt |
| i18n | 33 languages (browser detect, RTL FA/AR/HE/UR) |

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
