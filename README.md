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
- llama3:8b model
- Krelz Miner

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Frontend   │────▶│   Nginx/SSL  │────▶│  Backend API  │
│   (Next.js)  │     │   (Reverse)  │     │  (Express)    │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                    ┌─────────────────────────────┼─────────────┐
                    │                             │             │
              ┌─────▼─────┐              ┌───────▼──────┐ ┌────▼────┐
              │ PostgreSQL │              │   Ollama     │ │  Redis  │
              │  (Docker)  │              │  llama3:8b   │ │ (Docker)│
              └───────────┘              └──────────────┘ └─────────┘
                                                              │
                    ┌─────────────────────────────────────────┘
                    │
              ┌─────▼─────┐         ┌──────────────────┐
              │ Miner App  │────────▶│ BSC Testnet/Main │
              │  (Bash)    │         │ Smart Contracts  │
              └───────────┘         └──────────────────┘
```

## Project Structure

```
krelz.xyz/
├── backend/                    # API Server (Node.js/Express)
│   ├── src/
│   │   ├── server.js          # Entry point
│   │   ├── database/
│   │   │   ├── pool.js        # PostgreSQL connection
│   │   │   └── migrate.js     # DB migration
│   │   └── routes/
│   │       ├── auth.js        # Authentication
│   │       ├── miners.js      # Miner management
│   │       ├── chat.js        # LLM chat
│   │       ├── payments.js    # Payments
│   │       ├── token.js       # KRELZ token
│   │       └── stats.js       # Network stats
│   └── package.json
├── frontend/                   # UI (Next.js + Tailwind CSS)
│   ├── pages/
│   │   ├── index.js           # Home page
│   │   ├── chat.js            # Chat with AI
│   │   ├── miner.js           # Miner install
│   │   └── explorer.js        # Network explorer
│   ├── components/
│   │   └── LanguageSwitcher.js # Language toggle
│   ├── i18n/
│   │   ├── translations.js    # EN/FA translations
│   │   └── LanguageContext.js  # i18n context provider
│   └── package.json
├── miner-app/                  # Miner install scripts
│   ├── install-ubuntu.sh      # Ubuntu/Debian installer
│   ├── install-redhat.sh      # RedHat/Fedora installer
│   └── src/                   # Miner source code
│       ├── main.js
│       ├── renderer/index.html
│       └── services/
├── contracts/                  # Smart Contracts (Solidity)
│   ├── contracts/
│   │   ├── KrelzToken.sol     # ERC-20 Token
│   │   └── StakingPool.sol    # Staking Pool
│   ├── scripts/
│   │   └── deploy.js          # Deploy script
│   ├── hardhat.config.js
│   └── deploy.sh
└── docs/                       # Documentation
    ├── architecture.md
    ├── tokenomics.md
    └── api.md
```

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

### Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network bscTestnet
```

## Internationalization (i18n)

The site supports English (default) and Farsi. To add a new language:

1. Add translations in `frontend/i18n/translations.js`
2. The language switcher appears on all pages
3. RTL is automatically handled for Farsi

## Tokenomics

| Parameter | Value |
|-----------|-------|
| Token Name | Krelz (KRELZ) |
| Total Supply | 1,000,000,000 |
| Decimals | 18 |
| Standard | BEP-20 (BNB Chain) |
| Platform Fee | 10% miner + 10% user |
| Burning | 1% transactions, 2% LLM, 5% penalties |

### Token Distribution

- **60%** Mining rewards
- **20%** Ecosystem
- **10%** Team (24-month vesting)
- **10%** Foundation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express, PostgreSQL, Redis |
| LLM | Ollama, llama3:8b |
| Blockchain | BNB Chain, Solidity 0.8.20, Hardhat |
| Server | Ubuntu 24.04, Nginx, Let's Encrypt |
| i18n | English (default), Farsi |

## License

MIT License

---

Built with love for the decentralized community
