import { pool } from '../configuracion/basedeDatos.js';

// Obtener resultados de tests de un usuario (solo lectura)
export const obtenerResultadosTests = async (usuarioId) => {
  try {
    console.log('📊 [TESTS] Obteniendo resultados para usuario ID:', usuarioId);
    
    const query = `
      SELECT 
        id,
        user_id as usuario_id,
        test_id,
        score as puntuacion,
        completed_at as fecha_completado,
        created_at
      FROM _user_test_results 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados de tests`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error en obtenerResultadosTests:', error.message);
    return [];
  }
};

// Obtener detalles de un test específico (solo lectura)
export const obtenerDetallesTest = async (testId) => {
  try {
    console.log('🔍 [TESTS] Obteniendo detalles del test ID:', testId);
    
    // Intentar obtener de tabla tests_vocacionales si existe
    const query = `
      SELECT 
        id, 
        nombre, 
        descripcion, 
        duracion_minutos as duracion,
        total_preguntas as preguntas_total,
        created_at
      FROM tests_vocacionales 
      WHERE id = $1 AND activo = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [testId]);
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Si no existe, crear objeto por defecto
    return {
      id: testId,
      nombre: `Test #${testId}`,
      descripcion: 'Test vocacional',
      duracion: 30,
      preguntas_total: 20
    };
  } catch (error) {
    console.error('❌ Error en obtenerDetallesTest:', error.message);
    return {
      id: testId,
      nombre: `Test #${testId}`,
      descripcion: 'Test vocacional',
      duracion: 30,
      preguntas_total: 20
    };
  }
};

// Obtener todos los tests disponibles (solo lectura)
export const obtenerTestsDisponibles = async () => {
  try {
    console.log('📝 [TESTS] Obteniendo tests disponibles');
    
    const consulta = `
      SELECT 
        id, 
        nombre, 
        descripcion, 
        duracion_minutos as duracion,
        total_preguntas as preguntas_total,
        created_at
      FROM tests_vocacionales 
      WHERE activo = true
      ORDER BY nombre
    `;
    
    const resultado = await pool.query(consulta);
    
    if (resultado.rows.length > 0) {
      return resultado.rows;
    }
    
    // Lista por defecto si no hay tests
    return [
      {
        id: 1,
        nombre: 'Test Vocacional General',
        descripcion: 'Descubre tus intereses profesionales',
        duracion: 30,
        preguntas_total: 20
      }
    ];
  } catch (error) {
    console.error('❌ Error en obtenerTestsDisponibles:', error.message);
    return [
      {
        id: 1,
        nombre: 'Test Vocacional General',
        descripcion: 'Descubre tus intereses profesionales',
        duracion: 30,
        preguntas_total: 20
      }
    ];
  }
};

// Obtener estadísticas de tests (solo lectura)
export const obtenerEstadisticasTests = async (usuarioId) => {
  try {
    console.log('📈 [TESTS] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    const query = `
      SELECT 
        COUNT(*) as total_tests,
        AVG(score) as promedio_general,
        MAX(completed_at) as ultimo_test,
        test_id,
        COUNT(*) as cantidad_por_test,
        AVG(score) as promedio_por_test
      FROM _user_test_results 
      WHERE user_id = $1 
      GROUP BY test_id
      ORDER BY cantidad_por_test DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.cantidad_por_test), 0);
    const promedio = result.rows[0] ? parseFloat(result.rows[0].promedio_general) : 0;
    
    return {
      total_tests: total,
      promedio_general: promedio,
      ultimo_test_fecha: result.rows[0]?.ultimo_test || null,
      distribucion_tests: result.rows.map(row => ({
        test_id: row.test_id,
        cantidad: parseInt(row.cantidad_por_test),
        promedio: parseFloat(row.promedio_por_test) || 0
      }))
    };
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasTests:', error.message);
    return {
      total_tests: 0,
      promedio_general: 0,
      ultimo_test_fecha: null,
      distribucion_tests: []
    };
  }
};