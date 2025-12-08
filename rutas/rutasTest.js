import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerMisResultados,
  obtenerResultadosUsuario,
  obtenerEstadisticasTests,
  obtenerTestsDisponibles,
  obtenerDetallesTest,
  registrarResultadoTest,
  actualizarResultadoTest,
  eliminarResultadoTest,
  obtenerRankingPorTest
} from '../controladores/testsControlador.js';

const router = express.Router();

// ==================== TESTS DISPONIBLES ====================

// GET /api/tests/ - Obtener todos los tests disponibles
router.get('/', autenticarUsuario, async (req, res) => {
  try {
    console.log('📝 GET /tests/ - Usuario:', req.usuario.email);
    
    const resultado = await obtenerTestsDisponibles();
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Tests obtenidos exitosamente',
      total: resultado.total || resultado.data.length
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener la lista de tests',
      data: []
    });
  }
});

// ==================== RESULTADOS DE TESTS ====================

// GET /api/tests/mis-resultados - Obtener resultados del usuario autenticado
router.get('/mis-resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📊 GET /tests/mis-resultados - Usuario ID:', usuarioId);
    
    const resultado = await obtenerMisResultados(usuarioId);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Resultados obtenidos exitosamente',
      total: resultado.total || resultado.data.length,
      tiene_permiso: true
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/mis-resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener resultados',
      data: [],
      tiene_permiso: false
    });
  }
});

// GET /api/tests/resultados/:usuarioId - Obtener resultados de otro usuario
router.get('/resultados/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📊 GET /tests/resultados/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: [],
        tiene_permiso: false
      });
    }

    const resultado = await obtenerResultadosUsuario(usuarioId, usuarioActualId);
    
    if (!resultado.exito) {
      return res.status(resultado.data?.length === 0 ? 200 : 500).json(resultado);
    }
    
    const tienePermiso = resultado.data.length > 0 || usuarioActualId === usuarioId;
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Resultados obtenidos exitosamente',
      total: resultado.total || resultado.data.length,
      tiene_permiso: tienePermiso
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/resultados/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener resultados',
      data: [],
      tiene_permiso: false
    });
  }
});

// ==================== ESTADÍSTICAS ====================

// GET /api/tests/estadisticas - Obtener estadísticas del usuario autenticado
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📈 GET /tests/estadisticas - Usuario ID:', usuarioId);
    
    const resultado = await obtenerEstadisticasTests(usuarioId, usuarioId);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/estadisticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener estadísticas',
      data: {
        total_tests: 0,
        promedio_general: 0,
        ultimo_test_fecha: null,
        distribucion_tests: [],
        tiene_permiso: false
      }
    });
  }
});

// GET /api/tests/estadisticas/:usuarioId - Obtener estadísticas de otro usuario
router.get('/estadisticas/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📈 GET /tests/estadisticas/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        }
      });
    }

    const resultado = await obtenerEstadisticasTests(usuarioId, usuarioActualId);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/estadisticas/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener estadísticas',
      data: {
        total_tests: 0,
        promedio_general: 0,
        ultimo_test_fecha: null,
        distribucion_tests: [],
        tiene_permiso: false
      }
    });
  }
});

// ==================== DETALLES ESPECÍFICOS ====================

// GET /api/tests/:testId - Obtener detalles de un test específico
router.get('/detalle/:testId', autenticarUsuario, async (req, res) => {
  try {
    const { testId } = req.params;
    console.log('🔍 GET /tests/detalle/:testId - Test ID:', testId, 'Usuario:', req.usuario.email);
    
    if (!testId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del test es requerido',
        data: null
      });
    }

    const resultado = await obtenerDetallesTest(testId);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({ 
      exito: true, 
      data: resultado.data,
      mensaje: resultado.mensaje || 'Detalles del test obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/detalle/:testId:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener detalles del test',
      data: null
    });
  }
});

// ==================== CRUD RESULTADOS TESTS ====================

// POST /api/tests/registrar - Registrar nuevo resultado de test
router.post('/registrar', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { testId, puntuacion, detalles } = req.body;
    
    console.log('📝 POST /tests/registrar - Usuario ID:', usuarioId, 'Test ID:', testId, 'Puntuación:', puntuacion);
    
    if (!testId || puntuacion === undefined) {
      return res.status(400).json({
        exito: false,
        error: 'Los campos testId y puntuacion son requeridos',
        data: null
      });
    }
    
    const resultado = await registrarResultadoTest(usuarioId, testId, puntuacion, detalles);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.status(201).json({
      exito: true,
      data: resultado.data,
      mensaje: resultado.mensaje || 'Resultado registrado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en POST /tests/registrar:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al registrar resultado',
      data: null
    });
  }
});

// PUT /api/tests/:resultadoId - Actualizar resultado existente
router.put('/:resultadoId', autenticarUsuario, async (req, res) => {
  try {
    const { resultadoId } = req.params;
    const usuarioId = req.usuario.id;
    const datos = req.body;
    
    console.log('🔄 PUT /tests/:resultadoId - Resultado ID:', resultadoId, 'Usuario ID:', usuarioId);
    
    if (!resultadoId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del resultado es requerido'
      });
    }
    
    const resultado = await actualizarResultadoTest(resultadoId, usuarioId, datos);
    
    if (!resultado.exito) {
      const statusCode = resultado.mensaje?.includes('No tienes permiso') ? 403 : 
                        resultado.mensaje?.includes('no encontrado') ? 404 : 500;
      return res.status(statusCode).json(resultado);
    }
    
    res.json({
      exito: true,
      data: resultado.data,
      mensaje: resultado.mensaje || 'Resultado actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en PUT /tests/:resultadoId:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al actualizar resultado'
    });
  }
});

