# مستندات API — Krelz Network

نسخه بک‌اند: `3.20.0` — پایه: `https://krelz.xyz` (نمونه: `https://krelz.xyz/api/chat`)

همه پاسخ‌ها JSON هستند. در حالت موفقیت معمولاً `success: true` برمی‌گردد و در حالت خطا `error` (رشته) یا `details` (لیست خطاهای اعتبارسنجی).

---

## احراز هویت

دو نوع توکن وجود دارد:

| توکن | کاربرد |
|------|--------|
| JWT کاربر (`Authorization: Bearer <token>`) | پروفایل، کیف پول، چت، ماینرهای کاربر |
| `miner_token` (`kz_...`) | فقط برای ماینرها: heartbeat و ثبت دستگاه |

نکات:

- JWT فقط با الگوریتم `HS256` و `JWT_SECRET` سرور پذیرفته می‌شود (`alg: none` یا کلید دیگر → `401`).
- `role` در ثبت‌نام فقط `user` یا `miner` است؛ مقدار `admin` پذیرفته نمی‌شود (`400`).
- نقش ادمین در هر درخواستِ `admin` دوباره از دیتابیس خوانده می‌شود (کش ۶۰ ثانیه‌ای) و در صورت خطا `fail-closed` است.

### نرخ محدودیت (Rate limit)

| مسیر | سقف |
|------|-----|
| عمومی `/api/` | ۲۰۰ درخواست / ۱۵ دقیقه |
| `/api/auth/login` و `register` | ۱۰ / ۱۵ دقیقه |
| `/api/auth/forgot-password` و `reset-password` | ۱۰ / ۱۵ دقیقه |
| `/api/chat` (کاربر واردشده) | ۳۰ / دقیقه |
| `/api/chat` (مهمان، بدون توکن) | ۶ / دقیقه |
| nginx روی `/api/` | ۱۰ r/s با burst=40 (پاسخ `429`) |

---

## کاربران

### POST `/api/auth/register`

```json
{ "email": "user@example.com", "password": "password123" }
```

پاسخ: `{ "success": true, "token": "...", "user": { "id", "email", "name", "role" } }`

### POST `/api/auth/login`

```json
{ "email": "user@example.com", "password": "password123" }
```

### POST `/api/auth/google`

```json
{ "credential": "google-id-token" }
```

### POST `/api/auth/set-password`

تنظیم رمز برای حساب‌های Google-only (نیازمند JWT).

### POST `/api/auth/change-password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

### POST `/api/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

- اگر `RESEND_API_KEY` تنظیم نشده باشد → **`503`** (بدون توجه به وجود حساب، تا امکان شمارش حساب‌ها نباشد).
- توکن ریست **هرگز** در پاسخ یا لاگ برنمی‌گردد؛ فقط با ایمیل ارسال می‌شود.
- پاسخ موفق: `{ "success": true, "message": "If an account exists, a reset link has been sent." }`
- لینک: `BACKEND_URL/reset-password?token=...` (اعتبار ۱ ساعته)

### POST `/api/auth/reset-password`

```json
{ "token": "...", "password": "newpassword" }
```

---

## چت

### POST `/api/chat`

نیازمند توکن نیست (مهمان هم می‌تواند) اما مهمان نرخ محدودیت سخت‌تری دارد.

```json
{ "message": "سلام", "model": "llama3.1:8b", "session_id": 12 }
```

پاسخ موفق:

```json
{
  "success": true,
  "response": "...",
  "task_id": 123,
  "session_id": 12,
  "tokens_used": 420,
  "cost": 0.00007,
  "coin": "USD",
  "payment_status": "free | free_miner | paid",
  "miner_id": 7,
  "source": "miner | local",
  "miner_credit_remaining": 0.99
}
```

**پرداخت:**

