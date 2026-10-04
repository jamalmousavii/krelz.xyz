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
│   ├── index.js           # Chat homepage (chat-first; fullscreen frame; attachments/voice v3.20.0)
│   ├── chat.js            # Redirects to /
│   ├── profile.js         # Dashboard (balance, plans + token bundle, earnings breakdown, rank card)
│   ├── miners.js          # Miner mgmt + Quick Install copy + history (v3.22.0)
│   ├── settings.js         # Settings (USD wallet, 33-lang dropdown, password)
│   ├── miner.js           # Miner docs: install/connect/delete + GitHub (v3.16.0)
│   ├── explorer.js        # Network explorer (not in main nav)
│   ├── leaderboard.js     # Top miners/users
│   └── admin.js           # Admin panel
├── components/
│   ├── Navbar.js          # Nav + auth dropdown + LanguageSwitcher
│   ├── EarningsBreakdown.js # 5-way earnings breakdown (profile, /miners, /miner; v3.29.0)
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
│   ├── server.js          # Entry point (v3.19.0)
│   ├── models.js          # AI models + per-model pricing
│   ├── cache.js           # Redis caching
│   ├── database/
│   │   ├── pool.js        # PostgreSQL connection
│   │   └── migrate.js     # DB migration (18 tables + resource columns)
│   ├── middleware/
│   │   └── auth.js        # JWT + Google OAuth
│   └── routes/
│       ├── auth.js        # Register/Login/Google
│       ├── chat.js        # LLM chat + payment chain + coverage wall
│       ├── miners.js      # Miner CRUD + model switch
│       ├── models.js      # Model list API
│       ├── payments.js    # NowPayments USD wallet (deposit/withdraw/IPN + plan/token IPN)
│       ├── plans.js       # Plan catalog (Plus/Pro/Max) + tier/token-bundle purchase
│       ├── token.js       # Balance snapshot
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

## Database Schema (18 Tables)

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
| miner_coin_earnings | Miner earnings per coin (`source`: wallet/tokens + `plan_type`: free/plus/pro/max breakdown, v3.28.0) |
| chat_sessions | Chat session groups |
| **daily_tokens** | Daily free allowance — signed-in users (reactivated in v3.27.0; removed v3.24.0) |
| **miner_daily_credit** | Free daily chat credit for miner hosts ($1/UTC-day, v3.25.0) |
| **daily_tokens_guest** | Daily free allowance — guests, keyed by client IP (v3.27.0) |
| **user_plans** | Active subscription tiers (`plus`/`pro`/`max`: 10M/30M/80M tokens/day, v3.28.0; plus since v3.27.0) |
| **plan_purchases** | Plan/token invoice claims — IPN exactly-once idempotency (`plan_type`: plus/pro/max/tokens) |
| **user_token_balances** | Prepaid token pot — $1 = 1M tokens, never expires (v3.28.0) |

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

## Daily Free Allowance & Plans (v3.27.0, tiers v3.28.0)

Every subject gets a **2,000,000-token free allowance per UTC day** —
signed-in users in `daily_tokens` (keyed by `user_id`), guests in
`daily_tokens_guest` (keyed by `req.ip`; `trust proxy` is set in
`server.js`). Paid tiers raise the cap for 30 days: **Plus $4.99 → 10M,
Pro $9.99 → 30M, Max $19.99 → 80M tokens/day** (`PLANS` in
`src/services/plans.js`). A separate **token bundle** ($1 = 1M, never
expires) tops up a prepaid pot (`user_token_balances`).

### Payment chain (one row-locked transaction in `chat.js`)

1. **Coverage pre-flight (before dispatch)**: free remaining > 0 OR miner
   credit remaining > 0 OR token pot > 0 OR wallet > 0? If *nothing*
   covers the next message → `402 { code: 'upgrade_required', free,
   plans, token_bundle, signed_in }` — the wall. Pre-flight query failures
   **never block** (availability first).
2. `chargeFreeTokens()` — the daily allowance upsert (row-locked, UTC-day
   rollover in the same statement). Covered → `payment_status: "free"`,
   no wallet debit, **no miner revenue share**.
