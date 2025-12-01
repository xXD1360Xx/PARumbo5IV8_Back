import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosTests, 
  obtenerDetallesTest,
  obtenerEstadisticasTests,
  obtenerTestsDisponibles,     // ✅ Nueva función importada
  insertarResultadoTest,       // ✅ Si la necesitas
  eliminarResultadoTest        // ✅ Si la necesitas
} from '../controladores/testsControlador.js';
// ⚠️ ELIMINADO: import { pool } from '../configuracion/basedeDatos.js'; 

const router = express.Router();

// GET /api/tests/historial/:usuarioId - Para el frontend
router.get('/historial/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Validación del ID
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }
    
    const resultados = await obtenerResultadosTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Historial de tests obtenido exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('Error al obtener resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el historial de tests' 
    });
  }
});

// GET /tests/mis-resultados - Obtener todos los resultados del usuario
router.get('/mis-resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const resultados = await obtenerResultadosTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Resultados obtenidos exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('Error al obtener resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener los resultados de tests' 
    });
  }
});

// GET /tests/:testId - Obtener detalles específicos de un test
router.get('/:testId', autenticarUsuario, async (req, res) => {
  try {
    const { testId } = req.params;
    
    if (!testId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del test es requerido'
      });
    }

    const detallesTest = await obtenerDetallesTest(testId);
    
    if (!detallesTest) {
      return res.status(404).json({
        exito: false,
        error: 'Test no encontrado'
      });
    }

    res.json({ 
      exito: true, 
      datos: detallesTest,
      mensaje: 'Detalles del test obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener detalles del test:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener detalles del test' 
    });
  }
});

// GET /tests/estadisticas/generales - Obtener estadísticas del usuario
router.get('/estadisticas/generales', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const estadisticas = await obtenerEstadisticasTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas' 
    });
  }
});

// GET /tests/ - Obtener todos los tests disponibles (CORREGIDO)
router.get('/', autenticarUsuario, async (req, res) => {
  try {
    const tests = await obtenerTestsDisponibles();  // ✅ Usa función del controlador
    
    res.json({ 
      exito: true, 
      datos: tests,
      mensaje: 'Tests obtenidos exitosamente',
      total: tests.length
    });
  } catch (error) {
    console.error('Error al obtener tests:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener la lista de tests' 
    });
  }
});

// POST /tests/guardar - Guardar nuevo resultado de test
router.post('/guardar', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { testId, puntuacion, areas } = req.body;
    
    if (!testId || puntuacion === undefined) {
      return res.status(400).json({
        exito: false,
        error: 'Datos incompletos para guardar el test'
      });
    }
    
    const resultado = await insertarResultadoTest(usuarioId, testId, puntuacion, areas);
    
    res.json({ 
      exito: true, 
      datos: resultado,
      mensaje: 'Resultado de test guardado exitosamente'
    });
  } catch (error) {
    console.error('Error al guardar resultado:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al guardar el resultado del test' 
    });
  }
});

// DELETE /tests/eliminar/:id - Eliminar resultado de test
router.delete('/eliminar/:id', autenticarUsuario, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    
    if (!id) {
      return res.status(400).json({
        exito: false,
        error: 'ID de resultado requerido'
      });
    }
    
    const eliminado = await eliminarResultadoTest(id, usuarioId);
    
    if (!eliminado) {
      return res.status(404).json({
        exito: false,
        error: 'Resultado no encontrado o no tienes permisos'
      });
    }
    
    res.json({ 
      exito: true,
      mensaje: 'Resultado de test eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar resultado:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al eliminar el resultado del test' 
    });
  }
});

export default router;