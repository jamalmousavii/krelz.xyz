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
- **Chat Source Badge (v3.18.4)** — each reply shows `⛏️ via miner` / `💻 local`
- **Default Model (v3.18.4)** — chat defaults to `llama3.1:8b`
- **Paid Inference (v3.24.0)** — GPU miner first, local Ollama second; every signed-in message is charged from the USD wallet (guest chat is free with a rate limit). No free cloud fallback.
- **Miner Free Credit (v3.25.0)** — an online/busy miner earns its host a free **$1/day** chat allowance; platform-funded (no wallet debit, no miner revenue share).
- **Fullscreen Chat Frame (v3.19.1)** — chat fits the viewport exactly (no page scrolling at any resolution/zoom); input keeps focus while the model answers; the latest message is always in view, including after refresh
- **Attachments & Voice (v3.20.0)** — 📎 send an image, PDF or text file (file text is read server-side so any model can answer; images go to vision models), 🎤 record a ≤60s voice note (client-side WAV encoder, `gemma4:12b`); gated per model with explicit errors — attachments are never silently dropped
- **Per-Model Pricing** — 16 models from 274M to 70B parameters, priced 30-50% cheaper than DeepSeek
- **Chat Sessions** — Persistent chat history with auto-generated subjects
- **Profile Dashboard** — USD balance, logout, quick-nav; leaderboard rank card for miners (v3.21.0)
- **Miner CLI Mode** — Headless CLI for servers (no Electron needed)
- **Resource Monitoring** — CPU, RAM, GPU VRAM, Disk usage tracking
- **Auth System** — Google OAuth + email/password, password reset
- **Uninstall Scripts** — Clean removal for Ubuntu/Debian and RedHat/Fedora; unregisters from your dashboard (v3.22.0) — earnings stay in the Miner History section on `/miners`
- **Mobile-Friendly UI (v3.23.0)** — usable on any phone: keyboard never covers the chat input (iOS visual-viewport fix), no focus zoom, touch targets ≥40px, full-screen mobile menu, overlay session drawer, safe-area insets for notched devices
- **Smart Model Fallback** — Auto-selects closest available model when exact model not found
- **Install Self-Cleanup (v3.10.0)** — Install scripts auto-delete after successful installation
- **Uninstall Self-Cleanup (v3.19.0)** — Uninstall scripts delete themselves after a successful removal (cancel or a failed step keeps the file so it can be rerun)
- **Miner Earnings** — 90% of paid usage goes to miners
- **Earnings Surfaces (v3.29.0)** — flat **90%** share shown everywhere: "Your Earnings" card on `/miner` (5 sources: 🎟️ token pot / 👛 wallet / ⭐ Plus / 🚀 Pro / 👑 Max), account-level breakdown on `/miners` and the profile (shared `EarningsBreakdown` component)
- **Pricing Everywhere (v3.29.0 + v3.30.0)** — public pricing section on the empty homepage (`/#plans`) plus a **pricing modal** that opens from the Navbar `⭐ Plans` link or a `/#plans` deep link in any homepage state, including mid-chat
- **Multi-Miner Accounts** — unlimited miners per user, each with its own unique token; add/remove/rename from `/miners`, no cap
- **Internationalization (v3.16.0)** — 33 languages with country flags; browser auto-detect; session-persisted user choice; RTL for FA/AR/HE/UR
- **Global Version Footer (v3.16.0)** — every page shows a one-line footer sentence including the current version
- **USD Wallet (v3.18.0)** — Settings/Profile show `$` balance; Top Up → NowPayments; withdraw USDT-TRC20
- **Chat-First Homepage (v3.15.0)** — Landing page IS the chat: centered model picker + input; after start, history sidebar left + input bottom
- **Split Pages (v3.15.0)** — Dashboard (`/profile`), Miners (`/miners`), Settings (`/settings`) separated
- **Modern Neutral Chat UI (v3.37.0)** — ChatGPT/Gemini-style chat experience (auto-growing composer, neutral palette, sky accents)
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
- Selected AI models (16 available)
- Krelz Miner (CLI mode, systemd service)