3. `chargeMinerCredit()` (v3.25, signed-in only) → `"free_miner"`.
4. **Token pot** (v3.28, signed-in only) — `chargeTokenPot()` deducts the
   message's full token count all-or-nothing (`UPDATE … WHERE tokens >=
   $n RETURNING tokens`, race-safe). Covered → `"tokens"` +
   `token_balance_remaining`; the miner earns `cost × MINER_REVENUE_SHARE`
   (flat 90%) with `source = 'tokens'`, paid from bundle revenue.
5. USD wallet (signed-in only) — miner gets a **flat 90%** regardless of
   the payer's plan, with `source = 'wallet'` and the payer's
   `plan_type` recorded. A balance **below** the cost is drained in full
   (`debit = min(cost, balance)`) so the wallet reaches exactly $0 and the
   next message hits the wall instead of parking at dust forever.
   Covered → `"paid"` + `notice: "upgrade_recommended"` (frontend shows a
   once-per-UTC-day dismissible banner with the catalog).
6. Nothing covers (a race after pre-flight) → the reply, which already
   exists, is served as `"free"` — generation is never wasted or blocked.

### Plans (v3.28.0)

- `GET /api/plans` (auth optional) — `{ plans: [...with value metrics],
  plan, daily_limit, token_bundle, free_tokens?, token_balance? }`.
  Value metrics (`value_usd_day`/`value_usd_month`) price the allowance at
  the default model's catalog output price (`outputPrice()` ≈ $0.158/1M).
- `POST /api/plans/:tier/purchase` (auth) — validates `:tier` against
  `PLANS` (`400 INVALID_PLAN` otherwise), creates a NowPayments invoice
  with `order_id = <tier>-<userId>-<ts>` and a pending `plan_purchases`
  row (`plan_type` = tier).
- `POST /api/plans/tokens/purchase` (auth, before `/:tier` so `tokens`
  can never be read as a tier) — whole dollars `$1–$500` (at least
  `nowpayments.getMinUsdDeposit()`), `order_id = tok-<userId>-<ts>`,
  pending row with `plan_type = 'tokens'` + quoted token count.
- IPN (`POST /api/payments/deposit/webhook`): orders prefixed
  `plus-`/`pro-`/`max-`/`tok-` claim their `plan_purchases` row
  (`status = 'pending'` → `'completed'`, exactly-once under replay) and
  then `activatePlan(userId, tier)` or `creditTokens()`. Wallet credit
  only happens for legacy `krelz-…` deposit orders.
- `activatePlan()`: `expires_at = GREATEST(expires_at, now()) + 30 days`
  per tier row — renewing mid-cycle never loses days. Multiple active
  rows are allowed; `getActivePlan()` returns the best cap (no proration,
  no downgrade).
- Expiry is passive: `getActivePlan()` requires `expires_at > now()`, so
  an expired row silently falls back to the Free cap.
- Attribution: `miner_coin_earnings.source` + `.plan_type` are written on
  paid legs only; `GET /api/leaderboard/mine` aggregates them into
  `breakdown: {tokens, wallet, plus, pro, max}` for the profile.

### Rules

- Reset at UTC midnight: `last_reset_date = (now() AT TIME ZONE 'utc')::date`
  (identical contract to `minerCredit`); a stale row counts as unused.
- Allowance is counted in `tokensUsed` (the same output-token count that
  drives `cost`), so Free and pricing always agree.
- Balance endpoints expose `free_tokens: { limit, used, remaining }`,
  `plan: { name, active, expires_at }`, `plans: [...]` and
  `token_bundle: {..., balance}`; the chat response carries
  `free_tokens_remaining` and (on the pot leg) `token_balance_remaining`.
- Known limitations (documented in AUDIT): the 2M cap is a promise, not
  throughput — the CPU box sustains ~0.58M tokens/day, so one maxing user
  can saturate it until miners arrive; guests behind one NAT IP share an
  allowance.
- Tests: `backend/tests/free.allowance.test.js`, `backend/tests/plans.test.js`.

## Miner Free Chat Credit (v3.25.0)

Signed-in users with at least one miner in `online`/`busy` state get a
**$1.00 chat allowance per UTC day**. The credit is platform-funded: spending
it never debits the wallet and never credits a miner — the miner pool is only
touched by paid chats.

### Flow (within the v3.28.0 chain)

1. Runs **second** in the payment txn, after the daily free allowance
   (`chargeFreeTokens`) and before the token pot/wallet — an `INSERT … ON
   CONFLICT` upsert row-locks the credit row and rolls a stale
   (pre-UTC-today) usage to zero in the same statement, so parallel
   requests cannot overspend.
2. Covered → `payment_status: "free_miner"` — no wallet debit, **no
   `MINER_REVENUE_SHARE`**, no `miner_coin_earnings` row.
3. Not covered → the token pot, then the wallet path exactly as before
   (flat 90% miner share on paid legs).
4. Neither covers (race) → the reply is still served with
   `payment_status: "free"`; a subject that had *no* coverage at all was
   already walled by the pre-flight.
5. Guests never reach the credit (signed-in only).

### Rules

- Reset at UTC midnight: `last_reset_date = (now() AT TIME ZONE 'utc')::date`.
- Eligibility is checked **at charge time** — registering a miner row is not
  enough; it must actually be `online`/`busy`.
- Balance endpoints expose `miner_credit: { eligible, limit, used, remaining }`;
  the chat response carries `miner_credit_remaining`.
- Tests: `backend/tests/miner.credit.test.js`.

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

## Installer / Uninstaller Self-Cleanup (v3.10.0 install, v3.19.0 uninstall)

Install scripts auto-delete themselves after successful installation:

```bash
rm -f "$0"  # Last line of install-ubuntu.sh / install-redhat.sh
```

Uninstall scripts (`uninstall-ubuntu.sh` / `uninstall-redhat.sh`) self-delete
too, but only after the removal actually succeeded (options `1`/`2`). Cancel, an
invalid choice, or a failed step (`set -e` exits first) leaves the file on disk
so it can be rerun. The `head` check identifies the script by its header, so a
piped run — `curl | bash`, where `$0` is the shell itself — never deletes
anything that is not this script:

```bash
SELF="$0"
if [ "$SUCCESS" = "1" ] && [ -f "$SELF" ] && head -n 6 "$SELF" | grep -q "Krelz Network Miner - .* Uninstall"; then
  rm -f -- "$SELF"
