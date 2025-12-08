import { pool } from '../configuracion/basedeDatos.js';

// Obtener todos los resultados vocacionales de un usuario
export const obtenerResultadosVocacionales = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo resultados para usuario ID:', usuarioId);
    
    // Si no se especifica usuarioActualId, usar el mismo usuarioId
    if (!usuarioActualId) {
      usuarioActualId = usuarioId;
    }
    
    // Verificar permisos (si el perfil es privado)
    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        // Perfil privado: verificar si el usuario actual sigue al usuario
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          console.log('🚫 Sin permisos para ver resultados vocacionales de usuario privado');
          return [];
        }
      }
    }
    
    const query = `
      SELECT 
        id,
        user_id,
        test_date,
        resultados_completos,
        top_carreras,
        score_global,
        zona_ikigai,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE user_id = $1 
      ORDER BY test_date DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados vocacionales`);
    
    // Parsear los JSON strings si es necesario
    const resultados = result.rows.map(item => ({
      id: item.id,
      user_id: item.user_id,
      test_date: item.test_date,
      resultados_completos: parsearJSON(item.resultados_completos, []),
      top_carreras: parsearJSON(item.top_carreras, []),
      score_global: parseFloat(item.score_global || 0),
      zona_ikigai: item.zona_ikigai,
      perfil_tecnologico: parseFloat(item.perfil_tecnologico || 0),
      perfil_cientifico: parseFloat(item.perfil_cientifico || 0),
      perfil_salud: parseFloat(item.perfil_salud || 0),
      perfil_administrativo: parseFloat(item.perfil_administrativo || 0),
      perfil_social: parseFloat(item.perfil_social || 0),
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
    
    return resultados;
  } catch (error) {
    console.error('❌ Error en obtenerResultadosVocacionales:', error);
    return [];
  }
};

// Obtener el último resultado vocacional
export const obtenerUltimoResultadoVocacional = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo último resultado para usuario ID:', usuarioId);
    
    // Si no se especifica usuarioActualId, usar el mismo usuarioId
    if (!usuarioActualId) {
      usuarioActualId = usuarioId;
    }
    
    // Verificar permisos (si el perfil es privado)
    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        // Perfil privado: verificar si el usuario actual sigue al usuario
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          console.log('🚫 Sin permisos para ver último resultado vocacional de usuario privado');
          return null;
        }
      }
    }
    
    const query = `
      SELECT 
        id,
        user_id,
        test_date,
        resultados_completos,
        top_carreras,
        score_global,
        zona_ikigai,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE user_id = $1 
      ORDER BY test_date DESC, created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      console.log('ℹ️ No se encontraron resultados vocacionales');
      return null;
    }
    
    const item = result.rows[0];
    const resultado = {
      id: item.id,
      user_id: item.user_id,
      test_date: item.test_date,
      resultados_completos: parsearJSON(item.resultados_completos, []),
      top_carreras: parsearJSON(item.top_carreras, []),
      score_global: parseFloat(item.score_global || 0),
      zona_ikigai: item.zona_ikigai,
      perfil_tecnologico: parseFloat(item.perfil_tecnologico || 0),
      perfil_cientifico: parseFloat(item.perfil_cientifico || 0),
      perfil_salud: parseFloat(item.perfil_salud || 0),
      perfil_administrativo: parseFloat(item.perfil_administrativo || 0),
      perfil_social: parseFloat(item.perfil_social || 0),
      created_at: item.created_at,
      updated_at: item.updated_at
    };
    
    console.log('✅ Último resultado encontrado ID:', resultado.id);
    return resultado;
  } catch (error) {
    console.error('❌ Error en obtenerUltimoResultadoVocacional:', error);
    return null;
  }
};

// Obtener estadísticas vocacionales
export const obtenerEstadisticasVocacionales = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📈 [VOCACIONAL] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    // Si no se especifica usuarioActualId, usar el mismo usuarioId
    if (!usuarioActualId) {
      usuarioActualId = usuarioId;
    }
    
    // Verificar permisos (si el perfil es privado)
    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        // Perfil privado: verificar si el usuario actual sigue al usuario
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          console.log('🚫 Sin permisos para ver estadísticas vocacionales de usuario privado');
          return {
            total_resultados: 0,
            promedio_general: "0.00",
            distribucion_zonas: [],
            fecha_ultimo_resultado: null,
            tiene_permiso: false
          };
        }
      }
    }
    
    // Obtener estadísticas generales
    const generalQuery = `
      SELECT 
        COUNT(*) as total_resultados,
        AVG(score_global) as promedio_general,
        MAX(test_date) as fecha_ultimo_resultado
      FROM user_vocational_results 
      WHERE user_id = $1
    `;
    
    const generalResult = await pool.query(generalQuery, [usuarioId]);
    const general = generalResult.rows[0] || {};
    
    // Obtener distribución por zonas Ikigai
    const zonasQuery = `
      SELECT 
        zona_ikigai,
        COUNT(*) as cantidad
      FROM user_vocational_results 
      WHERE user_id = $1
      GROUP BY zona_ikigai
      ORDER BY cantidad DESC
    `;
    
    const zonasResult = await pool.query(zonasQuery, [usuarioId]);
    
    const total = parseInt(general.total_resultados || 0);
    const distribucion_zonas = zonasResult.rows.map(item => ({
      zona_ikigai: item.zona_ikigai || 'No definida',
      cantidad: parseInt(item.cantidad || 0),
      porcentaje: total > 0 ? Math.round((parseInt(item.cantidad || 0) / total) * 100) : 0
    }));
    
    // Obtener perfiles promedio
    const perfilesQuery = `
      SELECT 
        AVG(perfil_tecnologico) as prom_tecnologico,
        AVG(perfil_cientifico) as prom_cientifico,
        AVG(perfil_salud) as prom_salud,
        AVG(perfil_administrativo) as prom_administrativo,
        AVG(perfil_social) as prom_social
      FROM user_vocational_results 
      WHERE user_id = $1
    `;
    
    const perfilesResult = await pool.query(perfilesQuery, [usuarioId]);
    const perfiles = perfilesResult.rows[0] || {};
    
    const estadisticas = {
      total_resultados: total,
      promedio_general: general.promedio_general ? parseFloat(general.promedio_general).toFixed(2) : "0.00",
      distribucion_zonas: distribucion_zonas,
      fecha_ultimo_resultado: general.fecha_ultimo_resultado,
      perfiles_promedio: {
        tecnologico: parseFloat(perfiles.prom_tecnologico || 0).toFixed(1),
        cientifico: parseFloat(perfiles.prom_cientifico || 0).toFixed(1),
        salud: parseFloat(perfiles.prom_salud || 0).toFixed(1),
        administrativo: parseFloat(perfiles.prom_administrativo || 0).toFixed(1),
        social: parseFloat(perfiles.prom_social || 0).toFixed(1)
      },
      tiene_permiso: true
    };
    
    console.log('📊 Estadísticas vocacionales obtenidas');
    return estadisticas;
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasVocacionales:', error);
    return {
      total_resultados: 0,
      promedio_general: "0.00",
      distribucion_zonas: [],
      fecha_ultimo_resultado: null,
      perfiles_promedio: {
        tecnologico: "0.0",
        cientifico: "0.0",
        salud: "0.0",
        administrativo: "0.0",
        social: "0.0"
      },
      tiene_permiso: false
    };
  }
};

// Obtener top carreras específico
export const obtenerTopCarreras = async (usuarioId, usuarioActualId = null, limite = 5) => {
  try {
    console.log('🏆 [VOCACIONAL] Obteniendo top carreras para usuario ID:', usuarioId);
    
    // Si no se especifica usuarioActualId, usar el mismo usuarioId
    if (!usuarioActualId) {
      usuarioActualId = usuarioId;
    }
    
    // Verificar permisos (si el perfil es privado)
    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          console.log('🚫 Sin permisos para ver top carreras de usuario privado');
          return [];
        }
      }
    }
    
    // Obtener el último resultado
    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId, usuarioActualId);
    
    if (!ultimoResultado || !ultimoResultado.resultados_completos || !Array.isArray(ultimoResultado.resultados_completos)) {
      console.log('ℹ️ No hay resultados completos para extraer top carreras');
      return [];
    }
    
    // Extraer y ordenar carreras por puntuación
    const carreras = ultimoResultado.resultados_completos
      .sort((a, b) => {
        const puntA = typeof a === 'object' ? (a.puntuacion || 0) : 0;
        const puntB = typeof b === 'object' ? (b.puntuacion || 0) : 0;
        return puntB - puntA;
      })
      .slice(0, limite)
      .map((carrera, index) => {
        if (typeof carrera === 'object') {
          return {
            posicion: index + 1,
            id: carrera.id || null,
            nombre: carrera.nombre || `Carrera ${index + 1}`,
            puntuacion: carrera.puntuacion || 0,
            scores: carrera.scores || {},
            zona_ikigai: carrera.zona_ikigai || null
          };
        }
        return {
          posicion: index + 1,
          id: null,
          nombre: carrera || `Carrera ${index + 1}`,
          puntuacion: 0,
          scores: {},
          zona_ikigai: null
        };
      });
    
    console.log(`✅ Top ${carreras.length} carreras obtenidas`);
    return carreras;
  } catch (error) {
    console.error('❌ Error en obtenerTopCarreras:', error);
    return [];
  }
};

// Función auxiliar para parsear JSON
function parsearJSON(valor, valorPorDefecto) {
  if (!valor) return valorPorDefecto;
  
  if (typeof valor === 'object') {
    return valor;
  }
  
  if (typeof valor === 'string') {
    try {
      return JSON.parse(valor);
    } catch (e) {
      console.error('Error parseando JSON:', e);
      return valorPorDefecto;
    }
  }
  
  return valorPorDefecto;
}

// Crear nuevo resultado vocacional
export const crearResultadoVocacional = async (usuarioId, datos) => {
  try {
    console.log('➕ [VOCACIONAL] Creando nuevo resultado para usuario ID:', usuarioId);
    
    const {
      resultados_completos,
      perfil_tecnologico,
      perfil_cientifico,
      perfil_salud,
      perfil_administrativo,
      perfil_social,
      top_carreras,
      score_global,
      zona_ikigai
    } = datos;
    
    const query = `
      INSERT INTO user_vocational_results (
        user_id,
        test_date,
        resultados_completos,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social,
        top_carreras,
        score_global,
        zona_ikigai,
        created_at,
        updated_at
      ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const values = [
      usuarioId,
      JSON.stringify(resultados_completos || []),
      parseFloat(perfil_tecnologico || 0),
      parseFloat(perfil_cientifico || 0),
      parseFloat(perfil_salud || 0),
      parseFloat(perfil_administrativo || 0),
      parseFloat(perfil_social || 0),
      JSON.stringify(top_carreras || []),
      parseFloat(score_global || 0),
      zona_ikigai || 'NO_DEFINIDA'
    ];
    
    const result = await pool.query(query, values);
    console.log('✅ Resultado vocacional creado ID:', result.rows[0].id);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error en crearResultadoVocacional:', error);
    throw error;
  }
};

// Eliminar resultado vocacional
export const eliminarResultadoVocacional = async (resultadoId, usuarioId) => {
  try {
    console.log('🗑️ [VOCACIONAL] Eliminando resultado ID:', resultadoId);
    
    // Verificar que el resultado pertenece al usuario
    const verificarQuery = `SELECT user_id FROM user_vocational_results WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);
    
    if (verificarResult.rows.length === 0) {
      throw new Error('Resultado no encontrado');
    }
    
    if (verificarResult.rows[0].user_id !== usuarioId) {
      throw new Error('No tienes permiso para eliminar este resultado');
    }
    
    const query = `DELETE FROM user_vocational_results WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [resultadoId]);
    
    console.log('✅ Resultado eliminado ID:', resultadoId);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error en eliminarResultadoVocacional:', error);
    throw error;
  }
};