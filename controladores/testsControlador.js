import { pool } from '../configuracion/basedeDatos.js';

/**
 * Verificar si un usuario puede ver resultados de otro (por privacidad)
 */
const verificarPermisoVerResultados = async (usuarioId, usuarioActualId) => {
  try {
    if (!usuarioActualId || usuarioActualId === usuarioId) {
      return true; // El usuario puede ver sus propios resultados
    }
    
    // Verificar si el perfil es privado
    const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
    const perfilResult = await pool.query(perfilQuery, [usuarioId]);
    
    if (perfilResult.rows.length === 0) {
      return false; // Usuario no existe
    }
    
    if (!perfilResult.rows[0].isPrivate) {
      return true; // Perfil público
    }
    
    // Perfil privado: verificar si el usuario actual sigue al usuario
    const sigueQuery = `
      SELECT 1 FROM "Follow"
      WHERE "followerId" = $1 AND "followingId" = $2
    `;
    const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
    
    return sigueResult.rows.length > 0;
    
  } catch (error) {
    console.error('❌ Error verificando permisos:', error);
    return false;
  }
};

// ==================== OBTENER RESULTADOS DE TESTS DE UN USUARIO ====================
export const obtenerResultadosTestsUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📊 [TESTS] Obteniendo resultados para usuario ID:', usuarioId);
    
    // Verificar permisos
    const tienePermiso = await verificarPermisoVerResultados(usuarioId, usuarioActualId);
    if (!tienePermiso) {
      console.log('🚫 Sin permisos para ver resultados de usuario:', usuarioId);
      return {
        exito: true,
        data: [],
        mensaje: 'Sin permisos para ver estos resultados'
      };
    }
    
    const query = `
      SELECT
        r.id,
        r."userId" as user_id,
        r."testId" as test_id,
        r.score as puntuacion,
        r."createdAt" as fecha_completado,
        t.title as nombre_test,
        t.description as descripcion_test
      FROM "KnowledgeTestResult" r
      LEFT JOIN "Test" t ON r."testId" = t.id
      WHERE r."userId" = $1
      ORDER BY r."createdAt" DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados de tests`);
    
    // Formatear para el frontend
    const resultadosFormateados = result.rows.map(item => ({
      id: item.id,
      user_id: item.user_id,
      test_id: item.test_id,
      score: item.puntuacion,
      completed_at: item.fecha_completado,
      nombre: item.nombre_test || obtenerNombreTest(item.test_id),
      area: item.descripcion_test || obtenerAreaTest(item.test_id)
    }));
    
    return {
      exito: true,
      data: resultadosFormateados,
      total: result.rows.length
    };
  } catch (error) {
    console.error('❌ Error en obtenerResultadosTestsUsuario:', error);
    return {
      exito: false,
      data: [],
      error: error.message,
      mensaje: 'Error al obtener resultados de tests'
    };
  }
};

// Función que usará el frontend (obtenerMisResultados)
export const obtenerMisResultados = async (usuarioActualId) => {
  return obtenerResultadosTestsUsuario(usuarioActualId, usuarioActualId);
};

// Función para obtener resultados de otro usuario
export const obtenerResultadosUsuario = async (usuarioId, usuarioActualId) => {
  return obtenerResultadosTestsUsuario(usuarioId, usuarioActualId);
};

