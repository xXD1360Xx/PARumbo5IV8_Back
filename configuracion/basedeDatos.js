// baseDeDatos.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pkg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  ssl: process.env.ENTORNO === 'produccion' ? { rejectUnauthorized: false } : false
});

export { pool };