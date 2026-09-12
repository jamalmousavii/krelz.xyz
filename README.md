# Krelz Network

شبکه غیرمتمرکز LLM برای اشتراک‌گذاری منابع GPU

## 🔗 لینک‌ها

| سرویس | آدرس |
|-------|------|
| سایت اصلی | https://krelz.xyz |
| Chat AI | https://krelz.xyz/chat |
| دانلود ماینر | https://krelz.xyz/miner |
| اکسپلورر | https://krelz.xyz/explorer |
| API | https://krelz.xyz/api/health |
| دانلود مستقیم ماینر | https://krelz.xyz/downloads/krelz-miner.AppImage |

## 🏗️ معماری

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
              │ (Electron) │         │ Smart Contracts  │
              └───────────┘         └──────────────────┘
```

## 📁 ساختار پروژه

```
krelz-public/
├── backend/                    # API Server (Node.js/Express)
│   ├── src/
│   │   ├── server.js          # نقطه ورود
│   │   ├── database/
│   │   │   ├── pool.js        # اتصال PostgreSQL
│   │   │   └── migrate.js     # مایگریشن دیتابیس
│   │   └── routes/
│   │       ├── auth.js        # احراز هویت
│   │       ├── miners.js      # مدیریت ماینرها
│   │       ├── chat.js        # چت LLM
│   │       ├── payments.js    # پرداخت‌ها
│   │       ├── token.js       # توکن KRELZ
│   │       └── stats.js       # آمار شبکه
│   └── package.json
├── frontend/                   # رابط کاربری (Next.js)
│   ├── pages/
│   │   ├── index.js           # صفحه اصلی
│   │   ├── chat.js            # چت با AI
│   │   ├── miner.js           # دانلود ماینر
│   │   └── explorer.js        # اکسپلورر شبکه
│   └── package.json
├── miner-app/                  # اپلیکیشن دسکتاپ (Electron)
│   ├── src/
│   │   ├── main.js            # نقطه ورود Electron
│   │   ├── renderer/
│   │   │   └── index.html     # UI ماینر
│   │   └── services/
│   │       ├── ollama.js      # سرویس Ollama
│   │       ├── miner.js       # سرویس ماینینگ
│   │       ├── blockchain.js  # اتصال بلاکچین
│   │       └── api.js         # اتصال API
│   └── package.json
├── contracts/                  # قراردادهای هوشمند (Solidity)
│   ├── contracts/
│   │   ├── KrelzToken.sol     # توکن ERC-20
│   │   └── StakingPool.sol    # استخر استیکینگ
│   ├── scripts/
│   │   └── deploy.js          # اسکریپت Deploy
│   ├── hardhat.config.js      # تنظیمات Hardhat
│   └── deploy.sh              # اسکریپت Deploy آماده
└── docs/                       # مستندات
    ├── architecture.md
    ├── tokenomics.md
    └── api.md
```

## ⚡ شروع سریع

### دانلود ماینر

```bash
# لینوکس
wget https://krelz.xyz/downloads/krelz-miner.AppImage
chmod +x "Krelz Miner-1.0.0.AppImage"
./"Krelz Miner-1.0.0.AppImage"
```

### اجرای Backend

```bash
cd backend
npm install
node src/server.js
# اجرا در http://localhost:3000
```

### اجرای Frontend

```bash
cd frontend
npm install
npm run dev
# اجرا در http://localhost:3001
```

### Deploy قرارداد هوشمند

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network bscTestnet
```

## 🔐 توکنومیکس

| پارامتر | مقدار |
|---------|-------|
| نام توکن | Krelz (KRELZ) |
| عرضه کل | 1,000,000,000 |
|imals | 18 |
| استاندارد | BEP-20 (BNB Chain) |
| کارمزد پلتفرم | 10% ماینر + 10% کاربر |
| سوزاندن | 1% تراکنش، 2% LLM، 5% جریمه |

### توزیع توکن

- **60%** ماینینگ
- **20%** اکوسیستم
- **10%** تیم (24 ماه vesting)
- **10%** بنیاد

## 🛠️ فناوری‌ها

| لایه | فناوری |
|------|--------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express, PostgreSQL, Redis |
| LLM | Ollama, llama3:8b |
| Blockchain | BNB Chain, Solidity 0.8.20, Hardhat |
| Miner App | Electron 28 |
| Server | Ubuntu 24.04, Nginx, Let's Encrypt |

## 📊 سرورها

| سرویس | آدرس | پورت |
|-------|------|------|
| VPS | 65.109.176.28 | 22 (SSH) |
| Nginx | krelz.xyz | 80, 443 |
| Backend | localhost | 3000 |
| Frontend | localhost | 3001 |
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |
| Ollama | localhost | 11434 |

## 📄 مجوز

MIT License

---

ساخته شده با ❤️ برای جامعه غیرمتمرکز
