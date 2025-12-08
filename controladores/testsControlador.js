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
    const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
    const perfilResult = await pool.query(perfilQuery, [usuarioId]);
    
    if (perfilResult.rows.length === 0) {
      return false; // Usuario no existe
    }
    
    if (!perfilResult.rows[0].is_private) {
      return true; // Perfil público
    }
    
    // Perfil privado: verificar si el usuario actual sigue al usuario
    const sigueQuery = `
      SELECT 1 FROM user_follows 
      WHERE follower_id = $1 AND following_id = $2
    `;
    const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
    
    return sigueResult.rows.length > 0;
    
  } catch (error) {
    console.error('❌ Error verificando permisos:', error);
    return false;
  }
};

// Obtener resultados de tests de conocimiento de un usuario (para el frontend)
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
        id,
        user_id,
        test_id, 
        score as puntuacion,
        completed_at as fecha_completado
      FROM _user_test_results 
      WHERE user_id = $1 
      ORDER BY completed_at DESC
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
      nombre: obtenerNombreTest(item.test_id),
      area: obtenerAreaTest(item.test_id)
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

// Obtener estadísticas de tests con manejo de privacidad
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
    
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.cantidad_por_test || 0), 0);
    const promedio = result.rows[0] ? parseFloat(result.rows[0].promedio_general || 0) : 0;
    
    const distribucion = result.rows.map(row => ({
      test_id: row.test_id,
      nombre: obtenerNombreTest(row.test_id),
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

// Obtener todos los tests disponibles (público - no requiere permiso)
export const obtenerTestsDisponibles = async () => {
  try {
    console.log('📝 [TESTS] Obteniendo tests disponibles');
    
    // Intentar obtener de una tabla de tests si existe
    let tests = [];
    
    try {
      const consulta = `
        SELECT 
          id, 
          nombre, 
          descripcion, 
          duracion_minutos as duracion,
          total_preguntas as preguntas_total,
          area,
          icono,
          activo
        FROM tests_conocimiento 
        WHERE activo = true
        ORDER BY orden, nombre
      `;
      
      const resultado = await pool.query(consulta);
      tests = resultado.rows;
    } catch (e) {
      console.log('ℹ️ Tabla tests_conocimiento no existe, usando datos por defecto');
    }
    
    // Si no hay tests en BD, usar datos por defecto del frontend
    if (tests.length === 0) {
      tests = [
        {
          id: 1,
          nombre: 'Matemáticas',
          descripcion: 'Pon a prueba tus conocimientos matemáticos resolviendo problemas prácticos.',
          duracion: 20,
          preguntas_total: 10,
          area: 'Ciencias Físico-Matemáticas',
          icono: '🧮',
          activo: true
        },
        {
          id: 2,
          nombre: 'Medico-Biológicas',
          descripcion: 'Evalúa tus conocimientos de biología y ciencias médicas con ejercicios prácticos.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Biológicas y de la Salud',
          icono: '🧬',
          activo: true
        },
        {
          id: 3,
          nombre: 'Ingeniería y Tecnología',
          descripcion: 'Comprueba tu comprensión en conceptos de ingeniería y tecnología aplicados.',
          duracion: 25,
          preguntas_total: 12,
          area: 'Ingenierías y Tecnologías',
          icono: '⚙️',
          activo: true
        },
        {
          id: 4,
          nombre: 'Sociales y Humanísticas',
          descripcion: 'Pon a prueba tus conocimientos en historia, geografía y ciencias sociales.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Sociales y Humanidades',
          icono: '📚',
          activo: true
        },
        {
          id: 5,
          nombre: 'Artes y Diseño',
          descripcion: 'Evalúa tus conocimientos en artes y diseño mediante preguntas creativas.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Artes y Diseño',
          icono: '🎨',
          activo: true
        },
        {
          id: 6,
          nombre: 'Económicas y Administrativas',
          descripcion: 'Mide tu comprensión en economía, administración y finanzas básicas.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Económico-Administrativas',
          icono: '📈',
          activo: true
        }
      ];
    }
    
    return {
      exito: true,
      data: tests,
      total: tests.length
    };
  } catch (error) {
    console.error('❌ Error en obtenerTestsDisponibles:', error);
    return {
      exito: false,
      data: [],
      error: error.message
    };
  }
};

// Obtener detalles de un test específico
export const obtenerDetallesTest = async (testId) => {
  try {
    console.log('🔍 [TESTS] Obteniendo detalles del test ID:', testId);
    
    let test = null;
    
    try {
      const query = `
        SELECT 
          id, 
          nombre, 
          descripcion, 
          duracion_minutos as duracion,
          total_preguntas as preguntas_total,
          area,
          icono,
          instrucciones,
          activo
        FROM tests_conocimiento 
        WHERE id = $1 AND activo = true
        LIMIT 1
      `;
      
      const result = await pool.query(query, [testId]);
      
      if (result.rows.length > 0) {
        test = result.rows[0];
      }
    } catch (e) {
      console.log('ℹ️ Tabla tests_conocimiento no existe, usando datos por defecto');
    }
    
    // Si no existe en BD, usar datos por defecto
    if (!test) {
      const testsPorDefecto = {
        1: {
          id: 1,
          nombre: 'Matemáticas',
          descripcion: 'Pon a prueba tus conocimientos matemáticos resolviendo problemas prácticos.',
          duracion: 20,
          preguntas_total: 10,
          area: 'Ciencias Físico-Matemáticas',
          icono: '🧮',
          instrucciones: 'Resuelve los problemas matemáticos seleccionando la respuesta correcta.'
        },
        2: {
          id: 2,
          nombre: 'Medico-Biológicas',
          descripcion: 'Evalúa tus conocimientos de biología y ciencias médicas con ejercicios prácticos.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Biológicas y de la Salud',
          icono: '🧬',
          instrucciones: 'Selecciona la respuesta correcta para cada pregunta sobre biología y ciencias médicas.'
        },
        3: {
          id: 3,
          nombre: 'Ingeniería y Tecnología',
          descripcion: 'Comprueba tu comprensión en conceptos de ingeniería y tecnología aplicados.',
          duracion: 25,
          preguntas_total: 12,
          area: 'Ingenierías y Tecnologías',
          icono: '⚙️',
          instrucciones: 'Responde las preguntas sobre conceptos básicos de ingeniería y tecnología.'
        },
        4: {
          id: 4,
          nombre: 'Sociales y Humanísticas',
          descripcion: 'Pon a prueba tus conocimientos en historia, geografía y ciencias sociales.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Sociales y Humanidades',
          icono: '📚',
          instrucciones: 'Demuestra tus conocimientos en ciencias sociales y humanidades.'
        },
        5: {
          id: 5,
          nombre: 'Artes y Diseño',
          descripcion: 'Evalúa tus conocimientos en artes y diseño mediante preguntas creativas.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Artes y Diseño',
          icono: '🎨',
          instrucciones: 'Responde preguntas sobre arte, diseño y creatividad.'
        },
        6: {
          id: 6,
          nombre: 'Económicas y Administrativas',
          descripcion: 'Mide tu comprensión en economía, administración y finanzas básicas.',
          duracion: 10,
          preguntas_total: 8,
          area: 'Ciencias Económico-Administrativas',
          icono: '📈',
          instrucciones: 'Responde preguntas sobre economía, administración y finanzas.'
        }
      };
      
      test = testsPorDefecto[testId] || {
        id: testId,
        nombre: `Test #${testId}`,
        descripcion: 'Test de conocimiento',
        duracion: 15,
        preguntas_total: 10,
        area: 'General',
        icono: '📝',
        instrucciones: 'Responde las siguientes preguntas seleccionando la opción correcta.'
      };
    }
    
    return {
      exito: true,
      data: test
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

// Registrar nuevo resultado de test
export const registrarResultadoTest = async (usuarioId, testId, puntuacion, detalles = {}) => {
  try {
    console.log('📝 [TESTS] Registrando resultado para usuario ID:', usuarioId, 'test ID:', testId);
    
    const query = `
      INSERT INTO _user_test_results (
        user_id,
        test_id,
        score,
        completed_at,
        detalles
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
      RETURNING *
    `;
    
    const values = [
      usuarioId,
      testId,
      parseFloat(puntuacion),
      JSON.stringify(detalles)
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

// Actualizar resultado existente
export const actualizarResultadoTest = async (resultadoId, usuarioId, datos) => {
  try {
    console.log('🔄 [TESTS] Actualizando resultado ID:', resultadoId);
    
    // Verificar que el resultado pertenece al usuario
    const verificarQuery = `SELECT user_id FROM _user_test_results WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);
    
    if (verificarResult.rows.length === 0) {
      return {
        exito: false,
        mensaje: 'Resultado no encontrado'
      };
    }
    
    if (verificarResult.rows[0].user_id !== usuarioId) {
      return {
        exito: false,
        mensaje: 'No tienes permiso para actualizar este resultado'
      };
    }
    
    const { score, detalles } = datos;
    
    const query = `
      UPDATE _user_test_results 
      SET 
        score = COALESCE($1, score),
        detalles = COALESCE($2, detalles),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    const values = [
      score ? parseFloat(score) : null,
      detalles ? JSON.stringify(detalles) : null,
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

// Eliminar resultado de test
export const eliminarResultadoTest = async (resultadoId, usuarioId) => {
  try {
    console.log('🗑️ [TESTS] Eliminando resultado ID:', resultadoId);
    
    // Verificar que el resultado pertenece al usuario
    const verificarQuery = `SELECT user_id FROM _user_test_results WHERE id = $1`;
    const verificarResult = await pool.query(verificarQuery, [resultadoId]);
    
    if (verificarResult.rows.length === 0) {
      return {
        exito: false,
        mensaje: 'Resultado no encontrado'
      };
    }
    
    if (verificarResult.rows[0].user_id !== usuarioId) {
      return {
        exito: false,
        mensaje: 'No tienes permiso para eliminar este resultado'
      };
    }
    
    const query = `DELETE FROM _user_test_results WHERE id = $1 RETURNING id`;
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

// Obtener el ranking de usuarios por test
export const obtenerRankingPorTest = async (testId, limite = 10) => {
  try {
    console.log('🏆 [TESTS] Obteniendo ranking para test ID:', testId);
    
    const query = `
      SELECT 
        utr.user_id,
        u.username,
        u.full_name,
        utr.score as puntuacion,
        utr.completed_at as fecha_completado,
        RANK() OVER (ORDER BY utr.score DESC, utr.completed_at ASC) as posicion
      FROM _user_test_results utr
      JOIN _users u ON utr.user_id = u.id
      WHERE utr.test_id = $1 
        AND u.is_private = false  -- Solo usuarios públicos
      ORDER BY utr.score DESC, utr.completed_at ASC
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

// Función auxiliar para obtener nombre del test por ID
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

// Función auxiliar para obtener área del test por ID
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