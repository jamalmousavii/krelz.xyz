# Changelog

## [3.30.1] - 2026-10-04

Docs release: README and DEVELOP synced through v3.30.0; no code changes.

### Changed
- **README**: Features gained v3.29.0 (miner earnings surfaces on `/miner` + `/miners`, Navbar `⭐ Plans`) and v3.30.0 (pricing modal — `/#plans` opens the cards in any homepage state); model count fixed to **10** ("11 available" was wrong); Database Schema heading fixed to **20 tables** with the 7 missing rows added (`daily_tokens`, `miner_daily_credit`, `daily_tokens_guest`, `user_plans`, `plan_purchases`, `user_token_balances`, `schema_migrations`); duplicate `i18n/` block removed from the project tree; `PlansContent`/`PlansModal` added; frontend `.env.local` note in Development (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, see `frontend/.env.example`).
- **DEVELOP**: project tree gained `PlansContent.js`/`PlansModal.js` (v3.30.0); schema heading fixed to **20 tables** (+ `schema_migrations` row); removed the non-existent `python3 /tmp/deploy_v350.py` shortcut (replaced with the real rsync → build → restart flow); CLI section corrected — `cli.js` parses **no flags**, it reads `miner-app/config.json` (re-run the installer to change it); short notes on the v3.29.1 `apiFetch` 401 contract and the v3.30.0 pricing-modal architecture.

## [3.30.0] - 2026-10-04

Plans are now reachable from every homepage state via a pricing modal — `https://krelz.xyz/#plans` and the Navbar ⭐ Plans link no longer go dead in an active chat.

### Added
- **`PlansModal`**: backdrop overlay (ESC / ✕ / backdrop click close, body scroll lock, RTL-aware close button) showing the pricing cards anywhere on the homepage — deep link `/#plans`, `hashchange`, or the Navbar's `krelz:show-plans` event. Opens while catalog loads with a `Loading...` placeholder.
- **`PlansContent`**: the homepage pricing cards (3 tiers + token-bundle card + hints) extracted verbatim from `pages/index.js` — the inline empty-state section and the modal render identical markup from one source.

### Fixed
- **`/#plans` showed nothing**: the section existed only in the empty-state branch and only after a client-side catalog fetch, while logged-in users auto-restore their last session into an active chat (no `#plans` anchor at all) and guests hit an anchor scroll race against the async render. The Navbar `⭐ Plans` link (desktop + mobile) now dispatches the modal open event; closing clears the hash so repeat clicks work.

## [3.29.1] - 2026-10-04

Bugfix: an expired JWT silently emptied the dashboard (the "plans card is empty" report) and hid the homepage pricing section.

### Fixed
- **Expired token no longer renders an empty dashboard**: all authenticated page fetches (`profile`, `miners`, `miner`, `settings`, homepage catalog/sessions/purchases) now go through the shared `apiFetch` (`utils/api.js`) — a 401 clears the session and redirects home via `useAuth`, instead of the Plans card showing a header with zero rows, no balance/rank/breakdown.
- **`GET /api/plans` stays public on a bad token**: `routes/plans.js` dropped its local strict `optionalAuth` (which 401ed the snapshot when any Bearer was present) for the shared middleware `optionalAuth` — an expired/garbage token now degrades to anonymous, so homepage pricing always renders.
- Homepage `fetchCatalog` retries as a guest on 401; purchase buttons show the sign-in hint on session expiry; the homepage listens to `krelz:auth-changed` so a logout anywhere resets its auth state.

### Tests
- `auth.middleware.test.js`: new `optionalAuth` suite (no token / garbage token / wrong-secret token → anonymous 200; valid token → `req.user` populated). 123/123 green.

## [3.29.0] - 2026-10-03

Plans and miner earnings made visible everywhere: a public pricing section on the homepage, an earnings card on `/miner`, and the 5-way breakdown on `/miners`.

### Added
- **Homepage pricing section** (`pages/index.js`, empty state only, `#plans` anchor): public `GET /api/plans` renders three tier cards (price, tokens/day, ≈$ value, active badge + Renew when logged in) plus the token-bundle quick-buy card — buy buttons reuse the existing invoice flow; guests get a sign-in hint. Hidden once a chat starts (the 402 wall and upsell banner already cover in-chat purchases).
- **`/miner` earnings section**: "Your Earnings" card — flat **90%** of every paid message (wallet or token pot), free messages pay nothing, income depends on the payer's plan; a 5-source legend (🎟️ Token pot / 👛 Wallet / ⭐ Plus / 🚀 Pro / 👑 Max). Logged-in miners see their real numbers via `GET /api/leaderboard/mine`.
- **`/miners` breakdown card**: the account-level 5-way earnings breakdown renders above the miner list (fetches `/api/leaderboard/mine`), linking to the Dashboard.
- **Shared `components/EarningsBreakdown.js`**: the 5-row colored breakdown extracted from the profile rank card; now used by profile, `/miners` and `/miner`.
- **Navbar `⭐ Plans` link** (desktop + mobile) → `/#plans`.

### Changed
- Profile rank card now renders the shared component (identical markup, no visual change).
- New i18n keys (`home.pricing*`, `home.loginToBuy`, `nav.plans`, `miner.earnings*`) in en + fa; other languages fall back to en.

## [3.28.0] - 2026-10-03

Three paid tiers (Plus/Pro/Max), prepaid token bundles, and a 5-way miner earnings breakdown — flat 90% share on every paid leg.

