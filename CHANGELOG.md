# Changelog

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
