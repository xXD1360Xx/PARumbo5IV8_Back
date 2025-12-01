import { pool } from '../configuracion/basedeDatos.js';

// Obtener todos los resultados vocacionales de un usuario
export const obtenerResultadosVocacionales = async (usuarioId) => {
  try {
    const query = `
      SELECT 
        id,
        usuario_id,
        fecha,
        respuestas,
        carreras,
        promedio_general,
        zona_ikigai,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      ORDER BY fecha DESC
    `;
    const result = await pool.query(query, [usuarioId]);
    
    // Parsear los JSON strings si es necesario
    const resultados = result.rows.map(item => ({
      ...item,
      respuestas: typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas,
      carreras: typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras
    }));
    
    return resultados;
  } catch (error) {
    console.error('Error en obtenerResultadosVocacionales:', error);
    throw error;
  }
};

// Obtener solo el último resultado vocacional
export const obtenerUltimoResultadoVocacional = async (usuarioId) => {
  try {
    const query = `
      SELECT 
        id,
        usuario_id,
        fecha,
        respuestas,
        carreras,
        promedio_general,
        zona_ikigai,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      ORDER BY fecha DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const item = result.rows[0];
    return {
      ...item,
      respuestas: typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas,
      carreras: typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras
    };
  } catch (error) {
    console.error('Error en obtenerUltimoResultadoVocacional:', error);
    throw error;
  }
};

// Obtener estadísticas vocacionales
export const obtenerEstadisticasVocacionales = async (usuarioId) => {
  try {
    const consulta = `
      SELECT 
        COUNT(*) as total_resultados,
        AVG(promedio_general) as promedio_general,
        MAX(fecha) as fecha_ultimo,
        zona_ikigai,
        COUNT(*) as cantidad_por_zona
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      GROUP BY zona_ikigai
      ORDER BY cantidad_por_zona DESC
    `;
    
    const resultado = await pool.query(consulta, [usuarioId]);
    
    // Obtener también el total de resultados
    const totalQuery = `SELECT COUNT(*) as total FROM user_vocational_results WHERE usuario_id = $1`;
    const totalResult = await pool.query(totalQuery, [usuarioId]);
    
    const total = parseInt(totalResult.rows[0].total);
    
    const distribucion_zonas = resultado.rows.map(item => ({
      zona_ikigai: item.zona_ikigai,
      cantidad: parseInt(item.cantidad_por_zona),
      porcentaje: total > 0 ? Math.round((parseInt(item.cantidad_por_zona) / total) * 100) : 0
    }));
    
    // Obtener el promedio general de todos los resultados
    const promedioQuery = `SELECT AVG(promedio_general) as promedio FROM user_vocational_results WHERE usuario_id = $1`;
    const promedioResult = await pool.query(promedioQuery, [usuarioId]);
    
    return {
      total_resultados: total,
      promedio_general: promedioResult.rows[0].promedio ? parseFloat(promedioResult.rows[0].promedio).toFixed(2) : 0,
      distribucion_zonas: distribucion_zonas
    };
  } catch (error) {
    console.error('Error en obtenerEstadisticasVocacionales:', error);
    throw error;
  }
};

// Guardar resultado vocacional
export const guardarResultadoVocacional = async (usuarioId, resultadoData) => {
  try {
    const { respuestas, carreras, promedio_general, zona_ikigai } = resultadoData;
    
    const query = `
      INSERT INTO user_vocational_results 
      (usuario_id, respuestas, carreras, promedio_general, zona_ikigai) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      usuarioId,
      JSON.stringify(respuestas),
      JSON.stringify(carreras),
      promedio_general,
      zona_ikigai
    ]);
    
    const item = result.rows[0];
    return {
      ...item,
      respuestas: typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas,
      carreras: typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras
    };
  } catch (error) {
    console.error('Error en guardarResultadoVocacional:', error);
    throw error;
  }
};

// Eliminar resultado vocacional
export const eliminarResultadoVocacional = async (id, usuarioId) => {
  try {
    const query = `
      DELETE FROM user_vocational_results 
      WHERE id = $1 AND usuario_id = $2 
      RETURNING id
    `;
    
    const result = await pool.query(query, [id, usuarioId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error en eliminarResultadoVocacional:', error);
    throw error;
  }
};