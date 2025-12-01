import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosVocacionales,
  obtenerUltimoResultadoVocacional,
  obtenerEstadisticasVocacionales,
  guardarResultadoVocacional,
  eliminarResultadoVocacional
} from '../controladores/vocacionalControlador.js';

const router = express.Router();

// GET /api/vocacional/historial/:usuarioId - Obtener historial de resultados vocacionales
router.get('/historial/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Validar que el usuarioId sea un UUID válido
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    // Usar la función del controlador
    const resultados = await obtenerResultadosVocacionales(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Historial vocacional obtenido exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('Error al obtener historial vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el historial de resultados vocacionales' 
    });
  }
});

// GET /api/vocacional/ultimo/:usuarioId - Obtener el último resultado vocacional
router.get('/ultimo/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId);
    
    if (!ultimoResultado) {
      return res.status(404).json({
        exito: false,
        error: 'No se encontraron resultados vocacionales para este usuario'
      });
    }
    
    res.json({ 
      exito: true, 
      datos: ultimoResultado,
      mensaje: 'Último resultado vocacional obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener último resultado vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el último resultado vocacional' 
    });
  }
});

// GET /api/vocacional/estadisticas/:usuarioId - Obtener estadísticas vocacionales
router.get('/estadisticas/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const estadisticas = await obtenerEstadisticasVocacionales(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: estadisticas,
      mensaje: 'Estadísticas vocacionales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener estadísticas vocacionales:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas vocacionales' 
    });
  }
});

// POST /api/vocacional/guardar - Guardar nuevo resultado vocacional
router.post('/guardar', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId, respuestas, carreras, promedio_general, zona_ikigai } = req.body;
    
    // Validaciones
    if (!usuarioId || !respuestas || !carreras || !zona_ikigai) {
      return res.status(400).json({
        exito: false,
        error: 'Datos incompletos para guardar el resultado'
      });
    }
    
    const resultadoData = {
      respuestas,
      carreras,
      promedio_general: promedio_general || 0,
      zona_ikigai
    };
    
    const resultadoGuardado = await guardarResultadoVocacional(usuarioId, resultadoData);
    
    res.json({ 
      exito: true, 
      datos: resultadoGuardado,
      mensaje: 'Resultado vocacional guardado exitosamente'
    });
  } catch (error) {
    console.error('Error al guardar resultado vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al guardar el resultado vocacional' 
    });
  }
});

// DELETE /api/vocacional/eliminar/:id/:usuarioId - Eliminar resultado vocacional
router.delete('/eliminar/:id/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { id, usuarioId } = req.params;
    
    if (!id || !usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID de resultado o usuario inválido'
      });
    }
    
    const eliminado = await eliminarResultadoVocacional(id, usuarioId);
    
    if (!eliminado) {
      return res.status(404).json({
        exito: false,
        error: 'Resultado no encontrado o no tienes permisos para eliminarlo'
      });
    }
    
    res.json({ 
      exito: true,
      mensaje: 'Resultado vocacional eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar resultado vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al eliminar el resultado vocacional' 
    });
  }
});

export default router;