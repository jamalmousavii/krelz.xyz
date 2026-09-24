# Krelz Network - Development Guide

## Prerequisites

- Node.js 20+
- npm
- Docker (for PostgreSQL/Redis)
- PostgreSQL 15+

## Setup

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### 2. Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

### 3. Database Migration

```bash
cd backend
node src/database/migrate.js
```

### 4. Run Development Servers

```bash
# Frontend (port 3001)
cd frontend
npm run dev

# Backend (port 3000)
cd backend
node src/server.js
```

## Project Structure

### frontend/
Next.js 14 frontend with Tailwind CSS and i18n support.

```
frontend/
├── pages/
│   ├── index.js           # Chat homepage (chat-first; default llama3.1:8b, v3.18.1)
│   ├── chat.js            # Redirects to /
│   ├── profile.js         # Dashboard (balance, daily tokens)
│   ├── miners.js          # Miner mgmt + Quick Install copy buttons (v3.16.0)
│   ├── settings.js         # Settings (USD wallet, 33-lang dropdown, password)
│   ├── miner.js           # Miner docs: install/connect/delete + GitHub (v3.16.0)
│   ├── explorer.js        # Network explorer (not in main nav)
│   ├── leaderboard.js     # Top miners/users
│   └── admin.js           # Admin panel
├── components/
│   ├── Navbar.js          # Nav + auth dropdown + LanguageSwitcher
│   ├── Footer.js          # Global version footer (every page, v3.16.0)
│   ├── GoogleLogin.js     # Google OAuth
│   ├── ErrorBoundary.js   # Error boundary
│   └── LanguageSwitcher.js # Dropdown: flag + language name (33 langs)
├── i18n/
│   ├── translations.js    # Aggregator, LANGUAGES, RTL_LANGS, isRtl, detectLanguage
│   ├── translations/      # One file per language (33 files: en, fa, ar, ...)
│   └── LanguageContext.js  # Provider: browser detect + sessionStorage
└── styles/
```

### backend/
Node.js/Express API with PostgreSQL + Redis.

```
backend/
├── src/
│   ├── server.js          # Entry point (v3.18.1)
│   ├── models.js          # AI models + per-model pricing
│   ├── cache.js           # Redis caching
│   ├── database/
│   │   ├── pool.js        # PostgreSQL connection
│   │   └── migrate.js     # DB migration (14 tables + resource columns)
│   ├── middleware/
│   │   └── auth.js        # JWT + Google OAuth
│   └── routes/
│       ├── auth.js        # Register/Login/Google
│       ├── chat.js        # LLM chat + daily tokens + sessions
│       ├── miners.js      # Miner CRUD + model switch
│       ├── models.js      # Model list API
│       ├── payments.js    # NowPayments USD wallet (deposit/withdraw/IPN)
│       ├── token.js       # Balance + daily tokens info
│       ├── stats.js       # Network stats
│       └── leaderboard.js # Top miners
└── package.json
```

### miner-app/
Miner install/uninstall scripts and source code.

```
miner-app/
├── install-ubuntu.sh      # Ubuntu/Debian installer
├── install-redhat.sh      # RedHat/Fedora installer
├── uninstall-ubuntu.sh    # Ubuntu/Debian uninstaller
├── uninstall-redhat.sh    # RedHat/Fedora uninstaller
└── src/                   # Miner source
    ├── main.js            # Electron desktop app
    ├── cli.js             # Headless CLI entry (no Electron)
    ├── renderer/index.html
    └── services/
        ├── ollama.js      # Ollama integration
        ├── miner.js       # CPU/RAM/GPU/Disk monitoring
        ├── websocket.js   # WebSocket to backend (resource metrics)
        └── api.js         # REST API (register, heartbeat)
```

## Database Schema (14 Tables)

| Table | Purpose |
|-------|---------|
| users | User accounts (email, Google OAuth) |
| miners | GPU miner registrations |
| tasks | Chat task history |
| transactions | Token transactions |
| staking | Staking records |
| user_balances | KRELZ token balance |
| deposits | Deposit history |
| api_keys | API key management |
| user_coin_balances | Multi-coin balances (7 coins) |
| coin_deposits | Crypto deposit history |
| coin_withdrawals | Crypto withdrawal history |
| miner_coin_earnings | Miner earnings per coin |
| chat_sessions | Chat session groups |
| **daily_tokens** | **Daily free token tracking (v3.5.0)** |

