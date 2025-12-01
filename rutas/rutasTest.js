import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosTests, 
  obtenerDetallesTest,
  insertarResultadoTest,
  obtenerEstadisticasTests 
} from '../controladores/testsControlador.js';

const router = express.Router();

// GET /tests/mis-resultados - Obtener todos los resultados del usuario
router.get('/mis-resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const resultados = await obtenerResultadosTests(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Resultados obtenidos exitosamente'
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

// POST /tests/nuevo-resultado - Insertar nuevo resultado de test
router.post('/nuevo-resultado', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { testId, puntuacion, areas } = req.body;
    
    if (!testId || !puntuacion) {
      return res.status(400).json({
        exito: false,
        error: 'testId y puntuacion son requeridos'
      });
    }

    const resultado = await insertarResultadoTest(usuarioId, testId, puntuacion, areas);
    
    res.status(201).json({ 
      exito: true, 
      datos: resultado,
      mensaje: 'Resultado guardado exitosamente'
    });
  } catch (error) {
    console.error('Error al insertar resultado:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al guardar el resultado del test' 
    });
  }
});

// GET /tests/estadisticas - Obtener estadísticas del usuario
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

// GET /tests/ - Obtener todos los tests disponibles
router.get('/', autenticarUsuario, async (req, res) => {
  try {
    const consulta = `
      SELECT id, nombre, descripcion, duracion, preguntas_total, fecha_creacion
      FROM tests_vocacionales 
      WHERE activo = true
      ORDER BY nombre
    `;
    
    const { pool } = await import('../configuracion/baseDeDatos.js');
    const resultado = await pool.query(consulta);
    
    res.json({ 
      exito: true, 
      datos: resultado.rows,
      mensaje: 'Tests obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener tests:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener la lista de tests' 
    });
  }
});

export default router;