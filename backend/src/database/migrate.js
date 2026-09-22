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

    // === Daily Free Tokens ===
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

    await client.query('COMMIT');
    console.log('\n✅ تمام جداول ایجاد شد');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ خطا:', err);
  } finally {
    client.release();
  }
};

migrate();