1. **اعتبار رایگان ماینر (v3.25.0)**: اگر کاربر ماینر `online`/`busy` داشته باشد، اول از سقف **$۱ هر روز UTC** کم می‌شود → `payment_status: "free_miner"` (نه از کیف پول، نه سهم ماینر — منبع پلتفرم).
2. وگرنه کل `cost` از کیف پول USD کاربر (یک تراکنش با قفل ردیف).
3. سهم ماینر = ۹۰٪ مبلغ **پرداخت‌شده** (فقط اگر واقعاً ماینر جواب داده باشد) — از اعتبار رایگان سهمی نمی‌گیرد.
4. نه اعتبار کافی نه موجودی → باز هم پاسخ کامل سرو می‌شود با `payment_status: "free"` (**چت هرگز بلاک نمی‌شود**، v3.26.0 — نه ۴۰۲، نه کم‌کردن موجودی).
5. کاربر مهمان (بدون توکن) رایگان است → `payment_status: "free"` (با rate-limit).

قیمت‌گذاری: `cost = tokens × outputPrice / 1e6` (قیمت مدل انتخاب‌شده از `src/models.js`).

### پیوست (v3.20.0)

یک فیلد اختیاری `attachment` به بدنهٔ بالا اضافه کنید (حداکثر یک پیوست در هر پیام):

```json
{
  "message": "این فایل رو خلاصه کن",
  "model": "llama3.1:8b",
  "attachment": { "type": "file", "name": "doc.pdf", "mime": "application/pdf", "data": "<base64 خام>" }
}
```

| type | رفتار | مدل موردنیاز |
|------|-------|----------------|
| `image` | به‌صورت `images[]` به Ollama می‌رود (کلاینت تا ≤1280px فشرده می‌کند) | `vision: true` (`qwen3-vl:8b`, `gemma4:12b`) |
| `file` | PDF/متن سمت سرور استخراج و به ابتدای prompt می‌چسبد؛ مدل‌های متنی هم جواب می‌دهند | هر مدل چت |
| `audio` | WAV 16kHz mono (کلاینت می‌سازد، حداکثر ۶۰ ثانیه) — همان شکاف `images[]` | `audio: true` (`gemma4:12b`) |

محدودیت‌ها: `data` حداکثر ~۴MB base64 (تصویر ≤~1.5MB، فایل ≤1.5MB خام، PDF متن ≤60k کاراکتر).

خطاهای صریح (پیوست هرگز بی‌صدا حذف نمی‌شود):

| کد HTTP | `code` | معنی |
|---------|--------|------|
| 400 | `ATTACHMENT_UNSUPPORTED` | نوع فایل/مدل نامناسب (مثلاً تصویر با مدل بدون vision) |
| 400 | `ATTACHMENT_TOO_LARGE` / `ATTACHMENT_INVALID` / `ATTACHMENT_EMPTY` / `ATTACHMENT_PARSE_FAILED` / `AUDIO_FORMAT` | سایز/فرمت/استخراج ناموفق |
| 409 | `MEDIA_NO_MINER` | ماینرِ سازگار (نسخه ≥ 3.20.0) یا مدل محلی برای رسانه آنلاین نیست |

تاریخچه: پیام‌های کاربر در `GET /api/chat/sessions/:id` فیلد `media` (JSONB از `tasks.media`) دارند.

### مدیریت جلسات

| متد و مسیر | توضیح |
|-----------|-------|
| `GET /api/chat/sessions` | لیست جلسات کاربر |
| `POST /api/chat/sessions` | ساخت جلسه (`subject`, `model`) — `subject` حداکثر ۲۵۵ کاراکتر |
| `GET /api/chat/sessions/:id` | یک جلسه + پیام‌ها |
| `PUT /api/chat/sessions/:id` | تغییر عنوان |
| `DELETE /api/chat/sessions/:id` | حذف جلسه |
| `GET /api/chat/history` | ۵۰ درخواست آخر کاربر (legacy) |

---

## ماینرها

### `GET /api/miners` (عمومی)

لیست ماینرهای آنلاین برای نمایش عمومی — **بدون** `wallet_address` و `miner_token`، حداکثر ۱۰۰ ردیف.

### `GET /api/miners/:id` (فقط مالک)

### `POST /api/miners` (نیازمند JWT)

ساخت ماینر جدید: `{ "name": "miner1" }` → پاسخ شامل `miner_token` (فقط یک بار نمایش داده می‌شود).