Requires **~15 GB free disk** (checked before the model download; bypass with
`KRELZ_SKIP_DISK_CHECK=1`). Every script passes `shellcheck` (enforced in CI).

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
| llama3.2:3b | 3B | $0.071 | $0.142 | -49% |
| embeddinggemma | 300M | $0.073 | $0.146 | -48% |
| bge-m3 | 567M | $0.076 | $0.152 | -46% |
| llama3.1:8b | 8B | $0.079 | $0.158 | -44% |
| qwen3-vl:8b | 8B | $0.082 | $0.164 | -42% |
| gemma4:12b | 12B | $0.085 | $0.170 | -40% |
| phi4:14b | 14B | $0.086 | $0.172 | -39% |
| gpt-oss:20b | 21B MoE | $0.088 | $0.176 | -37% |
| mistral-small3.2:24b | 24B | $0.090 | $0.180 | -36% |
| qwen3-coder:30b | 30B | $0.091 | $0.182 | -36% |
| gemma3:27b | 27B | $0.092 | $0.184 | -34% |
| qwen2.5-coder:32b | 32B | $0.094 | $0.188 | -34% |
| qwen3:32b | 32B | $0.095 | $0.190 | -32% |
| llama3.3:70b | 70B | $0.097 | $0.194 | -32% |
| deepseek-r1:70b | 70B | $0.098 | $0.196 | -30% |

**Reference:** DeepSeek V4 Flash — $0.14 input / $0.28 output per 1M tokens

## Payments, Free Allowance & Plans

Every message settles in one row-locked transaction, in order:
1. **Daily free allowance (v3.27.0)** — **2,000,000 tokens per UTC day** for every subject (signed-in users by account, guests by IP); plan tiers raise the cap (up to 80M/day on Max); `payment_status: "free"`, platform-funded
2. **Miner credit (v3.25.0)** — with a miner `online`/`busy`, the first **$1.00 per UTC day** is free (`payment_status: "free_miner"`); the miner earns nothing from these chats
3. **Token bundle pot (v3.28.0)** — prepaid tokens ($1 = 1M, never expires) drain all-or-nothing per message (`payment_status: "tokens"`); the miner earns 90% of the message's catalog value, paid from bundle revenue
4. **USD wallet** (deposits via NowPayments) — a miner serving a **paid** reply earns a flat **90%** of the cost, whatever plan the payer is on
5. Race fallback — an already-generated reply is still served as `"free"`

**Wall:** a subject with *zero* coverage (allowance spent + no credit + empty pot + empty wallet) gets `402 upgrade_required` with the plan catalog + bundle offer — checked **before** dispatch; partial coverage never blocks.

**Plans (v3.28.0)** — bought with crypto via NowPayments, renewal extends from `max(now, expiry)` by 30 days:

| Tier | Price | Tokens/day | Catalog value/day* |
|------|-------|-----------:|-------------------:|
| Free | $0 | 2,000,000 | ≈ $0.32 |
| ⭐ Plus | $4.99/mo | 10,000,000 | ≈ $1.58 |
| 🚀 Pro | $9.99/mo | 30,000,000 | ≈ $4.74 |
| 👑 Max | $19.99/mo | 80,000,000 | ≈ $12.64 |

\* at the default model's catalog output price ($0.158/1M).

**Token bundles (v3.28.0)** — whole dollars **$1–$500 → 1M tokens per $1**, one-time payment, **never expires**, settled between the daily allowance and the wallet.

**Miner earnings breakdown (v3.28.0)** — every earning row records its source and the payer's plan; the profile shows 5 buckets: 🎟️ Tokens / 👛 Wallet / ⭐ Plus / 🚀 Pro / 👑 Max (free legs pay miners nothing).

## Project Structure

