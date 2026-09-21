const { Pool } = require('pg');
const { types } = require('pg');

// Parse numeric/decimal as float instead of string
types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://krelz:krelz_secure_password@localhost:5432/krelz'
});

pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

module.exports = pool;
