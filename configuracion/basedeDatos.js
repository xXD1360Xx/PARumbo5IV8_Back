import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Verificando DATABASE_URL...');
console.log('📋 DATABASE_URL presente:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  console.log('🔗 URL (ocultando contraseña):', 
    process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
}

// Configuración ESPECÍFICA para Render PostgreSQL
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // IMPORTANTE: Render necesita estas configuraciones
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  // Ajustes de conexión
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  
  // Parámetros CRÍTICOS para Render
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  
  // Resolver problemas de DNS
  connectionTimeoutMillis: 5000, // 5 segundos máximo para conectar
  query_timeout: 10000, // 10 segundos máximo por query
};

const pool = new pkg.Pool(poolConfig);

// Debug del pool
console.log('🛠️ Pool configurado con:');
console.log('   - Max connections:', poolConfig.max);
console.log('   - Min connections:', poolConfig.min);
console.log('   - SSL:', poolConfig.ssl.require ? 'REQUERIDO' : 'no');

// Manejo de errores del pool
pool.on('connect', (client) => {
  console.log('🔄 Nueva conexión establecida con PostgreSQL en Render');
});

pool.on('acquire', (client) => {
  console.log('🔑 Cliente adquirido del pool');
});

pool.on('remove', (client) => {
  console.log('🗑️ Cliente removido del pool');
});

pool.on('error', (err) => {
  console.error('❌ Error FATAL en el pool de PostgreSQL:', err.message);
  console.error('🔧 Stack:', err.stack);
  
  // Información específica para debugging
  if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
    console.error(`
🚨🚨🚨 ERROR DNS DETECTADO 🚨🚨🚨
El hostname no puede resolverse: dpg-d4em2beuk2gs739kdjkg-a.oregon-postgres.render.com

SOLUCIONES:
1. Espera 5-10 minutos (puede ser cache DNS de Render)
2. Verifica en dashboard.render.com que tu PostgreSQL esté "Active"
3. Prueba usar la IP directamente si Render la proporciona
4. A veces Render cambia el hostname, revisa la URL actualizada
    `);
  }
});

// Función para verificar la conexión con reintentos MEJORADA
export const verificarConexionDB = async (intentos = 5) => {
  console.log('🔍 Iniciando verificación de conexión DB...');
  
  let client;
  for (let i = 0; i < intentos; i++) {
    try {
      console.log(`🔄 Intento ${i + 1}/${intentos} de conectar a DB...`);
      
      client = await pool.connect();
      console.log('✅ Cliente conectado, ejecutando query...');
      
      // Query simple para verificar conexión
      const result = await client.query('SELECT NOW() as server_time, version() as pg_version');
      
      console.log('🎉 Conexión a PostgreSQL exitosa!');
      console.log('⏰ Hora del servidor:', result.rows[0].server_time);
      console.log('📊 Versión PostgreSQL:', result.rows[0].pg_version.split(',')[0]);
      
      // Verificar tabla usuarios
      try {
        const tables = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'usuarios'
          ) as usuarios_exists;
        `);
        console.log('📋 Tabla usuarios existe:', tables.rows[0].usuarios_exists);
      } catch (tableError) {
        console.log('⚠️ No se pudo verificar tabla usuarios:', tableError.message);
      }
      
      // Verificar número de conexiones activas
      try {
        const connections = await client.query(`
          SELECT COUNT(*) as active_connections 
          FROM pg_stat_activity 
          WHERE datname = 'rumbo_database';
        `);
        console.log('🔗 Conexiones activas a la DB:', connections.rows[0].active_connections);
      } catch (connError) {
        // Ignorar si no tiene permisos
      }
      
      return { 
        connected: true, 
        time: result.rows[0].server_time,
        version: result.rows[0].pg_version 
      };
      
    } catch (error) {
      console.error(`❌ Intento ${i + 1} - Error:`, error.message);
      console.error('🔧 Error code:', error.code);
      console.error('🔧 Error stack:', error.stack);
      
      // Análisis detallado del error
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('🚨 ERROR DNS: No se puede resolver el hostname');
        console.error('🔍 Hostname problemático: dpg-d4em2beuk2gs739kdjkg-a.oregon-postgres.render.com');
      }
      
      if (error.message.includes('password authentication')) {
        console.error('🔐 ERROR: Autenticación fallida - Revisa usuario/contraseña');
      }
      
      if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('🗄️ ERROR: La base de datos "rumbo_database" no existe');
      }
      
      if (i < intentos - 1) {
        const waitTime = Math.pow(2, i) * 1000; // Backoff exponencial
        console.log(`⏳ Esperando ${waitTime/1000} segundos antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`🚨 Fallaron todos los ${intentos} intentos de conexión`);
        return { 
          connected: false, 
          error: error.message,
          code: error.code,
          dnsError: error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo'),
          authError: error.message.includes('password authentication'),
          dbError: error.message.includes('database')
        };
      }
    } finally {
      if (client) {
        client.release();
        console.log('🔓 Cliente liberado del pool');
      }
    }
  }
};

// Exportar pool
export { pool };