# Krelz Network - Development Guide

## پیش‌نیازها

- Node.js 18+
- npm یا yarn
- Docker (اختیاری)
- PostgreSQL 15+

## نصب وابستگی‌ها

```bash
# فرانت‌اند
cd frontend
npm install

# بک‌اند
cd backend
npm install

# اپلیکیشن ماینر
cd miner-app
npm install
```

## اجرای توسعه

```bash
# فرانت‌اند
cd frontend
npm run dev

# بک‌اند
cd backend
npm run dev
```

## ساختار پروژه

### frontend/
فرانت‌اند Next.js با Tailwind CSS

### backend/
بک‌اند Node.js/Express با PostgreSQL

### miner-app/
اپلیکیشن دسکتاپ Electron برای ماینرها

### contracts/
قراردادهای هوشمند Solidity برای BNB Chain

## تست‌ها

```bash
npm run test
```

## استقرار

```bash
npm run build
npm run deploy
```

## عیب‌یابی

### مشکل: npm install خطا می‌دهد
```bash
rm -rf node_modules
npm install
```

### مشکل: پورت اشغال است
```bash
lsof -i :3000
kill -9 <PID>
```
