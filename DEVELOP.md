# Krelz Network - Development Guide

## Prerequisites

- Node.js 18+
- npm
- Docker (optional, for PostgreSQL/Redis)
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

# Contracts
cd contracts
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
Next.js frontend with Tailwind CSS and i18n support.

```
frontend/
├── pages/           # Next.js pages
├── components/      # React components
├── i18n/            # Internationalization
│   ├── translations.js   # EN/FA text
│   └── LanguageContext.js # Language provider
└── styles/          # CSS
```

### backend/
Node.js/Express API with PostgreSQL.

```
backend/
├── src/
│   ├── server.js       # Entry point
│   ├── models.js       # Available LLM models config
│   ├── database/       # DB connection & migrations
│   └── routes/         # API routes (chat, miners, models, ...)
└── package.json
```

### miner-app/
Miner install scripts and source code.

```
miner-app/
├── install-ubuntu.sh   # Ubuntu/Debian installer
├── install-redhat.sh   # RedHat/Fedora installer
└── src/                # Miner source (Electron)
```

### contracts/
Solidity smart contracts for BNB Chain.

```
contracts/
├── contracts/          # Solidity files
├── scripts/            # Deploy scripts
├── hardhat.config.js   # Hardhat config
└── deploy.sh           # One-click deploy
```

## Internationalization (i18n)

### How it works

- Translations are in `frontend/i18n/translations.js`
- Language is stored in localStorage
- Default language is English
- RTL is auto-applied for Farsi

### Adding a new language

1. Open `frontend/i18n/translations.js`
2. Add a new key (e.g., `ar` for Arabic):

```javascript
const translations = {
  en: { ... },
  fa: { ... },
  ar: {
    nav: {
      explorer: '...",
      miner: '...',
      // ...
    },
    // ...
  },
};
```

3. Add the language option to `LanguageSwitcher.js`
4. Add RTL support if needed in `LanguageContext.js`

### Translation keys

All UI text uses dot-notation keys:

```
t('nav.explorer')     → "Explorer" / "اکسپلورر"
t('miner.quickInstall') → "Quick Install" / "نصب سریع"
t('home.title')       → "Decentralized LLM Network"
```

## Model Configuration

### Available Models

Models are defined in `backend/src/models.js`. Each model has:
- `id`: Ollama model ID (e.g., `llama3.1:8b`)
- `name`: Display name
- `size`: Parameter count (e.g., `8B`)
- `ram`: Required RAM
- `category`: `chat`, `code`, `vision`, `embedding`

### API Endpoints

```
GET /api/models              → All models
GET /api/models?category=chat → Filter by category
GET /api/models/categories   → List categories
```

### Adding a New Model

1. Open `backend/src/models.js`
2. Add model entry:

```javascript
{ id: 'model-name:size', name: 'Display Name', size: '8B', ram: '4.4 GB', category: 'chat', pulls: '1M', desc: 'Description' }
```

3. Restart backend

### Miner Model Selection

Miners choose which models to run during installation:
- Interactive menu in install scripts
- Models saved to `miner-app/config.json`
- Models sent to backend via `/api/miners/register`

## VPS Deployment

### Server Info

| Item | Value |
|------|-------|
| IP | 65.109.176.28 |
| OS | Ubuntu 24.04 |
| User | root |

### Deploy Commands

```bash
# SSH into server
ssh root@65.109.176.28

# Backend
cd /opt/krelz/backend
systemctl restart krelz-backend

# Frontend
cd /opt/krelz/frontend
npm run build
systemctl restart krelz-frontend

# Smart Contracts
cd /opt/krelz/contracts
npx hardhat run scripts/deploy.js --network bscTestnet
```

### Services

```bash
systemctl status krelz-backend
systemctl status krelz-frontend
systemctl status nginx
docker ps  # PostgreSQL, Redis
```

## Smart Contracts

### Compile

```bash
cd contracts
npx hardhat compile
```

### Deploy (Local)

```bash
npx hardhat run scripts/deploy.js
```

### Deploy (BSC Testnet)

```bash
# Requires BNB in deploy wallet
npx hardhat run scripts/deploy.js --network bscTestnet
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
# Clear Next.js cache
rm -rf frontend/.next
cd frontend && npm run build
```

### Frontend not updating

```bash
systemctl restart krelz-frontend
```
