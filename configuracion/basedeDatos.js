import pkg from 'pg';

console.log('🚀 ========================================');
console.log('🚀 INICIANDO CONFIGURACIÓN POSTGRESQL');
console.log('🚀 ========================================');

// ========== CONFIGURACIÓN EXPLÍCITA (HARDCODEADA) ==========
const poolConfig = {
  host: 'dpg-d4em2beuk2gs739kdjkg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'rumbo_database',
  user: 'rumbo_database_user',
  password: '5zocs82oQcUfviisukaZwEGf8b0hAHAX',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // 20 segundos para DNS lento
  
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  application_name: 'northflank_app'
};

console.log('🛠️ ========= CONFIGURACIÓN POOL =========');
console.log('   Host:', poolConfig.host);
console.log('   Hostname completo?:', poolConfig.host.includes('.oregon-postgres.render.com') ? '✅ SÍ' : '❌ NO');
console.log('   Longitud hostname:', poolConfig.host.length, 'caracteres');
console.log('   DB:', poolConfig.database);
console.log('   Usuario:', poolConfig.user);
console.log('   Puerto:', poolConfig.port);
console.log('   Password length:', poolConfig.password ? '***' + poolConfig.password.length + ' caracteres***' : 'NO');
console.log('   SSL:', poolConfig.ssl.require ? '✅ REQUERIDO' : '❌ NO');
console.log('   rejectUnauthorized:', poolConfig.ssl.rejectUnauthorized ? '✅ true' : '❌ false');
console.log('   Timeout conexión:', poolConfig.connectionTimeoutMillis, 'ms');
console.log('   Max connections:', poolConfig.max);
console.log('   Min connections:', poolConfig.min);
console.log('🛠️ ======================================');

// Verificación CRÍTICA del hostname
if (!poolConfig.host.includes('.oregon-postgres.render.com')) {
  console.error('🚨 ¡ALERTA CRÍTICA! Hostname parece incompleto');
  console.error('   Actual:', poolConfig.host);
  console.error('   Debería terminar en: .oregon-postgres.render.com');
  console.error('   Ejemplo correcto: dpg-xxxx.oregon-postgres.render.com');
}

// Verificar formato de password
if (poolConfig.password && poolConfig.password.length < 10) {
  console.error('⚠️ Advertencia: Password muy corta');
}

// ========== CREAR POOL ==========
console.log('\n🔨 Creando pool de conexiones PostgreSQL...');
const pool = new pkg.Pool(poolConfig);

console.log('✅ Pool PostgreSQL creado exitosamente');

// ========== EVENTOS DEL POOL CON MEJOR LOGGING ==========
pool.on('connect', (client) => {
  const timestamp = new Date().toISOString();
  console.log(`🔄 [${timestamp}] Nueva conexión establecida - PID: ${client.processID}`);
});

pool.on('acquire', (client) => {
  console.log('🔑 Cliente adquirido del pool');
});

pool.on('release', (client) => {
  console.log('🔓 Cliente liberado al pool');
});

pool.on('remove', (client) => {
  console.log('🗑️ Cliente removido del pool');
});

pool.on('error', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`\n❌ ======= ERROR FATAL EN POOL [${timestamp}] =======`);
  console.error('❌ Mensaje:', err.message);
  console.error('❌ Código:', err.code);
  
  // Diagnóstico específico
  if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
    console.error(`
🚨🚨🚨 ERROR DNS DETECTADO 🚨🚨🚨
Hostname que falló: ${poolConfig.host}

RAZONES COMUNES:
1. Hostname incorrecto o incompleto
2. Problemas de DNS en Northflank
3. La base de datos fue eliminada en Render
4. Firewall bloqueando la conexión

VERIFICA EN RENDER:
1. Ve a dashboard.render.com
2. Busca tu servicio PostgreSQL
3. Copia el "External Database URL" actualizado
4. Verifica que esté en estado "Active"

PRUEBA MANUALMENTE:
1. Ejecuta: nslookup ${poolConfig.host}
2. Si no resuelve, el hostname es incorrecto
    `);
  }
  
  if (err.message.includes('password authentication') || err.code === '28P01') {
    console.error(`
🔐 ERROR DE AUTENTICACIÓN
Credenciales incorrectas

VERIFICA:
1. Usuario: ${poolConfig.user}
2. Contraseña: *** (${poolConfig.password?.length} caracteres)
3. En Render dashboard, verifica las credenciales actuales
    `);
  }
  
  if (err.message.includes('SSL')) {
    console.error(`
🔐 ERROR SSL
Problema con conexión segura

PRUEBA:
1. Cambia a: ssl: { rejectUnauthorized: false }
2. O usa: ssl: true
3. O deshabilita temporalmente: ssl: false (solo para pruebas)
    `);
  }
  
  if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
    console.error(`
⏱️  ERROR TIMEOUT
La conexión es muy lenta o se pierde

SOLUCIONES:
1. Aumenta connectionTimeoutMillis a 30000
2. Verifica la red entre Northflank y Render
3. Revisa IP Whitelist en Render
    `);
  }
  
  console.error('❌ =============================================\n');
});

