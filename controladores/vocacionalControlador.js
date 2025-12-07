import { pool } from '../configuracion/basedeDatos.js';

// Obtener todos los resultados vocacionales de un usuario - CORREGIDO
export const obtenerResultadosVocacionales = async (usuarioId) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo resultados para usuario ID:', usuarioId);
    
    const query = `
      SELECT 
        id,
        user_id as usuario_id,
        test_date as fecha,
        resultados_completos as respuestas,
        top_carreras as carreras,
        score_global as promedio_general,
        zona_ikigai,
        created_at,
        updated_at,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social
      FROM user_vocational_results 
      WHERE user_id = $1 
      ORDER BY test_date DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados vocacionales`);
    
    // Parsear los JSON strings si es necesario
    const resultados = result.rows.map(item => ({
      ...item,
      respuestas: item.respuestas ? (typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas) : {},
      carreras: item.carreras ? (typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras) : []
    }));
    
    return resultados;
  } catch (error) {
    console.error('❌ Error en obtenerResultadosVocacionales:', error);
    return []; // Retornar array vacío en lugar de lanzar error
  }
};

// Obtener solo el último resultado vocacional - CORREGIDO
export const obtenerUltimoResultadoVocacional = async (usuarioId) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo último resultado para usuario ID:', usuarioId);
    
    const query = `
      SELECT 
        id,
        user_id as usuario_id,
        test_date as fecha,
        resultados_completos as respuestas,
        top_carreras as carreras,
        score_global as promedio_general,
        zona_ikigai,
        created_at,
        updated_at,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social
      FROM user_vocational_results 
      WHERE user_id = $1 
      ORDER BY test_date DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      console.log('ℹ️ No se encontraron resultados vocacionales');
      return null;
    }
    
    const item = result.rows[0];
    const resultado = {
      ...item,
      respuestas: item.respuestas ? (typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas) : {},
      carreras: item.carreras ? (typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras) : []
    };
    
    console.log('✅ Último resultado encontrado ID:', resultado.id);
    return resultado;
  } catch (error) {
    console.error('❌ Error en obtenerUltimoResultadoVocacional:', error);
    return null;
  }
};

// Obtener estadísticas vocacionales - CORREGIDO
export const obtenerEstadisticasVocacionales = async (usuarioId) => {
  try {
    console.log('📈 [VOCACIONAL] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    const consulta = `
      SELECT 
        COUNT(*) as total_resultados,
        AVG(score_global) as promedio_general,
        MAX(test_date) as fecha_ultimo,
        zona_ikigai,
        COUNT(*) as cantidad_por_zona
      FROM user_vocational_results 
      WHERE user_id = $1 
      GROUP BY zona_ikigai
      ORDER BY cantidad_por_zona DESC
    `;
    
    const resultado = await pool.query(consulta, [usuarioId]);
    
    // Obtener también el total de resultados
    const totalQuery = `SELECT COUNT(*) as total FROM user_vocational_results WHERE user_id = $1`;
    const totalResult = await pool.query(totalQuery, [usuarioId]);
    
    const total = parseInt(totalResult.rows[0]?.total || 0);
    
    const distribucion_zonas = resultado.rows.map(item => ({
      zona_ikigai: item.zona_ikigai || 'No definida',
      cantidad: parseInt(item.cantidad_por_zona || 0),
      porcentaje: total > 0 ? Math.round((parseInt(item.cantidad_por_zona || 0) / total) * 100) : 0
    }));
    
    // Obtener el promedio general de todos los resultados
    const promedioQuery = `SELECT AVG(score_global) as promedio FROM user_vocational_results WHERE user_id = $1`;
    const promedioResult = await pool.query(promedioQuery, [usuarioId]);
    
    const estadisticas = {
      total_resultados: total,
      promedio_general: promedioResult.rows[0]?.promedio ? parseFloat(promedioResult.rows[0].promedio).toFixed(2) : "0.00",
      distribucion_zonas: distribucion_zonas,
      fecha_ultimo_resultado: resultado.rows[0]?.fecha_ultimo || null
    };
    
    console.log('📊 Estadísticas vocacionales:', estadisticas);
    return estadisticas;
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasVocacionales:', error);
    // Retornar estadísticas por defecto
    return {
      total_resultados: 0,
      promedio_general: "0.00",
      distribucion_zonas: [],
      fecha_ultimo_resultado: null
    };
  }
};