### Miners Table — Resource Monitoring Columns (v3.8.0)

| Column | Type | Purpose |
|--------|------|---------|
| gpu_usage | numeric(5,2) | GPU VRAM usage percentage |
| ram_usage | numeric(5,2) | RAM usage percentage |
| cpu_usage | numeric(5,2) | CPU usage percentage |
| disk_usage | numeric(5,2) | Disk usage percentage |

**Important:** PostgreSQL `numeric` columns return as **strings** in node-postgres. Always use `parseFloat()` before `.toFixed()` or arithmetic.

## AI Models & Pricing

Models defined in `backend/src/models.js` with per-model pricing:

```javascript
{
  id: 'llama3.1:8b',
  name: 'Llama 3.1',
  size: '8B',
  ram: '5 GB',
  category: 'chat',
  desc: 'Best budget all-rounder',
  inputPrice: 0.079,   // per 1M tokens
  outputPrice: 0.158   // per 1M tokens
}
```

### Pricing Table (vs DeepSeek V4 Flash)

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

## Daily Free Tokens System (v3.5.0)

Every user gets **1,000 free AI inference tokens per day**.

### How it works

1. New user → `daily_tokens` row created on first chat
2. Each chat request → `checkDailyTokens(userId)` called
3. If UTC day changed → `tokens_used_today` reset to 0
4. Free tokens cover `tokens_used * 0.001` cost
5. If daily limit exceeded → charge from paid crypto balance

### Backend flow (chat.js)

```
1. checkDailyTokens(userId) → { limit: 1000, used, remaining }
2. dailyTokenValue = remaining * 0.001
3. dailyCoverage = min(cost, dailyTokenValue)
4. paidPortion = cost - dailyCoverage
5. If paidPortion > 0 → deduct from user_coin_balances
6. Miner gets 90% of paidPortion
```

### API Response

```json
GET /api/token/balance
{
  "success": true,
  "available": 5.00,
  "total_earned": 2.00,
  "total_spent": 0.50,
  "daily_tokens": {
    "limit": 1000,
    "used": 342,
    "remaining": 658
  }
}
```

## Wallet Integration (v3.6.0)

### Supported Wallets

| Wallet | Detection | Provider |
|--------|-----------|----------|
| MetaMask | `window.ethereum?.isMetaMask` | EIP-1193 |
| Trust Wallet | `window.ethereum?.isTrust \|\| window.ethereum?.isTrustWallet` | EIP-1193 |

### How it works

Both wallets use the same EIP-1193 standard. The only difference is the detection flag.

### Frontend flow (profile.js)

```
1. User clicks "Connect Wallet" → shows 2 buttons
2. MetaMask button → checks window.ethereum?.isMetaMask
3. Trust Wallet button → checks window.ethereum?.isTrust
4. Both use: provider.request({ method: 'eth_requestAccounts' })
5. If wallet not installed → opens download page
6. After connection → shows wallet address + which wallet
```

## Web3 Wallet Connect (removed in v3.18.0)

MetaMask / Trust Wallet connect was removed from Settings in favor of a **USD-only wallet**
(NowPayments Top Up + USDT TRC-20 withdraw). The notes below are historical.

### Detection Logic (legacy)

```javascript
// MetaMask
if (window.ethereum?.isMetaMask) { /* MetaMask installed */ }

// Trust Wallet
if (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) { /* Trust installed */ }

// Check if any wallet is connected
const accounts = await window.ethereum.request({ method: 'eth_accounts' });
```

### Adding a New Wallet

1. Add detection check in `connectWallet(type)` function
2. Add button in wallet UI section
3. Add translation keys (`connectXxx`)
4. Both use same `eth_requestAccounts` method

## Internationalization (i18n) — 33 languages (v3.16.0+)

### How it works

- Language files: `frontend/i18n/translations/<code>.js` (one per language, full key set)
- Aggregator: `frontend/i18n/translations.js` exports `translations`, `LANGUAGES` (code/name/flag/rtl), `RTL_LANGS`, `isRtl()`, `detectLanguage()`
- **Detection (first visit):** `sessionStorage['krelz-lang']` → else `navigator.languages` match → else `en`
- **User choice:** stored in `sessionStorage['krelz-lang']` (persists while user is on the site / same tab)
- **RTL:** `fa`, `ar`, `he`, `ur` — `document.documentElement.dir` set by LanguageContext
- Fallback: missing keys fall back to English (`t()` walks `translations[lang]` then `translations.en`)

