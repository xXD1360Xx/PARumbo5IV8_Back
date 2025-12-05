import pkg from 'pg';
const { Pool } = pkg;

// ========== CONFIGURACIÓN DINÁMICA ==========
// Extraer configuración de DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;

// Parsear la URL de conexión
const parseDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const user = parsed.username;
    const pass = parsed.password;
    const db = parsed.pathname?.substring(1);
    
    console.log('🔍 Componentes parseados:');
    console.log('   Host:', host);
    console.log('   Usuario:', user ? '✅ ' + user : '❌ No especificado');
    console.log('   Password:', pass ? '✅ ' + pass.substring(0, 3) + '...' : '❌ No especificada');
    console.log('   Database:', db ? '✅ ' + db : '❌ No especificada');
    
    // 2. Retornar configuración
    return {
      host: host,
      port: 5432,  // PostgreSQL default
      database: db,
      user: user,
      password: pass
    };
  } catch (error) {
    console.warn('⚠️ No se pudo parsear DATABASE_URL');
  }
};

const dbConfig = parseDatabaseUrl(DATABASE_URL);

// ========== CONFIGURACIÓN DEL POOL ==========
const poolConfig = {
  ...dbConfig,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  application_name: 'rumbo_backend'
};

console.log('📊 PostgreSQL configurado');
console.log(`   Host: ${poolConfig.host}`);
console.log(`   Database: ${poolConfig.database}`);
console.log(`   User: ${poolConfig.user}`);

// ========== CREAR POOL ==========
const pool = new Pool(poolConfig);

// ========== MANEJO DE ERRORES DEL POOL ==========
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err.message);
});

// ========== FUNCIONES DE CONEXIÓN Y VERIFICACIÓN ==========

/**
 * Verifica la conexión a PostgreSQL
 * @returns {Promise<Object>} Resultado de la verificación
 */
