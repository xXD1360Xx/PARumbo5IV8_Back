import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosVocacionales,
  obtenerUltimoResultadoVocacional,
  obtenerEstadisticasVocacionales
} from '../controladores/vocacionalControlador.js';

const router = express.Router();

// ==================== RESULTADOS VOCACIONALES (SOLO LECTURA) ====================

// GET /api/vocacional/resultados - Obtener resultados del usuario autenticado
router.get('/resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('🎓 GET /vocacional/resultados - Usuario ID:', usuarioId);
    
    const resultados = await obtenerResultadosVocacionales(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Resultados vocacionales obtenidos exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados vocacionales',
      datos: []
    });
  }
});

// GET /api/vocacional/ultimo - Obtener el último resultado vocacional del usuario
router.get('/ultimo', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('🎓 GET /vocacional/ultimo - Usuario ID:', usuarioId);
    
    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId);
    
    if (!ultimoResultado) {
      return res.status(404).json({
        exito: false,
        error: 'No se encontraron resultados vocacionales',
        datos: null
      });
    }
    
    res.json({ 
      exito: true, 
      datos: ultimoResultado,
      mensaje: 'Último resultado vocacional obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/ultimo:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el último resultado vocacional',
      datos: null
    });
  }
});

// GET /api/vocacional/estadisticas - Obtener estadísticas vocacionales del usuario
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📈 GET /vocacional/estadisticas - Usuario ID:', usuarioId);
    
    const estadisticas = await obtenerEstadisticasVocacionales(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: estadisticas,
      mensaje: 'Estadísticas vocacionales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/estadisticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas vocacionales',
      datos: {
        total_resultados: 0,
        promedio_general: "0.00",
        distribucion_zonas: []
      }
    });
  }
});

// ==================== ENDPOINT DE PRUEBA ====================

// GET /api/vocacional/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio vocacional funcionando',
    usuario: req.usuario.email,
    timestamp: new Date().toISOString()
  });
});

export default router;