// ========== FUNCIÓN DE VERIFICACIÓN MEJORADA ==========
export const verificarConexionDB = async (intentos = 3) => {
  console.log('\n🔍 ===== INICIANDO VERIFICACIÓN DE CONEXIÓN =====');
  console.log(`🔍 Intentos configurados: ${intentos}`);
  console.log(`🔍 Hostname: ${poolConfig.host}`);
  console.log(`🔍 Base de datos: ${poolConfig.database}`);
  console.log(`🔍 Usuario: ${poolConfig.user}`);
  console.log(`🔍 Timeout: ${poolConfig.connectionTimeoutMillis}ms`);
  
  let client;
  for (let i = 0; i < intentos; i++) {
    console.log(`\n🔄 ===== INTENTO ${i + 1}/${intentos} =====`);
    
    try {
      console.log(`📡 Conectando a ${poolConfig.host}:${poolConfig.port}...`);
      const inicioConexion = Date.now();
      
      client = await pool.connect();
      const tiempoConexion = Date.now() - inicioConexion;
      
      console.log(`✅ Conexión exitosa en ${tiempoConexion}ms`);
      console.log(`🔧 PID del cliente: ${client.processID}`);
      
      // Query de verificación básica
      console.log('🔍 Ejecutando verificación...');
      const result = await client.query(`
        SELECT 
          NOW() as server_time,
          version() as pg_version,
          current_database() as db_name,
          current_user as db_user,
          inet_server_addr() as server_ip
      `);
      
      console.log('🎉 ===== CONEXIÓN EXITOSA =====');
      console.log('⏰ Hora servidor:', result.rows[0].server_time);
      console.log('📊 PostgreSQL:', result.rows[0].pg_version.split(',')[0]);
      console.log('🗄️  Base datos:', result.rows[0].db_name);
      console.log('👤 Usuario:', result.rows[0].db_user);
      console.log('🌐 IP servidor:', result.rows[0].server_ip);
      console.log('🔒 SSL:', client.connection?.stream?.encrypted ? '✅ ACTIVADO' : '❌ DESACTIVADO');
      console.log('⚡ Tiempo:', tiempoConexion + 'ms');
      
      // Verificar tabla usuarios
      try {
        const tables = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'usuarios'
          ) as usuarios_exists,
          (SELECT COUNT(*) FROM usuarios) as total_usuarios
        `);
        console.log('📋 Tabla usuarios:', 
          tables.rows[0].usuarios_exists ? `✅ EXISTE (${tables.rows[0].total_usuarios} registros)` : '❌ NO EXISTE'
        );
      } catch (tableError) {
        console.log('⚠️ No se pudo verificar tabla usuarios:', tableError.message);
      }
      
      // Estadísticas de conexión
      try {
        const stats = await client.query(`
          SELECT 
            COUNT(*) as total_connections,
            COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `);
        console.log('📈 Conexiones DB:', {
          total: stats.rows[0].total_connections,
          activas: stats.rows[0].active_connections
        });
      } catch (statsError) {
        // Ignorar si no tiene permisos
      }
      
      return { 
        success: true,
        connected: true, 
        time: result.rows[0].server_time,
        version: result.rows[0].pg_version,
        database: result.rows[0].db_name,
        user: result.rows[0].db_user,
        ssl: client.connection?.stream?.encrypted || false,
        connectionTime: tiempoConexion,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`\n❌ ===== ERROR EN INTENTO ${i + 1} =====`);
      console.error('❌ Tipo:', error.name);
      console.error('❌ Mensaje:', error.message);
      console.error('❌ Código:', error.code);
      
      // Diagnóstico automático
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('🔍 Diagnóstico: ERROR DNS');
        console.error('💡 El hostname no se resuelve:', poolConfig.host);
        console.error('💡 Verifica:');
        console.error('   1. El hostname está completo');
        console.error('   2. La DB existe en Render');
        console.error('   3. No hay typos en el hostname');
      }
      else if (error.message.includes('password') || error.code === '28P01') {
        console.error('🔍 Diagnóstico: ERROR CREDENCIALES');
        console.error('💡 Usuario/contraseña incorrectos');
      }
      else if (error.message.includes('does not exist')) {
        console.error('🔍 Diagnóstico: DB NO EXISTE');
        console.error('💡 La base de datos', poolConfig.database, 'no existe');
      }
      else if (error.message.includes('SSL') || error.message.includes('TLS')) {
        console.error('🔍 Diagnóstico: ERROR SSL');
        console.error('💡 Prueba cambiar configuración SSL');
      }
      else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
        console.error('🔍 Diagnóstico: TIMEOUT');
        console.error('💡 Conexión muy lenta o bloqueada');
      }
      else {
        console.error('🔍 Diagnóstico: ERROR DESCONOCIDO');
        console.error('💡 Stack completo:', error.stack);
      }
      
      // Backoff exponencial
      if (i < intentos - 1) {
        const waitTime = Math.pow(2, i) * 1000;
        console.log(`\n⏳ Esperando ${waitTime/1000} segundos antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`\n🚨 ===== FALLARON TODOS LOS ${intentos} INTENTOS =====`);
        
        const errorSummary = {
          host: poolConfig.host,
          database: poolConfig.database,
          user: poolConfig.user,
          errorCode: error.code,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        };
        
        console.error('📋 Resumen error:', errorSummary);
        
        return { 
          success: false,
          connected: false, 
          error: error.message,
          code: error.code,
          summary: errorSummary,
          dnsError: error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo'),
          authError: error.message.includes('password') || error.code === '28P01',
          sslError: error.message.includes('SSL'),
          timeoutError: error.message.includes('timeout') || error.code === 'ETIMEDOUT'
        };
      }
    } finally {
      if (client) {
        client.release();
        console.log('🔓 Cliente liberado');
      }
    }
  }
};

