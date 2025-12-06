import pkg from 'pg';
const { Pool } = pkg;

// ========== CONFIGURACIÓN DINÁMICA ==========
// Extraer configuración de DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;

// Parsear la URL de conexión 
const parseDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    
    // Extraer hostname completo (sin puerto)
    let host = parsed.hostname;
    // Asegurar el subdominio correcto para Render.com
    host = `${host}.oregon-postgres.render.com`;
    
    return {
      host: host,
      port: 5432,
      database: parsed.pathname?.substring(1),
      user: parsed.username,
      password: parsed.password
    };
    
  } catch (error) {
    console.error('❌ Error parseando DATABASE_URL:', error.message);
    return null;
  }
};

const parsed = parseDatabaseUrl(DATABASE_URL);

if (!parsed) {
  console.error('❌ ERROR CRÍTICO: No se pudo obtener configuración de DB');
  process.exit(1); // Detener la aplicación
}

console.log('✅ Configuración obtenida de DATABASE_URL');
const dbConfig = parsed;

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
 * Verificación BÁSICA de conexión (sin chequeo de tablas específicas)
 * @returns {Promise<Object>} Resultado de la verificación básica
 */
export const verificarConexionDB = async () => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Verificación básica únicamente
    const result = await client.query(`
      SELECT 
        NOW() as server_time,
        version() as pg_version,
        current_database() as db_name,
        current_user as db_user,
        inet_server_addr() as server_ip
    `);
    
    console.log('🎉 Conexión PostgreSQL exitosa');
    console.log(`   Database: ${result.rows[0].db_name}`);
    console.log(`   User: ${result.rows[0].db_user}`);
    console.log(`   Server IP: ${result.rows[0].server_ip}`);
    console.log(`   PostgreSQL: ${result.rows[0].pg_version.split(',')[0]}`);
    console.log(`   Hora servidor: ${result.rows[0].server_time}`);
    
    return {
      success: true,
      connected: true,
      database: result.rows[0].db_name,
      user: result.rows[0].db_user,
      server_time: result.rows[0].server_time,
      version: result.rows[0].pg_version,
      server_ip: result.rows[0].server_ip
    };
    
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    
    return {
      success: false,
      connected: false,
      error: error.message,
      code: error.code
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Obtiene información DETALLADA de todas las tablas y columnas
 * @returns {Promise<Object>} Información completa de estructura
 */
export const obtenerEstructuraCompletaDB = async () => {
  let client;
  
  try {
    client = await pool.connect();
    
    // 1. Obtener TODAS las tablas con información básica
    const tablas = await client.query(`
      SELECT 
        table_name,
        table_type,
        (SELECT COUNT(*) 
         FROM information_schema.columns c 
         WHERE c.table_schema = t.table_schema 
           AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📊 Se encontraron ${tablas.rows.length} tablas en la base de datos`);
    
    // 2. Para cada tabla, obtener sus columnas DETALLADAS
    const tablasConDetalles = await Promise.all(
      tablas.rows.map(async (tabla) => {
        const columnas = await client.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position
        `, [tabla.table_name]);
        
        // Formatear columnas para mejor visualización
        const columnasFormateadas = columnas.rows.map(col => ({
          nombre: col.column_name,
          tipo: col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : ''),
          nulo: col.is_nullable === 'YES' ? '✅ SÍ' : '❌ NO',
          valor_default: col.column_default || 'Ninguno',
          posicion: col.ordinal_position
        }));
        
        return {
          nombre: tabla.table_name,
          tipo: tabla.table_type,
          total_columnas: tabla.column_count,
          columnas: columnasFormateadas
        };
      })
    );
    
    // 3. Identificar las tablas principales (tus 3 tablas clave)
    const misTablas = {
      usuarios: tablasConDetalles.find(t => t.nombre === '_users'),
      resultados_vocacionales: tablasConDetalles.find(t => t.nombre === 'user_vocational_results'),
      resultados_tests: tablasConDetalles.find(t => t.nombre === '_user_test_results')
    };
    
    // 4. Mostrar información DETALLADA de las tablas principales
    console.log('\n🔍 ===== TABLAS PRINCIPALES =====');
    
    if (misTablas.usuarios) {
      console.log(`\n📋 Tabla: '_users' (${misTablas.usuarios.total_columnas} columnas)`);
      console.log('   Columnas:');
      misTablas.usuarios.columnas.forEach(col => {
        console.log(`     ${col.posicion}. ${col.nombre} (${col.tipo}) - Nulo: ${col.nulo}`);
      });
    } else {
      console.log('❌ Tabla \'_users\' NO encontrada');
    }
    
    if (misTablas.resultados_vocacionales) {
      console.log(`\n📋 Tabla: 'user_vocational_results' (${misTablas.resultados_vocacionales.total_columnas} columnas)`);
      console.log('   Columnas:');
      misTablas.resultados_vocacionales.columnas.forEach(col => {
        console.log(`     ${col.posicion}. ${col.nombre} (${col.tipo}) - Nulo: ${col.nulo}`);
      });
    } else {
      console.log('❌ Tabla \'user_vocational_results\' NO encontrada');
    }
    
    if (misTablas.resultados_tests) {
      console.log(`\n📋 Tabla: '_user_test_results' (${misTablas.resultados_tests.total_columnas} columnas)`);
      console.log('   Columnas:');
      misTablas.resultados_tests.columnas.forEach(col => {
        console.log(`     ${col.posicion}. ${col.nombre} (${col.tipo}) - Nulo: ${col.nulo}`);
      });
    } else {
      console.log('❌ Tabla \'_user_test_results\' NO encontrada');
    }
    
    // 5. Mostrar otras tablas disponibles
    const otrasTablas = tablasConDetalles.filter(t => 
      !['_users', 'user_vocational_results', '_user_test_results'].includes(t.nombre)
    );
    
    if (otrasTablas.length > 0) {
      console.log('\n📋 ===== OTRAS TABLAS DISPONIBLES =====');
      otrasTablas.forEach(tabla => {
        console.log(`   • ${tabla.nombre} (${tabla.tipo}, ${tabla.total_columnas} columnas)`);
      });
    }
    
    // 6. Generar resumen para uso en API
    const resumenTablas = {
      total_tablas: tablas.rows.length,
      tablas_principales: {
        _users: misTablas.usuarios ? {
          existe: true,
          columnas: misTablas.usuarios.columnas.map(c => c.nombre),
          total_columnas: misTablas.usuarios.total_columnas
        } : { existe: false },
        
        user_vocational_results: misTablas.resultados_vocacionales ? {
          existe: true,
          columnas: misTablas.resultados_vocacionales.columnas.map(c => c.nombre),
          total_columnas: misTablas.resultados_vocacionales.total_columnas
        } : { existe: false },
        
        _user_test_results: misTablas.resultados_tests ? {
          existe: true,
          columnas: misTablas.resultados_tests.columnas.map(c => c.nombre),
          total_columnas: misTablas.resultados_tests.total_columnas
        } : { existe: false }
      },
      otras_tablas: otrasTablas.map(t => ({
        nombre: t.nombre,
        tipo: t.tipo,
        total_columnas: t.total_columnas
      }))
    };
    
    return {
      success: true,
      estructura_completa: tablasConDetalles,
      resumen: resumenTablas,
      mis_tablas: misTablas
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estructura de base de datos:', error.message);
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
 * Inicializa la base de datos con verificación COMPLETA
 * @returns {Promise<Object>} Estado de inicialización detallado
 */
export const inicializarDB = async () => {
  console.log('\n🔧 ===== INICIALIZANDO BASE DE DATOS =====');
  
  // 1. Verificar conexión básica
  console.log('🔗 Verificando conexión básica...');
  const conexion = await verificarConexionDB();
  
  if (!conexion.success) {
    console.error('❌ No se pudo conectar a PostgreSQL');
    return {
      initialized: false,
      connection: conexion,
      estructura: null
    };
  }
  
  console.log('✅ Conexión básica establecida');
  
  // 2. Obtener estructura COMPLETA de la base de datos
  console.log('🔍 Obteniendo estructura completa...');
  const estructura = await obtenerEstructuraCompletaDB();
  
  if (!estructura.success) {
    console.error('⚠️ No se pudo obtener estructura completa');
    return {
      initialized: true, // Conexión sí, estructura no
      connection: conexion,
      estructura: null,
      warning: 'Conexión exitosa pero no se pudo analizar estructura'
    };
  }
  
  console.log('✅ Estructura obtenida exitosamente');
  
  // 3. Generar resumen para logs de inicio
  console.log('\n📋 ===== RESUMEN INICIAL =====');
  console.log(`   ✅ PostgreSQL conectado: ${conexion.database}`);
  console.log(`   ✅ Total tablas: ${estructura.resumen.total_tablas}`);
  
  const tablasPrincipales = estructura.resumen.tablas_principales;
  console.log(`   ✅ Tabla '_users': ${tablasPrincipales._users.existe ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
  console.log(`   ✅ Tabla 'user_vocational_results': ${tablasPrincipales.user_vocational_results.existe ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
  console.log(`   ✅ Tabla '_user_test_results': ${tablasPrincipales._user_test_results.existe ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
  
  return {
    initialized: true,
    connection: conexion,
    estructura: estructura,
    resumen: {
      database: conexion.database,
      total_tablas: estructura.resumen.total_tablas,
      tablas_principales: estructura.resumen.tablas_principales
    }
  };
};

// ========== EXPORTAR ==========
export { pool };

// Inicialización automática al cargar el módulo
inicializarDB().then(estado => {
  if (estado.initialized) {
    console.log('\n🚀 PostgreSQL inicializado correctamente');
    console.log('========================================');
  } else {
    console.error('\n❌ Falló la inicialización de PostgreSQL');
  }
}).catch(error => {
  console.error('\n❌ Error en inicialización:', error.message);
});

console.log('✅ Módulo PostgreSQL cargado');
console.log('📤 Exportados: pool, verificarConexionDB, obtenerEstructuraCompletaDB, testConexionSimple, inicializarDB');