export const verificarConexionDB = async () => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Verificación básica
    const result = await client.query(`
      SELECT 
        NOW() as server_time,
        version() as pg_version,
        current_database() as db_name,
        current_user as db_user
    `);
    
    // Verificar las 3 tablas principales
    const tablas = await client.query(`
      SELECT 
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') as users_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_vocational_results') as vocational_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_test_results') as tests_exists,
        (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables
    `);
    
    const tablaInfo = {
      users: tablas.rows[0].users_exists ? '✅ EXISTE' : '❌ NO EXISTE',
      user_vocational_results: tablas.rows[0].results_exists ? '✅ EXISTE' : '❌ NO EXISTE',
      user_test_results: tablas.rows[0].results_exists ? '✅ EXISTE' : '❌ NO EXISTE',
      total_tables: tablas.rows[0].total_tables
    };
    
    console.log('🎉 Conexión PostgreSQL exitosa');
    console.log(`   Database: ${result.rows[0].db_name}`);
    console.log(`   User: ${result.rows[0].db_user}`);
    console.log(`   Tabla 'users': ${tablaInfo.users}`);
    console.log(`   Tabla 'user_vocational_results': ${tablaInfo.user_vocational_results}`);
    console.log(`   Tabla 'user_test_results': ${tablaInfo.user_test_results}`);
    console.log(`   Total tablas en public: ${tablaInfo.total_tables}`);
    
    return {
      success: true,
      connected: true,
      database: result.rows[0].db_name,
      user: result.rows[0].db_user,
      server_time: result.rows[0].server_time,
      version: result.rows[0].pg_version,
      tables: tablaInfo
    };
    
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    
    // Análisis rápido del error
    const errorAnalysis = {
      dns: error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo'),
      auth: error.message.includes('password') || error.code === '28P01',
      ssl: error.message.includes('SSL'),
      timeout: error.message.includes('timeout') || error.code === 'ETIMEDOUT',
      db_not_found: error.message.includes('does not exist') || error.message.includes('database')
    };
    
    return {
      success: false,
      connected: false,
      error: error.message,
      code: error.code,
      analysis: errorAnalysis
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Obtiene información detallada de las tablas
 * @returns {Promise<Object>} Información de tablas y columnas
 */
export const obtenerEstructuraTablas = async () => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Obtener todas las tablas
    const tablas = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Para cada tabla, obtener sus columnas
    const tablasConColumnas = await Promise.all(
      tablas.rows.map(async (tabla) => {
        const columnas = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position
        `, [tabla.table_name]);
        
        return {
          nombre: tabla.table_name,
          tipo: tabla.table_type,
          columnas: columnas.rows
        };
      })
    );
    
    // Buscar específicamente tus 3 tablas
    const misTablas = {
      users: tablasConColumnas.find(t => t.nombre === 'users'),
      user_vocational_results: tablasConColumnas.find(t => t.nombre === 'user_vocational_results'),
      user_test_results: tablasConColumnas.find(t => t.nombre === 'user_test_results')
    };
    
    return {
      success: true,
      total_tablas: tablas.rows.length,
      todas_tablas: tablasConColumnas,
      mis_tablas: misTablas
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estructura:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};


/**
 * Función de prueba rápida de conexión
 * @returns {Promise<Object>} Resultado simple
 */
export const testConexionSimple = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as ok');
    client.release();
    
    return { 
      ok: true, 
      test: result.rows[0].ok,
      message: 'Conexión a PostgreSQL funcional'
    };
  } catch (error) {
    return { 
      ok: false, 
      error: error.message,
      message: 'Error conectando a PostgreSQL'
    };
  }
};

/**
 * Inicializa la base de datos (verifica conexión y tablas)
 * @returns {Promise<Object>} Estado de inicialización
 */
export const inicializarDB = async () => {
  console.log('🔧 Inicializando conexión a PostgreSQL...');
  
  const conexion = await verificarConexionDB();
  
  if (!conexion.success) {
    console.error('❌ No se pudo conectar a PostgreSQL');
    return {
      initialized: false,
      connection: conexion,
      tables: null
    };
  }
  
  console.log('✅ Conexión a PostgreSQL establecida');
  
  // Verificar estructura de tablas
  const estructura = await obtenerEstructuraTablas();
  
  if (!estructura.success) {
    console.warn('⚠️ No se pudo obtener estructura de tablas');
  } else {
    console.log(`📊 Se encontraron ${estructura.total_tablas} tablas en la base de datos`);
    
    // Verificar si existen tus tablas principales
    if (estructura.mis_tablas.users) {
      console.log(`   ✅ Tabla 'users' encontrada (${estructura.mis_tablas.users.columnas.length} columnas)`);
    } else {
      console.log('   ⚠️ Tabla \'users\' no encontrada');
    }
    
    if (estructura.mis_tablas.user_vocational_results) {
      console.log(`   ✅ Tabla 'user_vocational_results' encontrada (${estructura.mis_tablas.user_vocational_results.columnas.length} columnas)`);
    } else {
      console.log('   ⚠️ Tabla \'user_vocational_results\' no encontrada');
    }

    if (estructura.mis_tablas.user_test_results) {
      console.log(`   ✅ Tabla 'user_test_results' encontrada (${estructura.mis_tablas.user_test_results.columnas.length} columnas)`);
    } else {
      console.log('   ⚠️ Tabla \'user_test_results\' no encontrada');
    }
  }
  
  return {
    initialized: true,
    connection: conexion,
    tables: estructura.success ? estructura : null
  };
};

// ========== EXPORTAR ==========
export { pool };

// Inicialización automática
inicializarDB().then(estado => {
  if (estado.initialized) {
    console.log('🚀 PostgreSQL listo');
  } else {
    console.error('❌ PostgreSQL no se pudo conectar');
  }
});

console.log('✅ Módulo PostgreSQL cargado');
console.log('📤 Exportados: pool, verificarConexionDB, obtenerEstructuraTablas, testConexionSimple, inicializarDB');