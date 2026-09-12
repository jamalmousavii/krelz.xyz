# مستندات API Krelz Network

## خلاصه

آدرس سرور اصلی: `https://api.krelz.xyz`

---

## احراز هویت

### POST /api/auth/register
ثبت‌نام کاربر جدید

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### POST /api/auth/login
ورود کاربر

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## ماینرها

### GET /api/miners
دریافت لیست ماینرها

**Response:**
```json
{
  "success": true,
  "miners": [
    {
      "id": "miner-id",
      "name": "Miner 1",
      "gpu": "RTX 3080",
      "status": "online",
      "uptime": 99.5,
      "earnings": 1250.5
    }
  ]
}
```

### POST /api/miners/register
ثبت‌نام ماینر جدید

**Body:**
```json
{
  "wallet": "0x1234...",
  "gpu": "RTX 3080",
  "ram": "16GB",
  "cpu": "Intel i7"
}
```

### PUT /api/miners/:id/heartbeat
گزارش وضعیت ماینر

**Body:**
```json
{
  "status": "online",
  "gpu_usage": 75,
  "ram_usage": 60,
  "tasks_completed": 45
}
```

---

## چت LLM

### POST /api/chat
ارسال درخواست به LLM

**Body:**
```json
{
  "message": "سلام، حال شما چطور است؟",
  "model": "llama3:8b"
}
```

**Response:**
```json
{
  "success": true,
  "response": "سلام! ممنون، خوب هستم...",
  "tokens_used": 150,
  "cost": 0.5,
  "miner_id": "miner-id"
}
```

---

## پرداخت

### POST /api/payments/create
ایجاد تراکنش پرداخت

**Body:**
```json
{
  "amount": 100,
  "from": "0x1234...",
  "to": "0x5678...",
  "type": "chat"
}
```

### GET /api/payments/history
دریافت تاریخچه پرداخت‌ها

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "payment-id",
      "amount": 100,
      "from": "0x1234...",
      "to": "0x5678...",
      "tx_hash": "0xabc...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## توکن

### GET /api/token/balance
دریافت موجودی توکن

**Response:**
```json
{
  "success": true,
  "balance": 1250.5,
  "staked": 500,
  "available": 750.5
}
```

### POST /api/token/stake
استیک کردن توکن

**Body:**
```json
{
  "amount": 100
}
```

### POST /api/token/unstake
برداشت توکن از استیک

**Body:**
```json
{
  "amount": 50
}
```

---

## آمار

### GET /api/stats/network
آمار کل شبکه

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_miners": 150,
    "active_miners": 120,
    "total_users": 500,
    "total_requests": 15000,
    "total_tokens_burned": 25000
  }
}
```

---

## خطاها

| کد | پیام | توضیح |
|----|------|-------|
| 400 | Bad Request | درخواست نامعتبر |
| 401 | Unauthorized | احراز هویت نشده |
| 403 | Forbidden | دسترسی غیرمجاز |
| 404 | Not Found | یافت نشد |
| 429 | Too Many Requests | درخواست زیاد |
| 500 | Server Error | خطای سرور |
