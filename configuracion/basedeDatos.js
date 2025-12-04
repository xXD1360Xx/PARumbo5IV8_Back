import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuración óptima para Render
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,  // Óptimo para Render (no 30, consume mucho)
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
    require: true  // CRÍTICO para Render
  },
  // Agrega configuración de DNS
  keepAlive: true,
  keepAliveInitialDelayMillis: 0
};

const pool = new pkg.Pool(poolConfig);

// Manejo de errores del pool
pool.on('connect', () => {
  console.log('🔄 Nueva conexión establecida con PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err.message);
  // No salir del proceso, solo loguear
});

// Función para verificar la conexión con reintentos
export const verificarConexionDB = async (intentos = 3) => {
  let client;
  for (let i = 0; i < intentos; i++) {
    try {
      client = await pool.connect();
      const result = await client.query('SELECT NOW() as time');
      console.log(`✅ Conexión a PostgreSQL exitosa (intento ${i + 1})`);
      console.log('⏰ Hora del servidor:', result.rows[0].time);
      
      // También verificar si existe la tabla usuarios
      try {
        const tables = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'usuarios'
          );
        `);
        console.log('📋 Tabla usuarios existe:', tables.rows[0].exists);
      } catch (tableError) {
        console.log('⚠️ No se pudo verificar tabla usuarios:', tableError.message);
      }
      
      return { connected: true, time: result.rows[0].time };
    } catch (error) {
      console.error(`❌ Intento ${i + 1} - Error conectando a PostgreSQL:`, error.message);
      
      // Detalles específicos del error
      if (error.message.includes('ENOTFOUND')) {
        console.error('🚨 ERROR DNS: No se puede resolver el host de la base de datos');
        console.error('🔍 Hostname intentado:', process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1] || 'No detectado');
      }
      
      if (i < intentos - 1) {
        console.log(`⏳ Reintentando en 2 segundos... (${i + 1}/${intentos})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('🚨 CRÍTICO: No se pudo conectar a PostgreSQL después de', intentos, 'intentos');
        return { 
          connected: false, 
          error: error.message,
          dnsError: error.message.includes('ENOTFOUND')
        };
      }
    } finally {
      if (client) client.release();
    }
  }
};

// Verificar conexión al iniciar con retardo
setTimeout(() => {
  verificarConexionDB().then(result => {
    if (!result.connected) {
      console.error('🚨 CRÍTICO: No se pudo conectar a la base de datos');
      // Si es error DNS, sugerir solución
      if (result.dnsError) {
        console.error(`
🚨🚨🚨 SOLUCIÓN PARA ERROR DNS 🚨🚨🚨
El problema es que Render no puede resolver: dpg-d4em2beuk2gs739kdjkg-a

1. VERIFICA que la DB esté activa en dashboard.render.com
2. POSIBLE SOLUCIÓN: Usar la IP directa en lugar del nombre
   - Ve a tu PostgreSQL en Render
   - Haz clic en "Connect"
   - Usa la "External Database URL" que incluye la IP
3. ALTERNATIVA: Espera 5-10 minutos, a veces es cache DNS
        `);
      }
    }
  });
}, 1000); // Retardo para asegurar que dotenv cargó

export { pool };