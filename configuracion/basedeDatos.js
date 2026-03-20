import pkg from 'pg';
const { Pool } = pkg;

// ========== CONFIGURACIÓN POR VARIABLES DE ENTORNO ==========
const DB_HOST = process.env.DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'postgres';
const DB_USER = process.env.DB_USER || 'postgres.cpbjuaphyqtnfxfzqhzi';
const DB_PASSWORD = process.env.DB_PASSWORD || 'eT2UkocN3oXWRtG4';

// Mostrar solo información básica de conexión
console.log('🔌 Configurando conexión a PostgreSQL...');

// Verificar que tenemos la información mínima necesaria
if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('❌ ERROR: Faltan variables de entorno requeridas');
  console.error('   Requeridas: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  process.exit(1);
}

// ========== CONFIGURACIÓN DEL POOL ==========
const poolConfig = {
  host: DB_HOST,
  port: parseInt(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  application_name: 'rumbo_backend'
};

// ========== CREAR POOL ==========
const pool = new Pool(poolConfig);

// ========== MANEJO DE ERRORES DEL POOL ==========
pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err.message);
});

// ========== FUNCIÓN DE VERIFICACIÓN DE CONEXIÓN ==========

/**
 * Verifica que la conexión a la base de datos sea exitosa
 * @returns {Promise<Object>} Resultado simple de la verificación
 */
export const verificarConexionDB = async () => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Consulta simple para verificar que todo funciona
    const result = await client.query('SELECT NOW() as tiempo');
    
    console.log('✅ Conexión a PostgreSQL establecida correctamente');
    
    return {
      success: true,
      connected: true,
      tiempo: result.rows[0].tiempo
    };
    
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    
    return {
      success: false,
      connected: false,
      error: error.message
    };
  } finally {
    if (client) client.release();
  }
};

// ========== EXPORTAR ==========
export { pool };
export default pool;

// Verificar conexión al iniciar (sin bloqueo)
verificarConexionDB().catch(err => {
  console.warn('⚠️ No se pudo verificar conexión inicial:', err.message);
});