### Adding a new language

1. Copy `frontend/i18n/translations/en.js` → `<code>.js` and translate all values
2. Import it in `frontend/i18n/translations.js` and add to the `translations` object
3. Add `{ code, name, flag, rtl }` to `LANGUAGES`
4. If RTL, add code to RTL set (via `rtl: true` on the LANGUAGES entry)

### Translation Keys (Profile)

```
t('profile.available')   → "Available" / "موجود"
t('profile.earned')      → "Earned" / "کسب شده"
t('profile.spent')       → "Spent" / "مصرف شده"
t('profile.dailyTokens') → "Daily Free Tokens" / "توکن رایگان روزانه"
t('profile.remaining')   → "Remaining" / "باقیمانده"
t('profile.usedToday')   → "Used Today" / "امروز مصرف شده"
```

## Miner CLI Mode (v3.8.0)

For headless servers (no desktop/Electron), use `cli.js`:

```bash
node src/cli.js --email user@example.com --token kz_xxxxx
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--email` | User email for auto-registration |
| `--token` | Miner token from profile page |
| `--help` | Show usage info |

### Systemd Service

The install script creates `/etc/systemd/system/krelz-miner.service`:

```bash
systemctl start krelz-miner
systemctl stop krelz-miner
systemctl status krelz-miner
journalctl -u krelz-miner -f  # live logs
```

Service auto-starts on boot via `systemctl enable`.

## Auth System (v3.7.0)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register (email + password) |
| POST | /api/auth/login | Login (email + password) |
| POST | /api/auth/google | Google OAuth |
| POST | /api/auth/set-password | Set password (Google-only users) |
| POST | /api/auth/change-password | Change password |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset with token |

### Miner Token

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/miners/token | Generate/get miner token |
| POST | /api/miners/setup | Register miner (with token) |

Miner token format: `kz_` + 32 hex bytes (67 chars)

## Multi-Miner Accounts (v3.12.0, token model v3.13.0, single-use display v3.14.0)

One user can run **unlimited miners**, add/remove/rename from profile. No cap.

### Identity (v3.13.0+): one unique token per miner
- `POST /api/miners` (auth) creates a miner row + unique `miner_token`.
  The token IS the miner identity — no two servers can collide.
  Empty name defaults to **`miner1`** (v3.14.0).
- Install that server with **its own token** (`--token`); `/setup` and WS
  `auth` bind directly by token.
- **Single-use display (v3.14.0):** `miners.token_used_at` is set on first
  successful `/setup` or WS auth. `GET /api/miners/mine` then returns
  `miner_token: null` (token stays in DB for re-auth).
  `PUT /api/miners/mine/:id/token` rotates the token and clears the flag
  (for reinstalling the same machine).
- Profile shows a **guide modal** on first visit and every time before Add Miner.
- Legacy account token (`users.miner_token`) still works only when the user
  has exactly 1 active miner; otherwise the API asks for the per-miner token.
- `machine_id`/`name` columns from v3.12.0 are kept for display/compat but no
  longer used for lookup.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/miners | Create miner for current user → row + unique token (v3.13.0+; default name `miner1`) |
| PUT | /api/miners/mine/:id/token | Rotate token for reinstall, clear `token_used_at` (v3.14.0+) |
| POST | /api/miners/setup | Bind by per-miner token; legacy account token only if exactly 1 active miner |
| GET | /api/miners/mine | Array `miners` (+ legacy `miner` = first, backward compat) |
| PUT | /api/miners/mine/model | Switch model; body `{ model, miner_id? }` |
| PUT | /api/miners/mine/:id | Rename (own miners only) |
| DELETE | /api/miners/mine/:id | Soft delete → `status='removed'` (history preserved) |

### Lifecycle rules
- Removed miners are excluded from dispatch (only `status='online'` gets tasks).
- WS auth rejects `removed`/unknown tokens (`auth_error`); reinstalling with
  the same per-miner token revives its row (sets back to `online`).
- Concurrent connections with the same token: newest wins, old socket is
  closed; miner re-authenticates automatically on `Not authenticated`.
- In-memory WS registry and heartbeat/cleanup are already keyed by `miner.id`,
  so no changes were needed there.

### Miner app changes
- `websocket.js`: token-only `auth`; re-auth on `Not authenticated` (guarded);
  `servername` SNI for direct-IP TLS.