// ==================== OBTENER ESTADÍSTICAS DE TESTS ====================
export const obtenerEstadisticasTests = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📈 [TESTS] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    // Verificar permisos
    const tienePermiso = await verificarPermisoVerResultados(usuarioId, usuarioActualId);
    if (!tienePermiso) {
      console.log('🚫 Sin permisos para ver estadísticas de usuario:', usuarioId);
      return {
        exito: true,
        data: {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        }
      };
    }
    
    const query = `
      SELECT
        r."testId",
        t.title as nombre_test,
        COUNT(*) as cantidad_por_test,
        AVG(r.score) as promedio_por_test,
        MAX(r."createdAt") as ultimo_test
      FROM "KnowledgeTestResult" r
      LEFT JOIN "Test" t ON r."testId" = t.id
      WHERE r."userId" = $1
      GROUP BY r."testId", t.title
      ORDER BY cantidad_por_test DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.cantidad_por_test || 0), 0);
    const promedio = result.rows.length > 0
      ? result.rows.reduce((sum, row) => sum + parseFloat(row.promedio_por_test || 0), 0) / result.rows.length
      : 0;
    
    const distribucion = result.rows.map(row => ({
      test_id: row.testId,
      nombre: row.nombre_test || obtenerNombreTest(row.testId),
      cantidad: parseInt(row.cantidad_por_test || 0),
      promedio: parseFloat(row.promedio_por_test || 0)
    }));
    
    return {
      exito: true,
      data: {
        total_tests: total,
        promedio_general: promedio.toFixed(1),
        ultimo_test_fecha: result.rows[0]?.ultimo_test || null,
        distribucion_tests: distribucion,
        tiene_permiso: true
      }
    };
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasTests:', error);
    return {
      exito: false,
      data: {
        total_tests: 0,
        promedio_general: 0,
        ultimo_test_fecha: null,
        distribucion_tests: [],
        tiene_permiso: false
      },
      error: error.message
    };
  }
};

// ==================== OBTENER TESTS DISPONIBLES ====================
export const obtenerTestsDisponibles = async () => {
  try {
    console.log('📝 [TESTS] Obteniendo tests disponibles');
    
    const query = `
      SELECT
        id,
        title as nombre,
        description as descripcion,
        "estimatedMinutes" as duracion,
        type as area,
        status
      FROM "Test"
      WHERE status = 'PUBLISHED'
      ORDER BY title
    `;
    
    const result = await pool.query(query);
    
    // Mapear a formato esperado por el frontend
    const tests = result.rows.map(test => ({
      id: test.id,
      nombre: test.nombre,
      descripcion: test.descripcion || '',
      duracion: test.duracion || 15,
      preguntas_total: 10, // Este campo no está en la tabla; se puede calcular o poner por defecto
      area: test.area || 'General',
      icono: obtenerIconoPorArea(test.area),
      activo: test.status === 'PUBLISHED'
    }));
    
    return {
      exito: true,
      data: tests,
      total: tests.length
    };
  } catch (error) {
    console.error('❌ Error en obtenerTestsDisponibles:', error);
    // Fallback: devolver una lista vacía
    return {
      exito: true,
      data: [],
      total: 0,
      mensaje: 'No se pudieron cargar los tests'
    };
  }
};

// ==================== OBTENER DETALLES DE UN TEST ESPECÍFICO ====================
export const obtenerDetallesTest = async (testId) => {
  try {
    console.log('🔍 [TESTS] Obteniendo detalles del test ID:', testId);
    
    const query = `
      SELECT
        id,
        title as nombre,
        description as descripcion,
        "estimatedMinutes" as duracion,
        type as area,
        status
      FROM "Test"
      WHERE id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [testId]);
    
    if (result.rows.length === 0) {
      return {
        exito: false,
        data: null,
        mensaje: 'Test no encontrado'
      };
    }
    
    const test = result.rows[0];
    
    return {
      exito: true,
      data: {
        id: test.id,
        nombre: test.nombre,
        descripcion: test.descripcion || '',
        duracion: test.duracion || 15,
        preguntas_total: 10, // Ajustar si hay información real
        area: test.area || 'General',
        icono: obtenerIconoPorArea(test.area),
        instrucciones: test.descripcion || 'Responde las siguientes preguntas.'
      }
    };
  } catch (error) {
    console.error('❌ Error en obtenerDetallesTest:', error);
    return {
      exito: false,
      data: null,
      error: error.message
    };
  }
};

// ==================== REGISTRAR NUEVO RESULTADO DE TEST ====================
export const registrarResultadoTest = async (usuarioId, testId, puntuacion, detalles = {}) => {
  try {
    console.log('📝 [TESTS] Registrando resultado para usuario ID:', usuarioId, 'test ID:', testId);
    
    // Extraer campos esperados por KnowledgeTestResult
    const { correctAnswers, totalQuestions } = detalles;
    
    const query = `
      INSERT INTO "KnowledgeTestResult" (
        id,
        "userId",
        "testId",
        score,
        "correctAnswers",
        "totalQuestions",
        "createdAt"
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3, $4, $5, NOW()
      )
      RETURNING *
    `;
    
    const values = [
      usuarioId,
      testId,
      parseFloat(puntuacion),
      correctAnswers || 0,
      totalQuestions || 0
    ];
    
    const result = await pool.query(query, values);
    console.log('✅ Resultado registrado ID:', result.rows[0].id);
    
    return {
      exito: true,
      data: result.rows[0],
      mensaje: 'Resultado registrado exitosamente'
    };
  } catch (error) {
    console.error('❌ Error en registrarResultadoTest:', error);
    return {
      exito: false,
      error: error.message,
      mensaje: 'Error al registrar el resultado'
    };
  }
};

