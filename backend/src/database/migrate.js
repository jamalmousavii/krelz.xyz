// CLI entrypoint: load env BEFORE ./pool reads DATABASE_URL (server.js does
// this at startup, but running `node src/database/migrate.js` directly did not,
// so production migrations fell back to the local-dev DSN and failed auth).
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = require('./pool');

const migrate = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // جدول کاربران
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255),
        avatar TEXT,
        google_id VARCHAR(50) UNIQUE,
        wallet_address VARCHAR(42),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول users ایجاد شد');
    
    // جدول ماینرها
    await client.query(`
      CREATE TABLE IF NOT EXISTS miners (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        wallet_address VARCHAR(42) NOT NULL,
        gpu_model VARCHAR(100),
        ram VARCHAR(50),
        cpu VARCHAR(100),
        models JSONB DEFAULT '["llama3.1:8b"]',
        current_model VARCHAR(50) DEFAULT 'llama3.1:8b',
        status VARCHAR(20) DEFAULT 'offline',
        uptime DECIMAL(5,2) DEFAULT 0,
        total_tasks INTEGER DEFAULT 0,
        earnings DECIMAL(20,8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول miners ایجاد شد');
    
    // جدول درخواست‌ها
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        miner_id INTEGER REFERENCES miners(id),
        prompt TEXT NOT NULL,
        response TEXT,
        model VARCHAR(50) DEFAULT 'llama3:8b',
        tokens_used INTEGER DEFAULT 0,
        cost DECIMAL(20,8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log('✅ جدول tasks ایجاد شد');
    
    // جدول تراکنش‌ها
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        from_address VARCHAR(42),
        to_address VARCHAR(42),
        amount DECIMAL(20,8) NOT NULL,
        type VARCHAR(50) NOT NULL,
        tx_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول transactions ایجاد شد');
    
    // جدول استیکینگ
    await client.query(`
      CREATE TABLE IF NOT EXISTS staking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(20,8) NOT NULL,
        reward DECIMAL(20,8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول staking ایجاد شد');
    
    // جدول موجودی کاربران
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_balances (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        available DECIMAL(20,8) DEFAULT 0,
        total_earned DECIMAL(20,8) DEFAULT 0,
        total_spent DECIMAL(20,8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول user_balances ایجاد شد');
    
    // جدول واریزی‌ها
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(20,8) NOT NULL,
        tx_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول deposits ایجاد شد');
    
    // اضافه کردن ستون description به transactions
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون description اضافه شد');
    
    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_miners_status ON miners(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_miners_wallet ON miners(wallet_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_miner_id ON tasks(miner_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_staking_user ON staking(user_id, status)');
    console.log('✅ Indexes created');
    
    // API Keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        key_prefix VARCHAR(12) NOT NULL,
        rate_limit INTEGER DEFAULT 100,
        active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول api_keys ایجاد شد');
    
    // Admin user
    await client.query(`
      DO $$ BEGIN
        INSERT INTO users (email, name, role) VALUES ('admin@krelz.xyz', 'Admin', 'admin')
        ON CONFLICT (email) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN null;
      END $$;
    `);
    console.log('✅ Admin user created');
    
    // === Multi-Coin Payment Tables ===
    
    // User coin balances
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_coin_balances (
        user_id INTEGER REFERENCES users(id),
        coin VARCHAR(10) NOT NULL,
        chain VARCHAR(20) NOT NULL,
        available DECIMAL(20,8) DEFAULT 0,
        total_earned DECIMAL(20,8) DEFAULT 0,
        total_spent DECIMAL(20,8) DEFAULT 0,
        PRIMARY KEY (user_id, coin)
      )
    `);
    console.log('✅ جدول user_coin_balances ایجاد شد');
    
    // Coin deposits
    await client.query(`
      CREATE TABLE IF NOT EXISTS coin_deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        coin VARCHAR(10) NOT NULL,
        amount DECIMAL(20,8) NOT NULL,
        tx_hash VARCHAR(100),
        processor_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول coin_deposits ایجاد شد');
    
    // Coin withdrawals
    await client.query(`
      CREATE TABLE IF NOT EXISTS coin_withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        coin VARCHAR(10) NOT NULL,
        amount DECIMAL(20,8) NOT NULL,
        to_address VARCHAR(100) NOT NULL,
        tx_hash VARCHAR(100),
        fee DECIMAL(20,8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول coin_withdrawals ایجاد شد');

    // USD wallet migration: ensure USD rows exist + fold legacy multi-coin into USD once
    try {
      await client.query(`
        INSERT INTO user_coin_balances (user_id, coin, chain, available, total_earned, total_spent)
        SELECT user_id, 'USD', 'usd', 0, 0, 0
        FROM user_coin_balances
        WHERE coin <> 'USD'
        ON CONFLICT (user_id, coin) DO NOTHING
      `);
      // One-time-ish fold: add non-USD balances into USD (fixed approx rates for migration)
      await client.query(`
        UPDATE user_coin_balances u SET
          available = u.available + COALESCE(x.usd, 0),
          total_earned = u.total_earned + COALESCE(x.usd, 0)
        FROM (
          SELECT user_id, SUM(
            available * CASE coin
              WHEN 'USDT' THEN 1
              WHEN 'BTC' THEN 60000
              WHEN 'ETH' THEN 3000
              WHEN 'BNB' THEN 600
              WHEN 'TRX' THEN 0.12
              WHEN 'DOGE' THEN 0.15
              WHEN 'XRP' THEN 0.5
              ELSE 0
            END
          ) AS usd
          FROM user_coin_balances
          WHERE coin <> 'USD' AND coin <> 'KRELZ'
          GROUP BY user_id
        ) x
        WHERE u.user_id = x.user_id AND u.coin = 'USD'
      `);
      // Zero out legacy rows after fold (keep history columns)
      await client.query(`
        UPDATE user_coin_balances SET available = 0
        WHERE coin IN ('BTC','ETH','BNB','USDT','TRX','DOGE','XRP')
      `);
      console.log('✅ USD wallet migration completed');
    } catch (migErr) {
      console.warn('⚠️ USD migration note:', migErr.message);
    }

    
    // Miner coin earnings
    await client.query(`
      CREATE TABLE IF NOT EXISTS miner_coin_earnings (
        id SERIAL PRIMARY KEY,
        miner_id INTEGER REFERENCES miners(id),
        coin VARCHAR(10) NOT NULL,
        amount DECIMAL(20,8) NOT NULL,
        task_id INTEGER REFERENCES tasks(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول miner_coin_earnings ایجاد شد');
    
    // Multi-coin indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_coin_deposits_user ON coin_deposits(user_id, coin)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_coin_deposits_status ON coin_deposits(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_coin_withdrawals_user ON coin_withdrawals(user_id, coin)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_coin_withdrawals_status ON coin_withdrawals(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_miner_coin_earnings_miner ON miner_coin_earnings(miner_id, coin)');
    console.log('✅ Multi-coin indexes created');
    
    // === Chat Sessions ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        subject VARCHAR(255) DEFAULT 'New Chat',
        model VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول chat_sessions ایجاد شد');

    // Add session_id to tasks (if not exists)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES chat_sessions(id);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون session_id به tasks اضافه شد');

    // Chat session indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id)');
    console.log('✅ Chat session indexes created');

    // === Attachments (v3.20.0) ===
    // tasks.media holds the JSONB copy of what the user attached (image/audio
    // include their base64 so history can re-render thumbnails; files store
    // only metadata because their text lives in tasks.prompt).
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media JSONB;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // tasks.prepared_prompt: the prompt after attachment preparation (file text
    // prepended). NULL means "use prompt as-is". Needed because task_request
    // (polling mode) only sees the DB row and must reconstruct the exact
    // prompt that dispatchTask would have sent.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prepared_prompt TEXT;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // miners.app_version: what the miner advertised at auth. Media dispatch
    // (images/audio) only targets miners >= 3.20.0 which understand the
    // `attachment` field on task messages.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS app_version VARCHAR(32);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ Column tasks.media + miners.app_version added');

    // === Miner history (v3.22.0) ===
    // miners.last_seen: last time the miner actually talked to us (auth /
    // heartbeat / resource report). NOT updated_at — that also moves on
    // rename/soft-delete. The dashboard uses COALESCE(last_seen, created_at)
    // to archive miners offline for > 10 days into the history section.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // miners.uninstalled_at: when the miner was removed (dashboard 🗑️ or the
    // uninstall script calling POST /api/miners/unregister).
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS uninstalled_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // Backfill: existing rows have no last_seen — treat last known contact as
    // updated_at so the 10-day archive rule starts from real data.
    await client.query(
      'UPDATE miners SET last_seen = updated_at WHERE last_seen IS NULL AND updated_at IS NOT NULL'
    );
    console.log('✅ Columns miners.last_seen + miners.uninstalled_at added');

    // === Daily Free Tokens ===
    // Legacy table (feature removed in v3.24.0), reactivated in v3.27.0 by
    // freeAllowance.js: signed-in users spend their daily free allowance
    // (2M/day Free, 10M/day Plus) here. UTC-day reset is handled per-row.
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_tokens (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokens_used_today DECIMAL(20,8) DEFAULT 0,
        last_reset_date DATE DEFAULT CURRENT_DATE
      )
    `);
    console.log('✅ جدول daily_tokens ایجاد شد');

    await client.query('CREATE INDEX IF NOT EXISTS idx_daily_tokens_user ON daily_tokens(user_id)');
    console.log('✅ Daily tokens index created');

    // === Miner free chat credit (v3.25.0) ===
    // Signed-in users with an online/busy miner get a USD allowance per UTC
    // day. Spent only inside the chat payment txn: platform-funded, so it
    // never debits the wallet and never credits a miner (no revenue share).
    await client.query(`
      CREATE TABLE IF NOT EXISTS miner_daily_credit (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        usd_used_today DECIMAL(20,8) DEFAULT 0,
        last_reset_date DATE
      )
    `);
    console.log('✅ جدول miner_daily_credit ایجاد شد');

    // === Daily free allowance — guests (v3.27.0) ===
    // Guests have no users row, so their 2M/day free allowance is tracked by
    // client IP (req.ip behind nginx; trust proxy is set in server.js).
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_tokens_guest (
        guest_key TEXT PRIMARY KEY,
        tokens_used_today DECIMAL(20,8) DEFAULT 0,
        last_reset_date DATE DEFAULT CURRENT_DATE
      )
    `);
    console.log('✅ جدول daily_tokens_guest ایجاد شد');

    // === Plus subscription (v3.27.0) ===
    // One active row per user; an expired row simply stops matching
    // (expires_at > now()) and the user falls back to the Free cap.
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_plans (
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan_type VARCHAR(32) NOT NULL DEFAULT 'plus',
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, plan_type)
      )
    `);
    console.log('✅ جدول user_plans ایجاد شد');

    // === Plus purchases — IPN idempotency (v3.27.0) ===
    // Mirrors coin_deposits: a replayed 'finished' IPN can only claim a
    // pending row once, so a plan can never be extended twice.
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_purchases (
        order_id VARCHAR(128) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        invoice_id VARCHAR(64),
        amount DECIMAL(20,8) NOT NULL,
        tx_hash VARCHAR(256),
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_plan_purchases_user ON plan_purchases(user_id)');
    console.log('✅ جدول plan_purchases ایجاد شد');

    // === Token bundles (v3.28.0): prepaid, non-expiring token pot ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_token_balances (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokens BIGINT NOT NULL DEFAULT 0,
        total_purchased BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ جدول user_token_balances ایجاد شد');

    // Which tier an order buys (plus/pro/max) or that it is a token bundle
    // ('tokens'); bundles also record the quoted token amount.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE plan_purchases ADD COLUMN IF NOT EXISTS plan_type VARCHAR(16) NOT NULL DEFAULT 'plus';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE plan_purchases ADD COLUMN IF NOT EXISTS tokens BIGINT NOT NULL DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون‌های plan_type/tokens به plan_purchases اضافه شد');

    // Earnings attribution (v3.28.0): which payment source and which plan the
    // paying user was on. The DEFAULT fills every pre-existing row — all of
    // them came from wallet-paid chats (the only paying leg before v3.28.0).
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miner_coin_earnings ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'wallet';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miner_coin_earnings ADD COLUMN IF NOT EXISTS plan_type VARCHAR(16) NOT NULL DEFAULT 'free';
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(
      "UPDATE miner_coin_earnings SET source = 'wallet', plan_type = 'free' WHERE source IS NULL OR plan_type IS NULL"
    );
    console.log('✅ ستون‌های source/plan_type به miner_coin_earnings اضافه شد');


    // === Miner Token + Password Reset ===
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS miner_token VARCHAR(128) UNIQUE;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون miner_token اضافه شد');

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون reset_token اضافه شد');

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ ستون reset_token_expiry اضافه شد');

    await client.query('CREATE INDEX IF NOT EXISTS idx_users_miner_token ON users(miner_token)');
    console.log('✅ Miner token index created');

    // === Miner Resource Usage Columns ===
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS gpu_usage NUMERIC(5,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS ram_usage NUMERIC(5,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS cpu_usage NUMERIC(5,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS disk_usage NUMERIC(5,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log('✅ Resource usage columns added');

    // === Multi-Miner Support (v3.12.0): machine_id + name ===
    // Allows unlimited miners per user (one row per machine).
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS machine_id VARCHAR(64);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS name VARCHAR(100);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // Backfill existing miners (no machine_id yet) with a stable generated id
    await client.query(`
      UPDATE miners
      SET machine_id = 'm_' || md5(random()::text || id::text)
      WHERE machine_id IS NULL
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_miners_user_machine ON miners(user_id, machine_id);
      EXCEPTION WHEN duplicate_table THEN null;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_miners_machine ON miners(machine_id)');
    console.log('✅ Multi-miner columns added (machine_id, name)');

    // === Per-Miner Unique Tokens (v3.13.0): one token per miner row ===
    // Each server-miner gets its own token; token IS the miner identity.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS miner_token VARCHAR(128);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // Backfill existing rows (no extension needed: md5 yields 32 hex chars)
    await client.query(`
      UPDATE miners
      SET miner_token = 'kz_' || md5(random()::text || id::text || clock_timestamp()::text)
      WHERE miner_token IS NULL
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_miners_token ON miners(miner_token);
      EXCEPTION WHEN duplicate_table THEN null;
      END $$;
    `);
    console.log('✅ Per-miner token column added (miner_token)');

    // === Single-use token display (v3.14.0): hide token after first connect ===
    // token_used_at is set on first successful /setup or WS auth.
    // GET /api/miners/mine hides miner_token when this is set;
    // PUT /api/miners/mine/:id/token rotates the token and clears it.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE miners ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    // Existing miners that have connected (gpu info present) are considered used
    await client.query(`
      UPDATE miners SET token_used_at = COALESCE(token_used_at, updated_at)
      WHERE token_used_at IS NULL AND gpu_model IS NOT NULL
    `);
    console.log('✅ Single-use token column added (token_used_at)');

    // ---- v3.18.5: IPN idempotency / deposit reconciliation ----
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE coin_deposits ADD COLUMN IF NOT EXISTS order_id VARCHAR(128);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_coin_deposits_processor ON coin_deposits(processor_id)'
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_deposits_order ON coin_deposits(order_id) WHERE order_id IS NOT NULL'
    );
    console.log('✅ coin_deposits order_id + lookup indexes added');

    // ---- Schema version bookkeeping (baseline marker for future migrations) ----
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `INSERT INTO schema_migrations (version) VALUES ('0001_baseline')
       ON CONFLICT (version) DO NOTHING`
    );

    await client.query('COMMIT');
    console.log('\n✅ تمام جداول ایجاد شد');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ خطا:', err);
    // Fail loudly: a silent exit(0) lets CI/systemd deploy a broken schema.
    process.exitCode = 1;
  } finally {
    client.release();
  }
};

migrate();
