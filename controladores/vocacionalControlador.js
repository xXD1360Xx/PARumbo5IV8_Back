import { pool } from '../configuracion/basedeDatos.js';

// Función auxiliar para parsear JSON (por si acaso)
function parsearJSON(valor, valorPorDefecto) {
  if (!valor) return valorPorDefecto;
  if (typeof valor === 'object') return valor;
  if (typeof valor === 'string') {
    try {
      return JSON.parse(valor);
    } catch {
      return valorPorDefecto;
    }
  }
  return valorPorDefecto;
}

// ==================== OBTENER TODOS LOS RESULTADOS VOCACIONALES ====================
export const obtenerResultadosVocacionales = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo resultados para usuario ID:', usuarioId);

    if (!usuarioActualId) usuarioActualId = usuarioId;

    // Verificar permisos (si el perfil es privado)
    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);

      if (perfilResult.rows.length > 0 && perfilResult.rows[0].isPrivate) {
        const sigueQuery = `
          SELECT 1 FROM "Follow"
          WHERE "followerId" = $1 AND "followingId" = $2
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
        "userId",
        "perfilTecnologico",
        "perfilCientifico",
        "perfilSalud",
        "perfilAdministrativo",
        "perfilSocial",
        "topCarreras",
        "resultadosCompletos",
        "scoreGlobal",
        "zonaIkigai",
        "createdAt",
        "updatedAt"
      FROM "VocalTestResult"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
    `;

    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados vocacionales`);

    // Mapear a formato amigable (igual que antes)
    const resultados = result.rows.map(item => ({
      id: item.id,
      user_id: item.userId,
      test_date: item.createdAt,
      resultados_completos: item.resultadosCompletos || [],
      top_carreras: item.topCarreras || [],
      score_global: parseFloat(item.scoreGlobal || 0),
      zona_ikigai: item.zonaIkigai,
      perfil_tecnologico: parseFloat(item.perfilTecnologico || 0),
      perfil_cientifico: parseFloat(item.perfilCientifico || 0),
      perfil_salud: parseFloat(item.perfilSalud || 0),
      perfil_administrativo: parseFloat(item.perfilAdministrativo || 0),
      perfil_social: parseFloat(item.perfilSocial || 0),
      created_at: item.createdAt,
      updated_at: item.updatedAt
    }));

    return resultados;
  } catch (error) {
    console.error('❌ Error en obtenerResultadosVocacionales:', error);
    return [];
  }
};

// ==================== OBTENER EL ÚLTIMO RESULTADO VOCACIONAL ====================
export const obtenerUltimoResultadoVocacional = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo último resultado para usuario ID:', usuarioId);

    if (!usuarioActualId) usuarioActualId = usuarioId;

    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);

      if (perfilResult.rows.length > 0 && perfilResult.rows[0].isPrivate) {
        const sigueQuery = `
          SELECT 1 FROM "Follow"
          WHERE "followerId" = $1 AND "followingId" = $2
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
        "userId",
        "perfilTecnologico",
        "perfilCientifico",
        "perfilSalud",
        "perfilAdministrativo",
        "perfilSocial",
        "topCarreras",
        "resultadosCompletos",
        "scoreGlobal",
        "zonaIkigai",
        "createdAt",
        "updatedAt"
      FROM "VocalTestResult"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
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
      user_id: item.userId,
      test_date: item.createdAt,
      resultados_completos: item.resultadosCompletos || [],
      top_carreras: item.topCarreras || [],
      score_global: parseFloat(item.scoreGlobal || 0),
      zona_ikigai: item.zonaIkigai,
      perfil_tecnologico: parseFloat(item.perfilTecnologico || 0),
      perfil_cientifico: parseFloat(item.perfilCientifico || 0),
      perfil_salud: parseFloat(item.perfilSalud || 0),
      perfil_administrativo: parseFloat(item.perfilAdministrativo || 0),
      perfil_social: parseFloat(item.perfilSocial || 0),
      created_at: item.createdAt,
      updated_at: item.updatedAt
    };

    console.log('✅ Último resultado encontrado ID:', resultado.id);
    return resultado;
  } catch (error) {
    console.error('❌ Error en obtenerUltimoResultadoVocacional:', error);
    return null;
  }
};