```
krelz.xyz/
├── backend/                    # API Server (Node.js/Express)
│   ├── src/
│   │   ├── server.js          # Entry point (v3.19.0)
│   │   ├── models.js          # AI models + pricing
│   │   ├── database/
│   │   │   ├── pool.js        # PostgreSQL connection
│   │   │   └── migrate.js     # DB migration (20 tables + resource columns)
│   │   ├── routes/
│   │   │   ├── auth.js        # Authentication
│   │   │   ├── miners.js      # Miner management
│   │   │   ├── chat.js        # LLM chat + payment chain + coverage wall
│   │   │   ├── payments.js    # USD wallet + NowPayments (deposit/plan/token IPN)
│   │   │   ├── plans.js       # Plan catalog (Plus/Pro/Max) + tier/token-bundle purchase
│   │   │   ├── token.js       # Balance snapshot
│   │   │   ├── stats.js       # Network stats
│   │   │   └── models.js      # Model list API
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT auth
│   │   └── cache.js           # Redis caching
│   └── package.json
├── frontend/                   # UI (Next.js 14 + Tailwind CSS)
│   ├── pages/
│   │   ├── index.js           # Chat homepage (state hub; UI split into components/chat/ v3.36.0)
│   │   ├── profile.js         # Dashboard (balance, plans + token bundle cards, earnings breakdown, miner credit, rank)
│   │   ├── miners.js          # Miner management + Quick Install copy + history (v3.22.0)
│   │   ├── settings.js        # Settings (USD wallet, 33-lang dropdown, password)
│   │   ├── miner.js           # Miner docs: install/connect/delete + GitHub (v3.16.0)
│   │   ├── explorer.js        # Network explorer (not in nav)
│   │   ├── leaderboard.js     # Top miners/users
│   │   └── admin.js           # Admin panel
│   ├── components/
│   │   ├── Navbar.js          # Nav (Miner, ⭐ Plans, Leaderboard) + auth + lang dropdown
│   │   ├── EarningsBreakdown.js # 5-way miner earnings breakdown (profile, /miners, /miner)
│   │   ├── PlansContent.js    # Pricing cards shared by inline section + modal (v3.30.0)
│   │   ├── PlansModal.js      # Pricing overlay for /#plans deep links + Navbar (v3.30.0)
│   │   ├── Footer.js          # Global version footer (v3.16.0)
│   │   ├── GoogleLogin.js     # Google OAuth
│   │   ├── ErrorBoundary.js   # Error boundary
│   │   ├── LanguageSwitcher.js # 33-lang dropdown with flags
│   │   └── chat/              # Chat UI split (Sidebar, MessageList, Composer, UpgradeWall; v3.36.0)
│   ├── hooks/
│   │   └── useApi.js          # Abort-aware fetch hook (leaderboard/explorer; v3.36.0)
│   ├── i18n/
│   │   ├── translations.js    # Code-split registry (en static + 32 lazy) + LANGUAGES + detectLanguage
│   │   ├── translations/      # One file per language (33 files)
│   │   └── LanguageContext.js  # Provider (browser detect + sessionStorage)
│   └── package.json
├── miner-app/                  # Miner install scripts
└── docs/                       # Documentation
```

## Database Schema (20 Tables)

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
| daily_tokens | Daily free allowance — signed-in users (2M tokens/UTC-day) |
| miner_daily_credit | Free daily chat credit for miner hosts ($1/UTC-day) |
| daily_tokens_guest | Daily free allowance — guests, keyed by client IP |
| user_plans | Active subscription tiers (plus/pro/max) |
| plan_purchases | Plan/token invoice claims — IPN exactly-once idempotency |
| user_token_balances | Prepaid token pot — $1 = 1M tokens, never expires |
| schema_migrations | Migration bookkeeping |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Node.js 20, Express, PostgreSQL, Redis |
| LLM | Ollama, 16 models (Llama, Qwen, Gemma, DeepSeek, Phi, GPT-OSS, Mistral, BGE) |
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

Google Sign-in needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` at **build** time — copy
`frontend/.env.example` to `frontend/.env.local` (see the file's comment; the same
client id as `GOOGLE_CLIENT_ID` in `backend/.env`).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/api.md](docs/api.md) | Full API reference (auth, chat billing, miners, payments, health) |
| [docs/AUDIT.md](docs/AUDIT.md) | Security/money audit: findings, fixes, open risks, deploy checklist |
| [docs/architecture.md](docs/architecture.md) | Architecture overview |
| [docs/tokenomics.md](docs/tokenomics.md) | Token model |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## License

MIT License

---

Built with love for the decentralized community