// ==================== ACTUALIZAR RESULTADO EXISTENTE ====================
export const actualizarResultadoTest = async (resultadoId, usuarioId, datos) => {
  try {
    console.log('🔄 [TESTS] Actualizando resultado ID:', resultadoId);
    
    // Verificar que el resultado pertenece al usuario
    const verificarQuery = `SELECT "userId" FROM "KnowledgeTestResult" WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);
    
    if (verificarResult.rows.length === 0) {
      return {
        exito: false,
        mensaje: 'Resultado no encontrado'
      };
    }
    
    if (verificarResult.rows[0].userId !== usuarioId) {
      return {
        exito: false,
        mensaje: 'No tienes permiso para actualizar este resultado'
      };
    }
    
    const { score, correctAnswers, totalQuestions } = datos;
    
    const query = `
      UPDATE "KnowledgeTestResult"
      SET
        score = COALESCE($1, score),
        "correctAnswers" = COALESCE($2, "correctAnswers"),
        "totalQuestions" = COALESCE($3, "totalQuestions")
      WHERE id = $4
      RETURNING *
    `;
    
    const values = [
      score ? parseFloat(score) : null,
      correctAnswers ? parseInt(correctAnswers) : null,
      totalQuestions ? parseInt(totalQuestions) : null,
      resultadoId
    ];
    
    const result = await pool.query(query, values);
    
    return {
      exito: true,
      data: result.rows[0],
      mensaje: 'Resultado actualizado exitosamente'
    };
  } catch (error) {
    console.error('❌ Error en actualizarResultadoTest:', error);
    return {
      exito: false,
      error: error.message
    };
  }
};

// ==================== ELIMINAR RESULTADO DE TEST ====================
export const eliminarResultadoTest = async (resultadoId, usuarioId) => {
  try {
    console.log('🗑️ [TESTS] Eliminando resultado ID:', resultadoId);
    
    // Verificar que el resultado pertenece al usuario
    const verificarQuery = `SELECT "userId" FROM "KnowledgeTestResult" WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);
    
    if (verificarResult.rows.length === 0) {
      return {
        exito: false,
        mensaje: 'Resultado no encontrado'
      };
    }
    
    if (verificarResult.rows[0].userId !== usuarioId) {
      return {
        exito: false,
        mensaje: 'No tienes permiso para eliminar este resultado'
      };
    }
    
    const query = `DELETE FROM "KnowledgeTestResult" WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [resultadoId]);
    
    return {
      exito: true,
      data: result.rows[0],
      mensaje: 'Resultado eliminado exitosamente'
    };
  } catch (error) {
    console.error('❌ Error en eliminarResultadoTest:', error);
    return {
      exito: false,
      error: error.message
    };
  }
};

// ==================== OBTENER RANKING POR TEST ====================
export const obtenerRankingPorTest = async (testId, limite = 10) => {
  try {
    console.log('🏆 [TESTS] Obteniendo ranking para test ID:', testId);
    
    const query = `
      SELECT
        r."userId" as user_id,
        u.username,
        u."fullName" as full_name,
        r.score as puntuacion,
        r."createdAt" as fecha_completado,
        RANK() OVER (ORDER BY r.score DESC, r."createdAt" ASC) as posicion
      FROM "KnowledgeTestResult" r
      JOIN "User" u ON r."userId" = u.id
      WHERE r."testId" = $1
        AND u."isPrivate" = false  -- Solo usuarios públicos
      ORDER BY r.score DESC, r."createdAt" ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [testId, limite]);
    
    return {
      exito: true,
      data: result.rows,
      total: result.rows.length
    };
  } catch (error) {
    console.error('❌ Error en obtenerRankingPorTest:', error);
    return {
      exito: false,
      data: [],
      error: error.message
    };
  }
};

// ==================== FUNCIONES AUXILIARES ====================
function obtenerNombreTest(testId) {
  const nombres = {
    1: 'Matemáticas',
    2: 'Medico-Biológicas',
    3: 'Ingeniería y Tecnología',
    4: 'Sociales y Humanísticas',
    5: 'Artes y Diseño',
    6: 'Económicas y Administrativas'
  };
  return nombres[testId] || `Test ${testId}`;
}

function obtenerAreaTest(testId) {
  const areas = {
    1: 'Ciencias Físico-Matemáticas',
    2: 'Ciencias Biológicas y de la Salud',
    3: 'Ingenierías y Tecnologías',
    4: 'Ciencias Sociales y Humanidades',
    5: 'Artes y Diseño',
    6: 'Ciencias Económico-Administrativas'
  };
  return areas[testId] || 'General';
}

function obtenerIconoPorArea(area) {
  const iconos = {
    'MATHEMATICS': '🧮',
    'BIOLOGY': '🧬',
    'ENGINEERING': '⚙️',
    'SOCIAL_SCIENCES': '📚',
    'ARTS': '🎨',
    'ECONOMICS': '📈'
  };
  return iconos[area] || '📝';
}