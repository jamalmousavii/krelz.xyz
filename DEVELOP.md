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
│   ├── index.js           # Home page
│   ├── chat.js            # Chat with AI (sessions, daily tokens balance)
│   ├── profile.js         # Dashboard + settings + daily tokens UI
│   ├── miner.js           # Miner install
│   └── explorer.js        # Network explorer
├── components/
│   ├── Navbar.js          # Navigation + auth dropdown
│   ├── GoogleLogin.js     # Google OAuth
│   ├── ErrorBoundary.js   # Error boundary
│   └── LanguageSwitcher.js
├── i18n/
│   ├── translations.js    # EN/FA translations
│   └── LanguageContext.js  # Language provider
└── styles/
```

### backend/
Node.js/Express API with PostgreSQL + Redis.

```
backend/
├── src/
│   ├── server.js          # Entry point (v3.5.0)
│   ├── models.js          # AI models + per-model pricing
│   ├── cache.js           # Redis caching
│   ├── database/
│   │   ├── pool.js        # PostgreSQL connection
│   │   └── migrate.js     # DB migration (14 tables)
│   ├── middleware/
│   │   └── auth.js        # JWT + Google OAuth
│   └── routes/
│       ├── auth.js        # Register/Login/Google
│       ├── chat.js        # LLM chat + daily tokens + sessions
│       ├── miners.js      # Miner CRUD + model switch
│       ├── models.js      # Model list API
│       ├── payments.js    # NowPayments multi-coin
│       ├── token.js       # Balance + daily tokens info
│       ├── stats.js       # Network stats
│       └── leaderboard.js # Top miners
└── package.json
```

### miner-app/
Miner install scripts and source code.

```
miner-app/
├── install-ubuntu.sh      # Ubuntu/Debian installer
├── install-redhat.sh      # RedHat/Fedora installer
└── src/                   # Miner source
    ├── main.js
    ├── renderer/index.html
    └── services/
        ├── ollama.js      # Ollama integration
        └── websocket.js   # WebSocket to backend
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
| qwen3.6:27b | 27B | $0.088 | $0.176 | -38% |
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

## Internationalization (i18n)

### How it works

- Translations in `frontend/i18n/translations.js`
- Language stored in localStorage (`krelz-lang`)
- Default: English, Farsi with RTL

### Adding a new language

1. Open `frontend/i18n/translations.js`
2. Add a new key (e.g., `ar` for Arabic):

```javascript
const translations = {
  en: { ... },
  fa: { ... },
  ar: {
    nav: { ... },
    profile: {
      spent: '...',
      dailyTokens: '...',
      remaining: '...',
      usedToday: '...',
    },
    // ...
  },
};
```

3. Add language option to `LanguageSwitcher.js`

### Translation Keys (Profile)

```
t('profile.available')   → "Available" / "موجود"
t('profile.earned')      → "Earned" / "کسب شده"
t('profile.spent')       → "Spent" / "مصرف شده"
t('profile.dailyTokens') → "Daily Free Tokens" / "توکن رایگان روزانه"
t('profile.remaining')   → "Remaining" / "باقیمانده"
t('profile.usedToday')   → "Used Today" / "امروز مصرف شده"
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
