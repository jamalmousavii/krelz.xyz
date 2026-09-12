# Changelog

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