### Added
- **Three-tier plan catalog** (`src/services/plans.js`): **Plus $4.99 → 10M tok/day**, **Pro $9.99 → 30M tok/day**, **Max $19.99 → 80M tok/day** (all monthly, 30 days, renewal extends from `max(now, expiry)`). One `user_plans` row per tier; a user may hold several and always gets the biggest cap — no proration. `activatePlan(userId, tier)` replaces `activatePlus`.
- **Token-value metrics**: every tier shows what its allowance is *worth* at the default model's catalog output price ($0.158/1M → Plus ≈ $1.58/day, $47.40/month) as `value_usd_day` / `value_usd_month` in `listPlans()` — on the 402 wall, the upsell banner and the profile plans card.
- **Token bundles** (`src/services/tokenBundles.js`, `POST /api/plans/tokens/purchase`): whole dollars **$1–$500 → 1M tokens per $1**, never expires, signed-in only. New table `user_token_balances`; invoice order id prefix `tok-`; credited additively behind the same `plan_purchases` exactly-once claim as plans. `chargeTokenPot()` is an all-or-nothing race-safe deduct (`UPDATE … WHERE tokens >= $n RETURNING tokens`).
- **5-way miner earnings breakdown**: `miner_coin_earnings` gained `source` (`wallet`/`tokens`) and `plan_type` (`free`/`plus`/`pro`/`max`) columns (historical rows backfilled as wallet/free). `GET /api/leaderboard/mine` returns `breakdown: {tokens, wallet, plus, pro, max}`; profile renders it as a colored 5-line list under the rank card. 🎟️ Tokens = pot spends (any payer), 👛 Wallet = wallet spends from Free users, ⭐/🚀/👑 = wallet spends from Plus/Pro/Max users.
- **Balance/catalog endpoints**: `GET /api/payments/balance` and `GET /api/token/balance` now return `plans: […]`, `token_bundle: {price_per_million, tokens_per_usd, min_usd, max_usd, balance}` and `plan.name` from the real tier; `GET /api/plans` is the public catalog snapshot.

### Changed
- **Payment chain** (one row-locked transaction): daily free allowance → $1 miner credit → **token pot** (new; `payment_status: "tokens"` + `token_balance_remaining`) → USD wallet → race fallback `free`. Pre-flight now checks all four legs (free OR credit OR pot OR wallet) before dispatching.
- **Flat 90% miner share on every paid leg** — wallet debits and pot spends alike; pot leg pays the miner `cost × 0.9` from bundle revenue. Free legs (daily allowance, $1 credit) still pay the miner nothing.
- **402 wall / upsell now carry the whole catalog**: `plans: [...]` + `token_bundle` instead of the single `plus` object; the wall renders three buy buttons plus a bundle quick-buy input, the once/day banner sells the entry tier.
- Re-priced Plus from $6.99 → **$4.99** to anchor the three-tier ladder; `plus:`-prefixed IPN order ids remain valid for old invoices (the webhook now dispatches on `plus|pro|max|tok` prefixes, wallet deposits keep `krelz-`).
- Profile: single Plus card replaced by a **Plans card** (3 rows, active tier highlighted, Choose/Renew per row) and a **Token bundle card** (balance, $ input, Buy); dashboard gained a **Token Pot** stat tile.

### Tests
- `tests/plans.test.js` reworked for the catalog (tier constants, value metrics, best-cap selection, `activatePlan` SQL, token-pot SQL, `plus/pro/max/tok/krelz` order-id parsing) + `free.allowance.test.js` on the Pro cap. Suite: **119 tests, 12 suites green**.

## [3.27.0] - 2026-10-03

Free daily allowance for everyone (2M tokens/day) + Krelz Plus (10M/day, $6.99/mo) — chat walls only subjects with zero coverage.

### Added
- **Daily free allowance** (`src/services/freeAllowance.js`): every subject gets **2,000,000 free tokens per UTC day** — signed-in users in the (re-activated) `daily_tokens` table, guests in the new `daily_tokens_guest` table keyed by client IP. Platform-funded: no wallet debit, no miner revenue share. For market context, the most generous public free tier (Cerebras) is 1M tokens/day — Free is 2× that.
- **Krelz Plus plan** (`src/services/plans.js`, `src/routes/plans.js`): **10,000,000 tokens/day for $6.99/month** (5× Free), bought with crypto through a NowPayments invoice (`POST /api/plans/plus/purchase`). Activation happens in the IPN webhook behind a `plan_purchases` exactly-once claim (replayed `finished` IPNs can never double-extend); renewal extends from `max(now, expires_at)` by 30 days. New tables: `user_plans`, `plan_purchases`.
- **Coverage pre-flight wall (`402 upgrade_required`)**: a subject with NO free allowance left, no miner credit and an empty wallet gets the Plus upgrade card instead of a wasted dispatch; guests get a sign-in hint (`signed_in: false`). Anyone with any coverage at all is served exactly as before. Pre-flight failures never block (availability first).
- **Upsell surfaces**: wallet-paid replies return `notice: "upgrade_recommended"` → once-per-UTC-day dismissible banner in chat; the 402 renders as a violet upgrade card with a purchase button; profile gains a **Free Today** stat card and a **Krelz Plus** card (active/expiry + Upgrade/Renew).
- Balance endpoints (`GET /api/payments/balance`, `GET /api/token/balance`) gained `free_tokens: {limit, used, remaining}`, `plan: {name, active, expires_at}` and `plus: {price, daily_tokens, interval_days}`; chat responses carry `free_tokens_remaining`. `GET /api/plans` (auth optional — pricing public, allowance block only with a token) returns the full plan snapshot.