- `cli.js` / `main.js`: read `miner_token` from `config.json`.
- Install scripts: prompt for name (`--name` flag supported), saved to
  `config.json` and sent in `/setup` POST (display only).

## Uninstall (v3.9.0)

Interactive menu:

```
1) Miner only (service + app files)
2) Everything (miner + Ollama + all downloaded models)
0) Cancel
```

**Option 1:** stops service, disables, removes files
**Option 2:** Option 1 + removes Ollama binary + ~/.ollama/ models + ollama user

## Smart Model Fallback (v3.10.0)

When a chat request uses a model not installed on VPS Ollama, the backend auto-selects the closest available model:

1. Fetch available models from `GET /api/tags`
2. If exact model found → use it
3. If not → find same family (e.g., `llama3.1:8b` → `llama3:8b`)
4. If no family match → use first available model
5. Log which model was actually used

## Free Cloud AI — Round-Robin Routing (v3.11.0)

A free model that routes across multiple cloud providers using round-robin with automatic failover.

### Providers

| Provider | API URL | Free Tier | Rate Limit |
|----------|---------|-----------|------------|
| Groq | `api.groq.com/openai/v1` | Llama 3.1 8B, 3.3 70B | 30 RPM, 14,400 RPD |
| OpenRouter | `openrouter.ai/api/v1` | 25+ free models (`:free` suffix) | 20 RPM, 50 RPD |
| Cerebras | `api.cerebras.ai/v1` | Llama 3.1 8B, 3.3 70B | ~1M tokens/day |
| Cloudflare | `api.cloudflare.com/...` | Llama 3.1 8B, 3.3 70B | 10K neurons/day |

### How it works

1. User selects "🌐 Free Cloud AI" in chat
2. Backend uses round-robin index to pick next provider
3. If provider responds → return response
4. If provider fails (rate limit, timeout) → cooldown 60s, try next
5. Provider label shown: "⚡ via Groq"

### Model mapping

```
Krelz Model    → Groq                → OpenRouter              → Cerebras          → Cloudflare
llama3.1:8b    → llama-3.1-8b-instant → meta-llama/llama-3.1... → llama-3.1-8b       → @cf/meta/llama-3.1...
llama3.3:70b   → llama-3.3-70b-vers.  → meta-llama/llama-3.3... → llama-3.3-70b      → @cf/meta/llama-3.3...
free-cloud-ai  → llama-3.1-8b-instant → meta-llama/llama-3.1... → llama-3.1-8b       → @cf/meta/llama-3.1...
```

### Environment variables

```
GROQ_API_KEY=
OPENROUTER_API_KEY=
CEREBRAS_API_KEY=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

### Cooldown system

When a provider returns 429 (rate limited):
- Provider enters 60-second cooldown
- Next request skips it and tries the next provider
- After cooldown, provider is available again

## Install Script Self-Cleanup (v3.10.0)

Install scripts auto-delete themselves after successful installation:

```bash
rm -f "$0"  # Last line of install-ubuntu.sh / install-redhat.sh
```

## VPS Deployment

### Server Info

| Item | Value |
|------|-------|
| IP | 65.109.176.28 |
| OS | Ubuntu 24.04 |
| User | root |
| Backend | /opt/krelz/backend |
| Frontend | /opt/krelz/frontend |

### Deploy Commands

```bash
# SSH into server
ssh root@65.109.176.28

# Run migration (after DB schema changes)
cd /opt/krelz/backend
node src/database/migrate.js

# Rebuild frontend
cd /opt/krelz/frontend
npm run build

# Restart services
systemctl restart krelz-backend
systemctl restart krelz-frontend
```

### Services

```bash
systemctl status krelz-backend
systemctl status krelz-frontend
systemctl status nginx
docker ps  # krelz-postgres, krelz-redis
```

### Quick Deploy from Local

```bash
python3 /tmp/deploy_v350.py
```

## Troubleshooting

### npm install fails

```bash
rm -rf node_modules package-lock.json
npm install
```

### Port already in use

```bash
lsof -i :3000
kill -9 <PID>
```

### Build fails

```bash
rm -rf frontend/.next
cd frontend && npm run build
```

### Frontend not updating

```bash
systemctl restart krelz-frontend
```

### Database connection issues

```bash
docker exec krelz-postgres psql -U krelz -d krelz -c "SELECT 1"
```

### Check daily_tokens table

```bash
docker exec krelz-postgres psql -U krelz -d krelz -c "SELECT * FROM daily_tokens LIMIT 5"
```
