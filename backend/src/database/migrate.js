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