### Fixed
- **Every finished NowPayments IPN was silently ignored (regression since v3.18.0)** — the webhook gate also required `processIPN().status === 'finished'`, but the success branch normalizes to `'completed'`, so deposits *and* Plus activations returned `ignored` and never credited/activated. The gate now checks `result.success` alone (that branch only runs for `finished`). Found by live end-to-end verification during the 3.27.0 deploy.
- **Plus activation crashed with `column "id" does not exist`** — the `plan_purchases` claim did `RETURNING id` but the table's key is `order_id`. Now `RETURNING order_id`.

### Changed
- **Payment chain** (one row-locked transaction): daily free allowance (tokens) → miner credit ($1, v3.25) → USD wallet (90% miner share; a balance below the cost is **drained in full** so the wallet can actually reach $0 and the wall becomes reachable) → race fallback still serves an already-generated reply as `free`.
- v3.26's blanket "chat is never blocked" is now scoped: **zero-coverage subjects are walled before dispatch**; partial coverage never blocks.
- `invalidateCache('/api/payments/balance')` runs after every settlement (the payload now includes `free_tokens`).
- `nowpayments.createInvoice()` accepts an optional `description` (deposits unchanged).

### Tests
- `tests/free.allowance.test.js` (12) + `tests/plans.test.js` (13, incl. the IPN `finished`→`completed` regression) — allowance math, guest keying, UTC rollover upsert, cap/epsilon boundaries, Plus caps, renewal SQL, NowPayments order-id parsing. Suite: **105 tests, 12 suites green**.

### Deploy notes
- The VPS was downsized to 2 vCPU / 3.7GiB — `llama3.1:8b` OOMs on load, so local Ollama now runs **`qwen2.5:1.5b` (~1GB)** and the unusable `llama3.1:8b` tag was removed from the server (re-pull after any RAM upgrade; the catalog/UI is unchanged — requests for any model fall back to the available local model with a warn log). GPU miners are unaffected.

## [3.26.0] - 2026-09-29

Chat is never blocked — empty wallets are served for free.

### Changed
- **Payment pre-flight and `402` removed from `chat.js`**: a signed-in user with an empty wallet and no miner credit still gets a full reply — settlement falls through to `payment_status: "free"` (no wallet debit, no miner revenue share).
- Payment order unchanged: free miner credit → wallet (90% miner share on paid chats only). Guests unchanged.
- Removed `hasWalletFunds()` and every `insufficient_balance` / `402` response (chat no longer returns `402` at all).

### Tests
- Suite green: 80 tests, 10 suites.

## [3.25.0] - 2026-09-29

Free daily chat credit for miner hosts — platform-funded, miner pool untouched.

### Added
- **Miner free chat credit** (`src/services/minerCredit.js`): signed-in users with a miner in `online`/`busy` state get a **$1.00 chat allowance per UTC day**. Spent first inside the payment transaction as `payment_status: "free_miner"` — no wallet debit, **no miner revenue share** (paid chats remain the only source of miner revenue).
- New table `miner_daily_credit` (row-locked upsert + UTC-day rollover inside the payment txn).
- `miner_credit: { eligible, limit, used, remaining }` on `GET /api/payments/balance` and `GET /api/token/balance`; `miner_credit_remaining` on the chat response.
- Profile shows a **Mining Free Credit** card while eligible; chat messages served on credit get a 🎁 badge.

### Changed
- Chat pre-flight: an empty wallet no longer 402s when free miner credit is available; the 402 message now mentions the credit.
- `invalidateCache('/api/payments/balance')` also runs when credit is charged.

### Tests
- `tests/miner.credit.test.js` — 9 unit tests (eligibility, allowance math, charge/refuse, UTC rollover upsert, float-epsilon boundary). Suite: 80 tests, 10 suites green.

## [3.24.0] - 2026-09-29

Free Cloud AI removed end-to-end — the site no longer serves inference for free (guest chat aside).

### Removed
- **`free-cloud-ai` model** — dropped from the catalog (`models.js`), chat model dropdown, miner model list and `findMinerForModel` (11 → 10 models).
- **Free provider round-robin** (Groq / OpenRouter / Cerebras / Cloudflare) — both the `free-cloud-ai` backend and the silent fallback that let **paid** models answer from free provider keys with `cost = 0` when no miner was online. Provider env keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `CLOUDFLARE_*`) are no longer read and were removed from the server `.env`.
- **Daily free tokens** — the 1,000-token/day allowance (`daily_tokens` table reads/writes, `FREE_DAILY_TOKEN_VALUE`, `payment_status: 'free_daily'`, the `/api/token/balance` `daily_tokens` field, the profile "Daily Free Tokens" card and all its i18n keys). The DB table itself is kept (no destructive migration) but nothing reads it.
- **`⚡ via provider` source badge** — replies now only show `⛏️ via miner` / `💻 local`; API responses no longer carry `provider_name` and `source` is `miner | local`.

