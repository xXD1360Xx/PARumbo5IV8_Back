import { pool } from '../configuracion/basedeDatos.js';

// Obtener resultados de tests de un usuario
export const obtenerResultadosTests = async (usuarioId) => {
  try {
    const query = `
      SELECT * FROM user_test_results 
      WHERE usuario_id = $1 
      ORDER BY fecha DESC
    `;
    const result = await pool.query(query, [usuarioId]);
    return result.rows;
  } catch (error) {
    console.error('Error en obtenerResultadosTests:', error);
    throw error;
  }
};

// Obtener detalles de un test específico
export const obtenerDetallesTest = async (testId) => {
  try {
    const query = `
      SELECT id, nombre, descripcion, duracion, preguntas_total 
      FROM tests_vocacionales 
      WHERE id = $1 AND activo = true
    `;
    const result = await pool.query(query, [testId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error en obtenerDetallesTest:', error);
    throw error;
  }
};

// Obtener todos los tests disponibles
export const obtenerTestsDisponibles = async () => {
  try {
    const consulta = `
      SELECT id, nombre, descripcion, duracion, preguntas_total, fecha_creacion
      FROM tests_vocacionales 
      WHERE activo = true
      ORDER BY nombre
    `;
    
    const resultado = await pool.query(consulta);
    return resultado.rows;
  } catch (error) {
    console.error('Error en obtenerTestsDisponibles:', error);
    throw error;
  }
};

// Insertar resultado de test
export const insertarResultadoTest = async (usuarioId, testId, puntuacion, areas = null) => {
  try {
    const query = `
      INSERT INTO user_test_results (usuario_id, test_id, puntuacion, areas) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      usuarioId, 
      testId, 
      puntuacion, 
      areas ? JSON.stringify(areas) : null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error en insertarResultadoTest:', error);
    throw error;
  }
};

// Obtener estadísticas de tests
export const obtenerEstadisticasTests = async (usuarioId) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_tests,
        AVG(puntuacion) as promedio_general,
        MAX(fecha) as ultimo_test,
        test_id,
        COUNT(*) as cantidad_por_test,
        AVG(puntuacion) as promedio_por_test
      FROM user_test_results 
      WHERE usuario_id = $1 
      GROUP BY test_id
      ORDER BY cantidad_por_test DESC
    `;
    const result = await pool.query(query, [usuarioId]);
    
    // Calcular total sumando todos los tests individuales
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.cantidad_por_test), 0);
    const promedio = result.rows[0] ? parseFloat(result.rows[0].promedio_general) : 0;
    
    return {
      total_tests: total,
      promedio_general: promedio,
      distribucion_tests: result.rows.map(row => ({
        test_id: row.test_id,
        cantidad: parseInt(row.cantidad_por_test),
        promedio: parseFloat(row.promedio_por_test) || 0
      }))
    };
  } catch (error) {
    console.error('Error en obtenerEstadisticasTests:', error);
    throw error;
  }
};

// Eliminar resultado de test
export const eliminarResultadoTest = async (id, usuarioId) => {
  try {
    const query = `
      DELETE FROM user_test_results 
      WHERE id = $1 AND usuario_id = $2 
      RETURNING id
    `;
    
    const result = await pool.query(query, [id, usuarioId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error en eliminarResultadoTest:', error);
    throw error;
  }
};