### `GET /api/miners/mine`

ماینرهای خودِ کاربر (به‌جز `removed`)؛ `miner_token` بعد از اولین اتصال `null` می‌شود.
از `v3.22.0` ماینرهایی که بیش از **۱۰ روز** است تماس نگرفته‌اند هم از این لیست حذف و به History می‌روند (با اتصال دوباره خودبه‌خود برمی‌گردند).

### `GET /api/miners/history` (نیازمند JWT)

تاریخچه ماینرها: ماینرهای `removed` + ماینرهای بیش از ۱۰ روز آفلاین.

- هر ردیف: `id`, `name`, `gpu_model`, `total_tasks`, `earnings`, `created_at`, `last_seen`, `uninstalled_at`, `reason` (`uninstalled` | `offline>10d`)
- `summary`: `total_added`, `total_tasks`, `total_earnings` (روی همه ماینرهای کاربر)

### متدهای مدیریت (نیازمند JWT و مالکیت)

| متد و مسیر | توضیح |
|-----------|-------|
| `PUT /api/miners/mine/model` | تغییر مدل (`model`, `miner_id` اختیاری) |
| `PUT /api/miners/mine/:id` | تغییر نام |
| `PUT /api/miners/mine/:id/token` | ساخت توکن جدید (نصب مجدد) |
| `DELETE /api/miners/mine/:id` | حذف نرم — `uninstalled_at` ثبت، تاریخچه در History محفوظ می‌ماند |

### `POST /api/token` (نیازمند JWT)

دریافت/ساخت توکن سطح حساب (legacy).

### `POST /api/miners/setup` (عمومی، با توکن)

```json
{ "email": "a@b.co", "miner_token": "kz_...", "gpu_model": "...", "ram": "32 GB", "cpu": "...", "models": ["llama3.1:8b"], "machine_id": "...", "name": "vps1" }
```

- توکنِ ماینرِ اختصاصی → بلافاصله ثبت/به‌روزرسانی.
- توکنِ سطح حساب → فقط وقتی کاربر دقیقاً یک ماینر فعال دارد؛ در غیر این صورت `409`.
- ماینرِ `removed` دوباره زنده نمی‌شود → `401`.

### `POST /api/miners/unregister` (عمومی، با توکن)

```json
{ "miner_token": "kz_..." }
```

از `v3.22.0` — توسط اسکریپت‌های `uninstall-*.sh` قبل از حذف فایل‌ها صدا زده می‌شود: ماینر `removed` + `uninstalled_at` ثبت و اتصال WS آن بسته می‌شود. **Idempotent**: توکل نامعتبر/تکراری هم `200 { success: true, unregistered: false }` برمی‌گرداند تا uninstall هرگز به‌خاطر سرور شکست نخورد.

### `PUT /api/miners/:id/heartbeat`

بدون JWT؛ با `miner_token` در body. `status` فقط `online|offline|busy` پذیرفته می‌شود، `tasks_completed` بین ۰ تا ۱۰۰۰ محدود است و ماینرِ `removed` به‌روز نمی‌شود.

### `POST /api/miners/register`

غیرفعال است (`403`) — از `/api/miners/setup` استفاده شود.

---

## پرداخت

### `GET /api/payments/coins`

لیست کوین‌های قابل واریز (NowPayments).

### `POST /api/payments/deposit/create`

```json
{ "amount_usd": 25, "coin": "USDT" }
```

پاسخ شامل `invoice_url` (صفحه پرداخت NowPayments) و `order_id` است. این `order_id` در `coin_deposits` ذخیره می‌شود.

### `POST /api/payments/deposit/webhook` (عمومی، امضای IPN)

- اعتبارسنجی HMAC-SHA512 با `NOWPAYMENTS_IPN_SECRET` (**fail-closed**: بدون تنظیم بودنِ secret هیچ وب‌هوکی پذیرفته نمی‌شود).
- ادعا (claim) ایدمپوتنت با `order_id`/`processor_id` در یک تراکنش: وب‌هوکِ تکراری اعتباری اضافه نمی‌کند.
- مبلغ از **ردیف دیتابیس** خوانده می‌شود، نه از payload.

