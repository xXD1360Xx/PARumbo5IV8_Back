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

// GET /api/tests/ - Obtener todos los tests disponibles
router.get('/', autenticarUsuario, async (req, res) => {
  try {
    console.log('📝 GET /tests/ - Usuario:', req.usuario.email);
    
    const tests = await obtenerTestsDisponibles();
    
    res.json({ 
      exito: true, 
      datos: tests,
      mensaje: 'Tests obtenidos exitosamente',
      total: tests.length
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener la lista de tests',
      datos: []
    });
  }
});

// ==================== RESULTADOS DE TESTS ====================

// GET /api/tests/mis-resultados - Obtener resultados del usuario autenticado
router.get('/mis-resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📊 GET /tests/mis-resultados - Usuario ID:', usuarioId);
    
    const resultados = await obtenerResultadosTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Resultados obtenidos exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/mis-resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados',
      datos: []
    });
  }
});

// ==================== ESTADÍSTICAS ====================

// GET /api/tests/estadisticas/generales - Obtener estadísticas de tests
router.get('/estadisticas/generales', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📈 GET /tests/estadisticas/generales - Usuario ID:', usuarioId);
    
    const estadisticas = await obtenerEstadisticasTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/estadisticas/generales:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas',
      datos: {
        total_tests: 0,
        promedio_general: 0,
        distribucion_tests: []
      }
    });
  }
});

// ==================== DETALLES ESPECÍFICOS ====================

// GET /api/tests/:testId - Obtener detalles de un test específico
router.get('/:testId', autenticarUsuario, async (req, res) => {
  try {
    const { testId } = req.params;
    console.log('🔍 GET /tests/:testId - Test ID:', testId, 'Usuario:', req.usuario.email);
    
    if (!testId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del test es requerido'
      });
    }

    const detallesTest = await obtenerDetallesTest(testId);
    
    res.json({ 
      exito: true, 
      datos: detallesTest,
      mensaje: 'Detalles del test obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /tests/:testId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener detalles del test',
      datos: null
    });
  }
});

export default router;