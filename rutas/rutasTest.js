import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosTests, 
  obtenerDetallesTest,
  obtenerEstadisticasTests,
  obtenerTestsDisponibles
} from '../controladores/testsControlador.js';

const router = express.Router();

// ==================== TESTS DISPONIBLES ====================

// GET /api/tests/ - Obtener todos los tests disponibles (público)
router.get('/', autenticarUsuario, async (req, res) => {
  try {
    console.log('📝 GET /tests/ - Usuario:', req.usuario.email);
    
    const tests = await obtenerTestsDisponibles();
    
    res.json({ 
      exito: true, 
      data: tests,
      mensaje: 'Tests obtenidos exitosamente',
      total: tests.length
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener la lista de tests',
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
    
    const resultados = await obtenerResultadosTests(usuarioId, usuarioId);
    
    res.json({ 
      exito: true, 
      data: resultados,
      mensaje: 'Resultados obtenidos exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/mis-resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados',
      data: []
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
        error: 'ID del usuario es requerido'
      });
    }

    const resultados = await obtenerResultadosTests(usuarioId, usuarioActualId);
    
    res.json({ 
      exito: true, 
      data: resultados,
      mensaje: 'Resultados obtenidos exitosamente',
      total: resultados.length,
      tiene_permiso: resultados.length > 0 || usuarioActualId === usuarioId
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/resultados/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados',
      data: []
    });
  }
});

// ==================== ESTADÍSTICAS ====================

// GET /api/tests/estadisticas - Obtener estadísticas del usuario autenticado
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📈 GET /tests/estadisticas - Usuario ID:', usuarioId);
    
    const estadisticas = await obtenerEstadisticasTests(usuarioId, usuarioId);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/estadisticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas',
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
        error: 'ID del usuario es requerido'
      });
    }

    const estadisticas = await obtenerEstadisticasTests(usuarioId, usuarioActualId);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/estadisticas/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas',
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

// GET /api/tests/:testId - Obtener detalles de un test específico (público)
router.get('/detalle/:testId', autenticarUsuario, async (req, res) => {
  try {
    const { testId } = req.params;
    console.log('🔍 GET /tests/detalle/:testId - Test ID:', testId, 'Usuario:', req.usuario.email);
    
    if (!testId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del test es requerido'
      });
    }

    const detallesTest = await obtenerDetallesTest(testId);
    
    res.json({ 
      exito: true, 
      data: detallesTest,
      mensaje: 'Detalles del test obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/detalle/:testId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener detalles del test',
      data: null
    });
  }
});

// ==================== RUTAS PARA LA PANTALLA DE RESULTADOS ====================

// GET /api/tests/resumen/:usuarioId - Resumen completo para la pantalla de resultados
router.get('/resumen/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📋 GET /tests/resumen/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido'
      });
    }

    // Obtener todo en paralelo
    const [resultados, estadisticas] = await Promise.all([
      obtenerResultadosTests(usuarioId, usuarioActualId),
      obtenerEstadisticasTests(usuarioId, usuarioActualId)
    ]);
    
    // Verificar permisos
    const tienePermisoVerResultados = resultados.length > 0 || usuarioActualId === usuarioId;
    const tienePermisoVerEstadisticas = estadisticas.tiene_permiso !== false;
    
    res.json({ 
      exito: true, 
      data: {
        resultados: resultados,
        estadisticas: estadisticas,
        permisos: {
          ver_resultados: tienePermisoVerResultados,
          ver_estadisticas: tienePermisoVerEstadisticas,
          es_propietario: usuarioActualId === usuarioId
        }
      },
      mensaje: 'Resumen obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/resumen/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resumen de resultados',
      data: {
        resultados: [],
        estadisticas: {
          total_tests: 0,
          promedio_general: 0,
          ultimo_test_fecha: null,
          distribucion_tests: [],
          tiene_permiso: false
        },
        permisos: {
          ver_resultados: false,
          ver_estadisticas: false,
          es_propietario: false
        }
      }
    });
  }
});

// ==================== RUTA DE PRUEBA ====================

// GET /api/tests/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio de tests funcionando',
    usuario: {
      id: req.usuario.id,
      nombre_usuario: req.usuario.username
    },
    timestamp: new Date().toISOString()
  });
});

export default router;