### `GET /api/payments/balance` (نیازمند JWT)

```json
{ "success": true, "balances": { "USD": { "available": 12.5, "total_earned": 30, "total_spent": 17.5 } }, "miner_credit": { "eligible": true, "limit": 1, "used": 0.01, "remaining": 0.99 } }
```

### `POST /api/payments/withdraw`

```json
{ "amount": 5, "address": "T..." }
```

برداشت با یک `UPDATE ... WHERE available >= amount` اتمیک انجام می‌شود (حداقل ۵ دلار).

### `GET /api/payments/history`

`limit` بین ۱ تا ۱۰۰.

### `POST /api/payments/deduct` (نیازمند JWT)

کم‌کردن موجودی خودِ کاربر (اتمیک).

---

## توکن (legacy)

### `GET /api/token/balance` (نیازمند JWT)

```json
{ "success": true, "available": 5.0, "total_earned": 2.0, "total_spent": 0.5, "miner_credit": { "eligible": true, "limit": 1, "used": 0.01, "remaining": 0.99 } }
```

### `POST /api/token/deposit|deduct|transfer`

**غیرفعال شده → `410 Gone`.** موجودی فقط از مسیر پرداخت و چت تغییر می‌کند.

---

## آمار، مدل‌ها، رتبه‌بندی

| مسیر | توضیح |
|------|-------|
| `GET /api/stats/network` | شمار ماینر/کاربر/درخواست + `platform_revenue` (۱۰٪ هزینه تسک‌های کامل) — کش ۳۰ ثانیه |
| `GET /api/models` | کاتالوگ مدل‌ها + تعداد ماینر آنلاین هر مدل (`unknown_models` برای مدل‌های خارج از کاتالوگ) — کش ۱۵ ثانیه |
| `GET /api/models/categories` | دسته‌بندی‌ها |
| `GET /api/leaderboard/miners` | ۵۰ ماینر برتر |
| `GET /api/leaderboard/users` | ۵۰ کاربر برتر |
| `GET /api/leaderboard/mine` | رتبه خودِ کاربر بین ماینرها (نیازمند JWT؛ `RANK()` روی درآمد) |

---

## ادمین (نیازمند JWT + نقش `admin` در دیتابیس)

| مسیر | توضیح |
|------|-------|
| `GET /api/admin/dashboard` | شمارنده‌ها + درآمد پلتفرم |
| `GET /api/admin/users` | ۱۰۰ کاربر اخیر |
| `GET /api/admin/miners` | ۱۰۰ ماینر |
| `GET /api/admin/tasks` | ۱۰۰ تسک اخیر + ایمیل کاربر |

---

## سلامت

| مسیر | رفتار |
|------|-------|
| `GET /health` | readiness: بدون Postgres → `503` + `status: "degraded"`؛ Redis فقط گزارشی است |
| `GET /health/live` | liveness: همیشه `200` |

---

## WebSocket

آدرس: `wss://krelz.xyz/ws` (از داخل سرور: `ws://127.0.0.1:8444/ws`)

- احراز هویت ماینر با `miner_token`.
- پیام‌های کلیدی: `register`, `task_dispatch`, `task_result`, `heartbeat`.
- نتیجه تکراری (`task_result` برای تسکی که دیگر `pending/processing` نیست) نادیده گرفته می‌شود.

---

## کدهای خطا

| کد | معنا |
|----|------|
| `400` | اعتبارسنجی ناموفق (`details` شامل فیلدهاست) |
| `401` | توکن نامعتبر/نبودن توکن/توکنِ ماینر نامعتبر |
| `402` | *(دیگر برنمی‌گردد — چت هرگز بلاک نمی‌شود، v3.26.0)* |
| `403` | دسترسی ادمین لازم است / CORS |
| `404` | پیدا نشد |
| `409` | تعارض (چند ماینر با توکن سطح حساب) |
| `410` | endpoint قدیمی حذف شده |
| `429` | نرخ محدودیت |
| `500` | خطای داخلی |
| `503** | سرویس در دسترس نیست (بدون provider / بدون ایمیل / بدون Postgres) |