### Changed
- **Inference sources**: miner (WebSocket) → **local Ollama** → explicit failure. Ollama is now installed on the server (`llama3.1:8b`, CPU) as the interim source until a GPU miner reconnects; local calls got `timeout: 120s` and `num_predict: 768` so CPU replies can't pin all cores.
- **Payment is wallet-only**: signed-in users are pre-flighted with `Wallet balance is empty` (402) and charged the full cost from their USD wallet in one row-locked transaction; miner revenue share (90%) unchanged. `payment_status`: `free` (guest) | `paid` | `insufficient_balance`.
- **Guest (anonymous) chat stays free** with its existing per-IP rate limit — unchanged by design.
- No miners online + Ollama down → explicit `503 No inference source available`; image/voice with no capable miner → `409 MEDIA_NO_MINER` (as before).
- `/miner` how-it-works copy rewritten (top up wallet → choose model → pay per message); `userStep2/userStep4` updated in en+fa, other languages fall back to English.

### Tests
- 77 → 71 (removed the daily date-key suite and the `free-cloud-ai` miner-free case).

## [3.23.0] - 2026-09-28

Mobile-first UI pass — the whole site is now usable on a phone.

### Fixed
- **On-screen keyboard covered the chat composer** (worst iOS bug): while a field is focused, `visualViewport` measurements are applied to the fixed chat frame (`--app-vv-height` / `--app-vv-shift` in `_app.js`, driven from `index.js`), so the input sits *above* the keyboard instead of under it; viewport meta now has `interactive-widget=resizes-content` + `viewport-fit=cover`.
- **iOS focus zoom** — every input/textarea/select is forced to ≥16px on screens ≤767px (`globals.css`, deliberate `!important` so Tailwind's `text-sm` cannot regress it); inputs never zoom again.
- **Session sidebar squashed the chat column** to ~0 width on phones — it is now an overlay drawer (85% width + backdrop, closes on session pick ✕/backdrop).
- **Session delete button was hover-only** (invisible on touch) — always visible on mobile, hidden on desktop until hover/focus; 40px target.
- Long URLs / unbreakable strings no longer overflow message bubbles (`break-words whitespace-pre-wrap` + `overflow-x-hidden` on the message list) or the profile email (`break-all`).
- Hamburger menu was clipped by the fixed `100dvh` chat frame — mobile nav is now a **full-screen overlay** (own header + ✕, scrollable, auto-closes on route change).

### Changed
- **Touch targets ≥40px** across chat (☰ ✕ ✏️ attachment-chip ✕), navbar (44px ☰/✕), tabs and quick-nav pills; `touch-action: manipulation` + tap-highlight removed on interactive elements.
- **Mobile composer layout** — phone: `[model | 📎🎙]` + `[input | send]` rows; `md:contents` restores the exact single-row desktop layout.
- Hero input no longer auto-focuses on phones (keyboard popped open during first paint); desktop keeps autofocus.
- Model dropdown / language dropdown heights capped with `dvh` units so they fit above the keyboard.
- Wallet stat cards stack (`grid-cols-1 sm:grid-cols-3`) instead of overflowing at 320px; miner guide modal is a scrollable bottom sheet (`max-h-[85dvh]`).
- **Safe-area insets** for notched phones: chat bottom padding and footer use `env(safe-area-inset-bottom)`.

## [3.22.0] - 2026-09-28

### Added
- **Uninstall now unregisters** — `uninstall-ubuntu.sh` / `uninstall-redhat.sh` read the saved `miner_token` from `config.json` before deleting it and call the new `POST /api/miners/unregister` (idempotent, token-authenticated, closes any live WS). The miner row leaves **My Miners** immediately instead of lingering as offline forever.
- **Miner History section** on `/miners` — `GET /api/miners/history` (authenticated) lists uninstalled miners and miners with no contact for >10 days, each with name/GPU, tasks, pool earnings, added date, removed/last-seen date and a reason badge (`uninstalled` / `offline>10d`), plus an all-time summary (miners added, total tasks, total earned).
- **Automatic archiving of stale miners** — `GET /api/miners/mine` now excludes miners whose `COALESCE(last_seen, created_at)` is older than 10 days (no cron: a filter at query time; a reconnecting miner returns to the active list automatically).

### Changed
- `miners.last_seen` column (touched only by real miner traffic: WS auth, heartbeats, `/setup`, HTTP heartbeat — not by rename/remove) + `miners.uninstalled_at` set by both the dashboard 🗑️ button and the uninstall script; backfilled from `updated_at` on migrate.

## [3.21.0] - 2026-09-28

### Added
- **Leaderboard rank card in the user dashboard** — `GET /api/leaderboard/mine` (authenticated, `RANK()` over miners with ≥1 task) powers a new 🏆 card on `/profile`: personal rank (`#N of total`), GPU, tasks, earnings and a link to the full leaderboard. Shown **only to users with at least one miner**; a miner with no completed tasks sees an explicit "not ranked yet" hint instead of a number. Dashboard fetches `/api/miners/mine` first to decide visibility.

## [3.20.0] - 2026-09-28

Attachments & voice notes in chat (multi-modal end-to-end: UI → API → WS → miner → Ollama).

### Added
- **📎 File attach** — one attachment per message: image (client-compressed to ≤1280px JPEG), PDF (text extracted server-side, 60k char cap) or text file (≤1.5MB). File text is prepended to the prompt so **any** chat model can answer file questions; images need a vision model (`qwen3-vl:8b`, `gemma4:12b`)
- **🎙️ Voice notes** — microphone button (audio-capable models only: `gemma4:12b`), MediaRecorder → client-side 16 kHz mono WAV encoder (`frontend/lib/audio.js`), 60s cap; Ollama receives audio in the same `images` slot (RIFF auto-detect)
- **Capability gating in the UI** — 📎 disabled for embedding models; sending an image with a non-vision model or voice with a non-audio model is blocked inline with an explicit reason (the attachment is never silently dropped)
- **Explicit backend errors** — `ATTACHMENT_UNSUPPORTED` / `ATTACHMENT_TOO_LARGE` / `ATTACHMENT_INVALID` / `ATTACHMENT_EMPTY` / `ATTACHMENT_PARSE_FAILED` / `AUDIO_FORMAT` (400) and `MEDIA_NO_MINER` (409) when no capable miner/local model is online
- **`vision` / `audio` flags on all catalog models** (`backend/src/models.js`), exposed through `GET /api/models`
- **Media-aware miner dispatch** — miners advertise `app_version` at auth (stored in `miners.app_version`); images/voice are only routed to miners ≥ 3.20.0, which parse the new e2e-encrypted `attachment` field on `task` messages (`tasks.media` JSONB + `tasks.prepared_prompt` keep polling-mode delivery exact)
- **History rendering** — user bubbles show the image thumbnail or a 📄/🎙️ chip loaded from `tasks.media`

### Changed
- **Request body limit** raised to 8 MB (`express.json`) + `client_max_body_size 8m` in nginx (was 1 MB — attachments would 413)
- Local-Ollama fallback uses `/api/chat` with `images[]` for media; free-cloud providers are skipped for image/voice (they cannot serve them) → explicit error instead of a silent drop
- Miner `ollama.chat()` added alongside `generate()`; `onTask(prompt, model, media)` in both CLI and Electron entry points
- Tests: 43 → 74 (`validate.attachment`, `attachments` incl. real pdf-parse extraction, `ws.media` gating/dispatch); Jest now runs with `--experimental-vm-modules` (pdfjs-dist needs dynamic import)

## [3.19.1] - 2026-09-28

Chat UX pass (fit-to-viewport frame) + version display sync.

### Added
- **Fullscreen chat frame** — the chat route is now a fixed frame of exactly one viewport (`100dvh` with `100vh` fallback, `overflow-hidden` wrapper in `_app.js`): the page itself never scrolls at any resolution or browser zoom; only the message list scrolls. Footer stays as a slim line inside the frame
- **Viewport-change re-snap** — `resize`/`orientationchange` snaps the chat back to the newest message

### Fixed
- **Chat input lost focus after every send** — both inputs were `disabled={loading}`, which blurred them; they now stay enabled (re-entry guarded in `sendMessage`) and focus returns when a reply lands or a session loads, never stealing focus from the subject-rename field or the model dropdown
- **Latest message not always visible** — replaced `scrollIntoView` racing the layout with a container-based `scrollToBottom`: instant (double `requestAnimationFrame`) on session load/refresh, smooth on every new message, even when the user had scrolled up
- **Removed the `calc(100vh - 130px)` magic height** — layout is pure flex now (`flex-1 min-h-0` chain through sidebar/chat area/messages with `overscroll-contain`), so navbar/footer height estimates can no longer cut the input off the screen

### Changed
- **Version display synced to 3.19.1** — site footer in all 33 locales, miner install/uninstall banners (`KRELZ_VERSION`), `frontend`/`miner-app` package versions, `docs/api.md`, README/DEVELOP annotations

## [3.19.0] - 2026-09-26

Comprehensive security / correctness / stability pass. Full findings with `file:line` in **[docs/AUDIT.md](docs/AUDIT.md)**; API reference rewritten in **[docs/api.md](docs/api.md)**.

### Security
- **Password reset no longer leaks the token** — reset links are emailed via Resend (`RESEND_API_KEY`); the token is never returned in JSON or logged. Without an email provider configured in production the endpoint answers **503 before any account lookup** (cannot be used to enumerate accounts). New page `/reset-password`
- **Admin is re-checked against the database** on every admin route (60s cache, fail-closed); `role=admin` is rejected at self-registration; JWT verified with `algorithms: ['HS256']` only (`alg:none` rejected)
- **Response cache can never serve authenticated responses** — requests with `Authorization` or `req.user` bypass it; `/api/miners` (carries `miner_token`) is no longer cached
- **Public miner endpoints no longer leak wallets** — `GET /api/miners` is bounded and drops `wallet_address`/`miner_token`; `GET /api/miners/:id` is owner-only
- **IPN fail-closed** — HMAC-SHA512 + `timingSafeEqual`; rejected when `NOWPAYMENTS_IPN_SECRET` is unset
- Guest chat gets its own **6 req/min/IP** limiter; dedicated **10/15min** limiter on forgot/reset password; WS client IP no longer trusts `cf-connecting-ip`
- nginx: `limit_req`/`limit_conn` in front of `/api` and a **Content-Security-Policy**; server IP/SSH removed from `DEVELOP.md`
- nginx resolves the **real client IP behind Cloudflare** (`set_real_ip_from` + `real_ip_header CF-Connecting-IP`, single-value `X-Forwarded-For`) — before this every request was keyed by a CF *edge* IP, so per-IP rate limits bound to random edge addresses instead of users (and one busy edge could throttle unrelated visitors together)

### Fixed
- **Daily free allowance reset on every request** (unlimited free usage) — `pg` now returns `DATE` as a string *and* `todayKey()`/`toDateKey()` use one consistent calendar (`backend/src/database/pool.js`, `routes/chat.js`). Regression-tested
- **Payment webhook idempotent** — deposits store `order_id`; the webhook claims the pending row in a transaction, credits the **stored** amount, and answers `deduped` on replay (no double credit)
- **Withdraw / `payments/deduct` are single-statement atomic** — no concurrent double-spend
- **Miner earnings only when the miner actually served the task** (cloud/local fallback no longer credits `miners.earnings`); chat pre-flight returns **402** before any inference when allowance + wallet are empty
- Default model disagreement (`llama3:8b` vs `llama3.1:8b`) consolidated into `DEFAULT_MODEL`
- `/api/models` reports models missing from the catalog as `unknown_models` instead of inflating another badge
- `heartbeat` whitelists `status`, clamps `tasks_completed`, cannot resurrect a removed miner; `/api/miners/setup` returns 401 for `removed` miners
- `/health` returns **503** when Postgres is down (+ new `/health/live`); graceful shutdown drains HTTP/WS and closes pool/Redis; `unhandledRejection`/`uncaughtException` handled
- `migrate.js` exits non-zero on failure; adds `coin_deposits.order_id` + indexes (additive, idempotent)
- `migrate.js` now loads `.env` before `./pool` reads `DATABASE_URL` — a standalone `node src/database/migrate.js` (the documented deploy step) used to fall back to the local-dev DSN and die with `password authentication failed for user "krelz"`
- Logger `version` field reads `package.json` instead of a hardcoded `3.18.4` fallback (systemd/unit runs don't set `npm_package_version`)
- Install menu no longer offers `qwen3.6:27b` (not in the catalog) and preset `f)` no longer drops a model
- `systemd` unit runs the headless CLI (not Electron) as a hardened unit without a hardcoded wallet
- Frontend: render-time redirects replaced by `useAuth`, 401 handling in `utils/api.js`, `Number(x).toFixed()` guards, `404`/`500` pages, `next/link` navigation, env-driven API rewrite, generated favicon/PWA/OG assets

### Added
- **43 unit/integration tests** (`backend/tests/`, jest + supertest, no DB/Redis required) and **GitHub Actions CI** (syntax check, tests, `next build`, `next lint`, install-script syntax)
- `docs/AUDIT.md` (full report), rewritten `docs/api.md`
- `scripts/generate_assets.py` (reproducible PWA/social assets), `DISABLE_CACHE=1` switch for local/test runs
- **Uninstall self-cleanup** — `uninstall-ubuntu.sh`/`uninstall-redhat.sh` delete themselves after a successful removal (cancel/invalid choice/failed step keeps the file; content-checked so a piped `curl | bash` run deletes nothing else)

## [3.18.4] - 2026-09-26

### Security
- **Miner TLS verification (fixed)** — removed `rejectUnauthorized: false` + `checkServerIdentity` override; the miner now fully verifies the server certificate chain and hostname (MITM protection)
- **Certificate pinning** — miner pins **ISRG Root X1 + X2** (Let's Encrypt roots for `krelz.xyz`); a rogue CA cannot forge the origin cert. Escape hatch: `KRELZ_PIN=0` → system trust store
- **WS auth rate limit** — max **10 failed auth attempts per IP / 5 minutes**, then the connection is closed (token brute-force protection); successful auth resets the counter
- **Token hygiene** — malformed tokens rejected **before** any DB query (`/^kz_[0-9a-f]{32,64}$/`)
- **E2E payload encryption** — task `prompt` and `response` encrypted with **AES-256-GCM**; key = HKDF-SHA256(`miner_token`, salt `krelz-e2e-v1`, info `task-payload`). Capability handshake: miner sends `e2e:1` in auth, backend echoes in `auth_ok`; old miners stay plaintext (backward compatible)
- **Task result forgery stopped** — `task_result` now requires an authenticated WS session **and** the task must be assigned to that miner; e2e responses are decrypted server-side (tamper/wrong-key → rejected)
- **HTTP heartbeat authenticated** — `PUT /api/miners/:id/heartbeat` now requires the miner's own `miner_token` (was fully unauthenticated — anyone could update miner status/earnings)
- **Loopback bind** — backend API (`:3000`) + WS (`:8444`) listen on `127.0.0.1` only; nginx is the sole public entry point (other services on the VPS can no longer reach them)

## [3.18.3] - 2026-09-24

### Fixed
- **Miner WS replace-loop (root cause)** — two clients with the same `miner_token` were kicking each other every ~5s: backend now **rejects external newcomers** while an existing session is healthy (<45s heartbeat); only **localhost** may replace a healthy socket. `isLocalClient` trusts only `_clientIp` (not `socket.remoteAddress`, which is always `127.0.0.1` behind nginx)
- VPS miner connects **directly** to `ws://127.0.0.1:8444/ws` (no Cloudflare hairpin); external miners keep `wss://krelz.xyz/ws`
- Miner WS client skips TLS/`servername` options when `API_WS_URL` is local

## [3.18.2] - 2026-09-24

### Fixed
- **Miner WS reconnect loop** — replaced sockets no longer stack (`connect` closes previous, single reconnect timer, socket-scoped handlers)
- **Idempotent miner auth** — same-socket re-auth no longer replaces itself / resets `current_model`
- Immediate heartbeat after `auth_ok` so DB `current_model` updates without waiting 30s
- Miner `config.json` on VPS: token synced from DB, `default_model=llama3.1:8b`

## [3.18.1] - 2026-09-24

### Fixed
- **Chat model badge** — online miner with removed/unknown `current_model` (e.g. `qwen3.6:27b`) now credits `llama3.1:8b` so dropdown shows green ✅
- `/api/models` + `/api/stats` cache invalidated on WS auth / heartbeat / disconnect / cleanup (was stale up to 60s)
- `/api/models` TTL 60s → 15s
- Model dropdown: `free-cloud-ai` always selectable (was greyed out when badge was 0)

### Added
- Chat response source badge: `⛏️ via miner #N` / `⚡ via provider` / `💻 local`
- `miners_online_total` on `GET /api/models`

### Changed
- **Default chat model → `llama3.1:8b`** (uses online miner; `free-cloud-ai` secondary option)
- MODELS_LIST order: `llama3.1:8b` first, then `free-cloud-ai`
- Version bumped to 3.18.1

## [3.18.0] - 2026-09-24

### Added
- USD-only wallet: single `$` balance (available / earned / spent) on Settings + Profile
- Top Up: enter USD amount → NowPayments hosted checkout (customer picks crypto coin/network)
- Withdraw: **USDT TRC-20 only**, min **$5**, fee paid by sender ($0.50 + 0.5%, min $1)
- Deposit records + history denominated in USD

### Fixed
- **IPN webhook never credited balances** — `processIPN` was missing `await` (`payments.js:84`)
- Clear 503 when `NOWPAYMENTS_IPN_SECRET` missing (was generic 500)
- Ollama empty-list guard: skip local fallback when no models / tags fail → cloud providers
- Groq model map: removed invalid `qwen3.6:27b` entry
- Miner errors surfaced in 503 response (no longer silently swallowed)
- 503 message distinguishes “no API keys configured” vs “no providers”

### Changed
- **Removed Web3 wallet connect** (MetaMask / Trust) from Settings
- **Removed 7-coin tab UI** — wallet is USD-only
- Chat paid portion deducts from **`USD`** balance (not per-coin)
- `POST /api/payments/deposit/create` takes `amount_usd` (coin optional pre-select)
- Invoice omits `pay_currency` by default → customer chooses on NowPayments page
- IPN credits **`price_amount` (USD)** to `user_coin_balances.coin='USD'`
- Default chat model → **`free-cloud-ai`** (miners may not hold large models)
- Removed `qwen3.6:27b` from catalog, MODELS_LIST, install-script defaults (→ `llama3.1:8b`)
- Install script default choice → option 4 (`llama3.1:8b`)
- `findMinerForModel`: skip miner dispatch for `free-cloud-ai`
- Version bumped to 3.18.0

### Notes
- NowPayments keys live in VPS `/opt/krelz/backend/.env` only (not in git)
- Existing multi-coin balances should be migrated to USD once (SQL one-time)
- `user_balances` (legacy KRELZ) kept for daily-token accounting; Profile money cards use USD
- Free AI provider keys (GROQ/OPENROUTER/…) still empty — required for `free-cloud-ai` fallback
- Chat inference on tiny (3.7GB) miner still weak without capable GPU miner + API keys

## [3.16.0] - 2026-09-24

### Added
- **33 languages** with country flags (EN, FA, AR, HE, UR, FR, DE, ES, PT, IT, NL, RU, UK, PL, TR, ZH, ZH-TW, JA, KO, HI, BN, ID, VI, TH, MS, SV, DA, FI, NO, CS, RO, EL, HU) — full translation of all keys
- Browser-language auto-detection on first visit (`navigator.languages`); fallback English if unsupported
- Session-persisted user language choice (`sessionStorage['krelz-lang']`) — stays while user is on the site
- Language dropdown with flag + native name in Navbar (desktop + mobile) and Settings
- Global `Footer` on every page: one sentence containing the version (`footer.sentence` + `{version}`)
- `/miner` docs sections: always-visible Install, Connect (with token), Delete/Uninstall + GitHub links
- `/miners` Quick Install card with Ubuntu/RedHat copy buttons (`--token YOUR_TOKEN`)
- Guide modal step 5: how to remove a miner
- RTL support generalized to `fa`, `ar`, `he`, `ur` via `isRtl()` helper

### Changed
- Navbar: removed Chat and Explorer menu items (site logo/name already opens chat)
- `/miner` model catalog is read-only (interactive copy buttons moved to `/miners`)
- Settings language section: dropdown with flags replaces EN/FA buttons; uses context `changeLang` (no full reload)
- Language files split: `i18n/translations/<code>.js` + `translations.js` re-exports `translations`, `LANGUAGES`, `isRtl`, `detectLanguage`
- Page roots use `flex-1` inside `_app` flex column so the global Footer fits without extra scroll
- Active-chat height accounts for footer (`calc(100vh - 130px)`)
- Version bumped to 3.16.0 (server.js health, logger, package.json, i18n `home.version`)

### Removed
- Chat and Explorer from main navigation (Explorer page still reachable at `/explorer`)

## [3.15.0] - 2026-09-23

### Added
- Chat-first homepage: landing page IS the chat — centered "🚀 Krelz Network" + model dropdown + input card (no credit display in chat input)
- After starting a chat: left history sidebar (sessions with rename/delete/new chat when logged in), messages area, input pinned to bottom
- `/miners` page — full miner management (guide modal, add-miner flow, per-miner cards with rename/delete/status/GPU/RAM/resource bars/model select/uptime/tasks/earnings, token show/hide/regenerate)
- `/settings` page — Web3 wallet connect/disconnect, language toggle, crypto wallet (7 coins, deposit/withdraw/history), password set/change
- Shared `frontend/utils/auth.js` `authHeaders` helper
- Chat errors now surface API `data.error` instead of generic "Error receiving response"

### Changed
- `/chat` now redirects to `/` (chat lives on homepage)
- `/profile` slimmed to dashboard only (identity, balance 3-cards, daily tokens progress, logout, quick-nav to /miners and /settings)
- Light sky-blue theme across ALL pages: Navbar, LanguageSwitcher, ErrorBoundary, index, profile, miners, settings, miner, explorer, leaderboard, admin
- Navbar restructured: Chat / Explorer / Miner / Leaderboard links + user dropdown with Dashboard / Miners / Settings / Logout; auth forms (login/signup/forgot/reset) + GoogleLogin
- `html` bg `#f0f9ff`, theme-color `#e0f2fe`
- Version bumped to 3.15.0 (server.js health, logger, package.json)

### Notes
- Install scripts self-delete (`rm -f "$0"`) was already present since v3.10.0 — verified, no change needed
- Chat inference bug (27b model on 4GB miner + dead fallbacks) still open — deferred

## [3.14.0] - 2026-09-23

### Added
- Miner guide modal: shows on first profile visit and every time before Add Miner (install + connect steps, EN/FA)
- Two-step Add Miner: name prompt (default `miner1`) → create → show token + install command
- Single-use token display: `token_used_at` column; token hidden from profile after first `/setup` or WS auth
- `PUT /api/miners/mine/:id/token` — rotate token for reinstalling the same machine (clears `token_used_at`)
- "Generate new token" button per miner card when token already used
- Add Miner button always visible (even with 0 miners)

### Changed
- `POST /api/miners` empty/missing name defaults to `miner1` (was NULL)
- `GET /api/miners/mine` returns `miner_token: null` when already connected (single-use display)
- Removed legacy account-token section from profile (per-miner tokens only)
- Cache invalidated on create/delete/rotate/setup/WS-auth
- Version bumped to 3.14.0

## [3.13.0] - 2026-09-22

### Added
- Per-miner unique tokens: each server-miner gets its own token (unlimited per user)
- `POST /api/miners` — create miner + token from profile (Add Miner button)
- Per-card token display + copy in profile dashboard
- `miner_token` column on miners table (migration with backfill + unique index)

### Changed
- `/setup` and WS `auth` bind directly by per-miner token (token IS identity)
- Legacy account token works only with exactly 1 active miner, else 409 with guidance
- Removed miners rejected at WS auth in all paths; legacy paths never revive removed rows
- Version bumped to 3.13.0

### Fixed
- Second machine no longer overwrites the first miner; connection fights between same-identity clients resolved (newest-wins + miner self re-auth)
- Miner heartbeat restarted after every reconnect (`ensureHeartbeat` on `auth_ok`) — idle WS no longer dropped after ~2 min

## [3.12.0] - 2026-09-21

### Added
- Multi-miner accounts: unlimited miners per user (one row per `machine_id`), no cap
- `machine_id` + `name` columns on miners table (migration with backfill)
- `DELETE /api/miners/mine/:id` — soft delete (history preserved)
- `PUT /api/miners/mine/:id` — rename miner
- `GET /api/miners/mine` now returns `miners` array (plus legacy `miner` field)
- `PUT /api/miners/mine/model` accepts `miner_id` for per-miner model switch
- WS auth accepts `machine_id`/`name`; removed miners get `auth_error`
- Install scripts: miner name prompt (`--name` flag), persistent `machine_id` in config.json
- Profile dashboard: miner cards list with rename/remove/per-miner model + EN/FA translations
- Version bumped to 3.12.0

### Fixed
- Second machine with same email/token no longer overwrites the first miner

## [1.2.0] - 2026-09-12

### Added
- Model selection in Chat page (60+ models from Ollama library)
- Model selection in Miner page (choose which models to mine)
- /api/models endpoint (filter by category: chat, code, vision, embedding)
- models column on miners table (JSON array of supported models)
- current_model column on miners table
- Interactive install scripts (model selection during installation)
- config.json saved during install (selected models)
- OllamaService.setModel() and pullModel() methods
- Model categories: Chat, Code, Vision, Embedding

### Changed
- Chat page: model dropdown sends selected model to backend
- Miner page: multi-select checkboxes for model selection
- Install scripts: interactive menu (1-9, 0 for custom)
- OllamaService: configurable model (no longer hardcoded)
- Translations updated with model selection keys (en/fa)
- Version bumped to 1.2.0

### Fixed
- Backend chat route now properly uses user-selected model

## [1.1.0] - 2026-09-11

### Added
- Internationalization (i18n) with English (default) and Farsi
- LanguageSwitcher component on all pages
- Quick Install scripts for miners (Ubuntu/Debian + RedHat/Fedora)
- Install-ubuntu.sh - one-click installer for Debian-based systems
- Install-redhat.sh - one-click installer for RHEL/Fedora systems
- RTL support for Farsi language

### Changed
- README.md and DEVELOP.md rewritten in English
- Miner page redesigned: replaced AppImage download with install scripts
- All pages updated with i18n translation keys
- Default language changed from Farsi to English

### Removed
- AppImage download link (replaced by install scripts)

## [1.0.0] - 2024-01-01

### Added
- Initial project structure
- Backend API (Express + PostgreSQL)
- Frontend (Next.js + Tailwind CSS)
- Miner Electron app
- Smart contracts (KrelzToken, StakingPool)
- Basic documentation