// DELETE /api/tests/:resultadoId - Eliminar resultado de test
router.delete('/:resultadoId', autenticarUsuario, async (req, res) => {
  try {
    const { resultadoId } = req.params;
    const usuarioId = req.usuario.id;
    
    console.log('🗑️ DELETE /tests/:resultadoId - Resultado ID:', resultadoId, 'Usuario ID:', usuarioId);
    
    if (!resultadoId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del resultado es requerido'
      });
    }
    
    const resultado = await eliminarResultadoTest(resultadoId, usuarioId);
    
    if (!resultado.exito) {
      const statusCode = resultado.mensaje?.includes('No tienes permiso') ? 403 : 
                        resultado.mensaje?.includes('no encontrado') ? 404 : 500;
      return res.status(statusCode).json(resultado);
    }
    
    res.json({
      exito: true,
      data: resultado.data,
      mensaje: resultado.mensaje || 'Resultado eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en DELETE /tests/:resultadoId:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al eliminar resultado'
    });
  }
});

// ==================== RANKINGS ====================

// GET /api/tests/:testId/ranking - Obtener ranking por test
router.get('/:testId/ranking', autenticarUsuario, async (req, res) => {
  try {
    const { testId } = req.params;
    const limite = req.query.limite ? parseInt(req.query.limite) : 10;
    
    console.log('🏆 GET /tests/:testId/ranking - Test ID:', testId, 'Límite:', limite);
    
    if (!testId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del test es requerido',
        data: []
      });
    }
    
    const resultado = await obtenerRankingPorTest(testId, limite);
    
    if (!resultado.exito) {
      return res.status(500).json(resultado);
    }
    
    res.json({
      exito: true,
      data: resultado.data,
      mensaje: resultado.mensaje || 'Ranking obtenido exitosamente',
      total: resultado.total
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/:testId/ranking:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al obtener ranking',
      data: []
    });
  }
});

// ==================== RESÚMENES COMPLETOS ====================

// GET /api/tests/resumen - Resumen completo para el usuario actual
router.get('/resumen', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    
    console.log('📋 GET /tests/resumen - Usuario ID:', usuarioId);
    
    // Obtener todo en paralelo para mejor rendimiento
    const [resultados, estadisticas, tests] = await Promise.all([
      obtenerMisResultados(usuarioId),
      obtenerEstadisticasTests(usuarioId, usuarioId),
      obtenerTestsDisponibles()
    ]);
    
    const resumen = {
      exito: true,
      data: {
        resultados: resultados.exito ? resultados.data : [],
        estadisticas: estadisticas.exito ? estadisticas.data : {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        },
        tests_disponibles: tests.exito ? tests.data : [],
        usuario: {
          id: usuarioId,
          es_propietario: true
        },
        timestamp: new Date().toISOString()
      },
      mensaje: 'Resumen de tests obtenido exitosamente'
    };
    
    res.json(resumen);
  } catch (error) {
    console.error('❌ Error en GET /tests/resumen:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al obtener resumen de tests',
      data: {
        resultados: [],
        estadisticas: {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        },
        tests_disponibles: [],
        usuario: {
          id: req.usuario?.id || null,
          es_propietario: true
        }
      }
    });
  }
});

// GET /api/tests/resumen/:usuarioId - Resumen completo para otro usuario
router.get('/resumen/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📋 GET /tests/resumen/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: {
          resultados: [],
          estadisticas: {
            total_tests: 0,
            promedio_general: 0,
            ultimo_test_fecha: null,
            distribucion_tests: [],
            tiene_permiso: false
          },
          tests_disponibles: [],
          usuario: {
            id: usuarioId,
            es_propietario: false
          }
        }
      });
    }

    // Obtener todo en paralelo
    const [resultados, estadisticas] = await Promise.all([
      obtenerResultadosUsuario(usuarioId, usuarioActualId),
      obtenerEstadisticasTests(usuarioId, usuarioActualId)
    ]);
    
    const esPropietario = usuarioActualId === usuarioId;
    const tienePermisoVerResultados = (resultados.exito && resultados.data.length > 0) || esPropietario;
    const tienePermisoVerEstadisticas = (estadisticas.exito && estadisticas.data.tiene_permiso !== false) || esPropietario;
    
    const resumen = {
      exito: true,
      data: {
        resultados: tienePermisoVerResultados ? (resultados.exito ? resultados.data : []) : [],
        estadisticas: tienePermisoVerEstadisticas ? (estadisticas.exito ? estadisticas.data : {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        }) : {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        },
        usuario: {
          id: usuarioId,
          es_propietario: esPropietario
        },
        permisos: {
          ver_resultados: tienePermisoVerResultados,
          ver_estadisticas: tienePermisoVerEstadisticas
        },
        timestamp: new Date().toISOString()
      },
      mensaje: 'Resumen de tests obtenido exitosamente'
    };
    
    res.json(resumen);
  } catch (error) {
    console.error('❌ Error en GET /tests/resumen/:usuarioId:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al obtener resumen de tests',
      data: {
        resultados: [],
        estadisticas: {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        },
        usuario: {
          id: req.params?.usuarioId || null,
          es_propietario: false
        }
      }
    });
  }
});

// ==================== RUTAS DE UTILIDAD ====================

// GET /api/tests/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio de tests funcionando',
    usuario: {
      id: req.usuario.id,
      nombre_usuario: req.usuario.username,
      email: req.usuario.email
    },
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// GET /api/tests/health - Health check
router.get('/health', (req, res) => {
  res.json({
    exito: true,
    servicio: 'tests',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;