// ==================== OBTENER ESTADÍSTICAS VOCACIONALES ====================
export const obtenerEstadisticasVocacionales = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📈 [VOCACIONAL] Obteniendo estadísticas para usuario ID:', usuarioId);

    if (!usuarioActualId) usuarioActualId = usuarioId;

    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);

      if (perfilResult.rows.length > 0 && perfilResult.rows[0].isPrivate) {
        const sigueQuery = `
          SELECT 1 FROM "Follow"
          WHERE "followerId" = $1 AND "followingId" = $2
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

    // Estadísticas generales
    const generalQuery = `
      SELECT
        COUNT(*) as total_resultados,
        AVG("scoreGlobal") as promedio_general,
        MAX("createdAt") as fecha_ultimo_resultado
      FROM "VocalTestResult"
      WHERE "userId" = $1
    `;
    const generalResult = await pool.query(generalQuery, [usuarioId]);
    const general = generalResult.rows[0] || {};

    // Distribución por zonas Ikigai
    const zonasQuery = `
      SELECT
        "zonaIkigai",
        COUNT(*) as cantidad
      FROM "VocalTestResult"
      WHERE "userId" = $1
      GROUP BY "zonaIkigai"
      ORDER BY cantidad DESC
    `;
    const zonasResult = await pool.query(zonasQuery, [usuarioId]);

    const total = parseInt(general.total_resultados || 0);
    const distribucion_zonas = zonasResult.rows.map(item => ({
      zona_ikigai: item.zonaIkigai || 'No definida',
      cantidad: parseInt(item.cantidad || 0),
      porcentaje: total > 0 ? Math.round((parseInt(item.cantidad || 0) / total) * 100) : 0
    }));

    // Perfiles promedio
    const perfilesQuery = `
      SELECT
        AVG("perfilTecnologico") as prom_tecnologico,
        AVG("perfilCientifico") as prom_cientifico,
        AVG("perfilSalud") as prom_salud,
        AVG("perfilAdministrativo") as prom_administrativo,
        AVG("perfilSocial") as prom_social
      FROM "VocalTestResult"
      WHERE "userId" = $1
    `;
    const perfilesResult = await pool.query(perfilesQuery, [usuarioId]);
    const perfiles = perfilesResult.rows[0] || {};

    const estadisticas = {
      total_resultados: total,
      promedio_general: general.promedio_general ? parseFloat(general.promedio_general).toFixed(2) : "0.00",
      distribucion_zonas,
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

// ==================== OBTENER TOP CARRERAS (del último resultado) ====================
export const obtenerTopCarreras = async (usuarioId, usuarioActualId = null, limite = 5) => {
  try {
    console.log('🏆 [VOCACIONAL] Obteniendo top carreras para usuario ID:', usuarioId);

    if (!usuarioActualId) usuarioActualId = usuarioId;

    if (usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);

      if (perfilResult.rows.length > 0 && perfilResult.rows[0].isPrivate) {
        const sigueQuery = `
          SELECT 1 FROM "Follow"
          WHERE "followerId" = $1 AND "followingId" = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);

        if (sigueResult.rows.length === 0) {
          console.log('🚫 Sin permisos para ver top carreras de usuario privado');
          return [];
        }
      }
    }

    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId, usuarioActualId);
    if (!ultimoResultado || !Array.isArray(ultimoResultado.resultados_completos)) {
      console.log('ℹ️ No hay resultados completos para extraer top carreras');
      return [];
    }

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

// ==================== CREAR NUEVO RESULTADO VOCACIONAL ====================
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
      zona_ikigai,
      testId // ← IMPORTANTE: debe venir del frontend o tener un valor por defecto
    } = datos;

    if (!testId) {
      throw new Error('testId es requerido para crear un resultado vocacional');
    }

    const query = `
      INSERT INTO "VocalTestResult" (
        id,
        "userId",
        "testId",
        "perfilTecnologico",
        "perfilCientifico",
        "perfilSalud",
        "perfilAdministrativo",
        "perfilSocial",
        "topCarreras",
        "resultadosCompletos",
        "scoreGlobal",
        "zonaIkigai",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, NOW(), NOW()
      )
      RETURNING *
    `;

    const values = [
      usuarioId,
      testId,
      parseFloat(perfil_tecnologico || 0),
      parseFloat(perfil_cientifico || 0),
      parseFloat(perfil_salud || 0),
      parseFloat(perfil_administrativo || 0),
      parseFloat(perfil_social || 0),
      JSON.stringify(top_carreras || []),
      JSON.stringify(resultados_completos || []),
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

// ==================== ELIMINAR RESULTADO VOCACIONAL ====================
export const eliminarResultadoVocacional = async (resultadoId, usuarioId) => {
  try {
    console.log('🗑️ [VOCACIONAL] Eliminando resultado ID:', resultadoId);

    const verificarQuery = `SELECT "userId" FROM "VocalTestResult" WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);

    if (verificarResult.rows.length === 0) {
      throw new Error('Resultado no encontrado');
    }

    if (verificarResult.rows[0].userId !== usuarioId) {
      throw new Error('No tienes permiso para eliminar este resultado');
    }

    const deleteQuery = `DELETE FROM "VocalTestResult" WHERE id = $1 RETURNING id`;
    const result = await pool.query(deleteQuery, [resultadoId]);

    console.log('✅ Resultado eliminado ID:', resultadoId);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error en eliminarResultadoVocacional:', error);
    throw error;
  }
};