// ========== FUNCIÓN DE DIAGNÓSTICO COMPLETO ==========
export const diagnosticoDB = async () => {
  console.log('\n🔬 ===== DIAGNÓSTICO COMPLETO DB =====');
  console.log('⏱️  Iniciando:', new Date().toISOString());
  
  // 1. Verificar configuración
  console.log('\n1. 📋 CONFIGURACIÓN ACTUAL:');
  console.log('   Hostname:', poolConfig.host);
  console.log('   Completo?:', poolConfig.host.includes('.oregon-postgres.render.com') ? '✅' : '❌');
  console.log('   DB:', poolConfig.database);
  console.log('   Usuario:', poolConfig.user);
  console.log('   Puerto:', poolConfig.port);
  console.log('   SSL:', poolConfig.ssl.require ? '✅ Activado' : '❌ Desactivado');
  console.log('   Timeout:', poolConfig.connectionTimeoutMillis + 'ms');
  
  // 2. Intentar conexión
  console.log('\n2. 🔌 PRUEBA DE CONEXIÓN:');
  try {
    const resultado = await verificarConexionDB(2);
    
    if (resultado.connected) {
      console.log('   ✅ CONEXIÓN EXITOSA');
      console.log('   ⏱️  Tiempo:', resultado.connectionTime + 'ms');
      console.log('   🔒 SSL:', resultado.ssl ? '✅' : '❌');
      console.log('   🗄️  DB:', resultado.database);
    } else {
      console.log('   ❌ CONEXIÓN FALLIDA');
      console.log('   Error:', resultado.error);
      console.log('   Código:', resultado.code);
      
      if (resultado.dnsError) {
        console.log('   🔍 Problema: DNS - Hostname no resuelve');
      }
      if (resultado.authError) {
        console.log('   🔍 Problema: Autenticación - Credenciales inválidas');
      }
      if (resultado.sslError) {
        console.log('   🔍 Problema: SSL - Configuración incorrecta');
      }
    }
    
    return resultado;
    
  } catch (error) {
    console.log('   ❌ ERROR EN DIAGNÓSTICO:', error.message);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// ========== FUNCIÓN DE PRUEBA RÁPIDA ==========
export const testConexionRapida = async () => {
  console.log('\n⚡ TEST RÁPIDO DE CONEXIÓN');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    client.release();
    console.log('✅ Test exitoso');
    return { ok: true, test: result.rows[0].test };
  } catch (error) {
    console.error('❌ Test fallido:', error.message);
    return { ok: false, error: error.message };
  }
};

// Exportar pool
export { pool };

console.log('\n✅ Módulo PostgreSQL cargado completamente');
console.log('📤 Exportados:');
console.log('   - pool (pool de conexiones)');
console.log('   - verificarConexionDB()');
console.log('   - diagnosticoDB()');
console.log('   - testConexionRapida()');
console.log('=======================================\n');