fi
```

## Mobile UI (v3.23.0)

The site is designed phone-first. Invariants to keep when touching the frontend:

- **Keyboard vs. fixed frame** — the chat page is a `100dvh` `overflow-hidden` frame. iOS does *not* shrink the layout viewport when the keyboard opens, so while an `input`/`textarea` is focused `pages/index.js` measures `window.visualViewport` and writes `--app-vv-height` / `--app-vv-shift` on `<html>`; `pages/_app.js` consumes them as the frame's `height` / `translateY`. Always set `interactive-widget=resizes-content` and `viewport-fit=cover` in `_document.js`; never add `maximum-scale` (accessibility violation + iOS ignores it anyway).
- **No focus zoom** — iOS zooms any focused field under 16px. `styles/globals.css` forces `font-size: 16px !important` on `input/textarea/select` at ≤767px, which intentionally beats Tailwind's `text-sm`. New inputs are covered automatically; do not override with inline font sizes.
- **Touch targets** — any tappable control ≥40px (44px for primary nav ☰/✕). Hover-only affordances are banned on mobile (session delete is `md:hidden md:group-hover:flex`).
- **No transform ancestors for fixed overlays** — the mobile nav (`Navbar.js`) and chat sidebar drawer use `fixed` positioning; the sidebar closes on session pick (`loadSession`) and the nav closes on route change (`useRouter`).
- **Layout helpers** — composer groups use `md:contents` so mobile gets stacked rows while desktop keeps a single flex row; wallet grids are `grid-cols-1 sm:grid-cols-3`.
- **Safe areas** — bottom paddings use `pb-[max(1rem,env(safe-area-inset-bottom))]` (chat frame, footer, bottom-sheet modal).

## VPS Deployment

### Server Info

Host/IP, SSH user and key live in the private ops vault — never commit them to this repository.

| Item | Value |
|------|-------|
| IP / host | *(private vault)* |
| OS | Ubuntu 24.04 |
| User | *(non-root deploy user)* |
| Backend | /opt/krelz/backend |
| Frontend | /opt/krelz/frontend |

### Deploy Commands

```bash
# SSH into server (use your ops alias; do not commit hostnames/IPs)
ssh <deploy-host>

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

