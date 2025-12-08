import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosVocacionales,
  obtenerUltimoResultadoVocacional,
  obtenerEstadisticasVocacionales
} from '../controladores/vocacionalControlador.js';

const router = express.Router();

// ==================== RESULTADOS VOCACIONALES ====================

// GET /api/vocacional/resultados - Obtener resultados del usuario autenticado
router.get('/resultados', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('🎓 GET /vocacional/resultados - Usuario ID:', usuarioId);
    
    const resultados = await obtenerResultadosVocacionales(usuarioId, usuarioId);
    
    res.json({ 
      exito: true, 
      data: resultados,
      mensaje: 'Resultados vocacionales obtenidos exitosamente',
      total: resultados.length,
      tiene_permiso: true
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resultados:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados vocacionales',
      data: [],
      tiene_permiso: false
    });
  }
});

// GET /api/vocacional/resultados/:usuarioId - Obtener resultados de otro usuario
router.get('/resultados/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('🎓 GET /vocacional/resultados/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: [],
        tiene_permiso: false
      });
    }

    const resultados = await obtenerResultadosVocacionales(usuarioId, usuarioActualId);
    const tienePermiso = resultados.length > 0 || usuarioActualId === usuarioId;
    
    res.json({ 
      exito: true, 
      data: resultados,
      mensaje: 'Resultados vocacionales obtenidos exitosamente',
      total: resultados.length,
      tiene_permiso: tienePermiso
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resultados/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resultados vocacionales',
      data: [],
      tiene_permiso: false
    });
  }
});

// GET /api/vocacional/ultimo - Obtener el último resultado vocacional del usuario
router.get('/ultimo', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('🎓 GET /vocacional/ultimo - Usuario ID:', usuarioId);
    
    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId, usuarioId);
    
    if (!ultimoResultado) {
      return res.status(404).json({
        exito: false,
        error: 'No se encontraron resultados vocacionales',
        data: null,
        tiene_permiso: true
      });
    }
    
    res.json({ 
      exito: true, 
      data: ultimoResultado,
      mensaje: 'Último resultado vocacional obtenido exitosamente',
      tiene_permiso: true
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/ultimo:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el último resultado vocacional',
      data: null,
      tiene_permiso: false
    });
  }
});

// GET /api/vocacional/ultimo/:usuarioId - Obtener el último resultado de otro usuario
router.get('/ultimo/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('🎓 GET /vocacional/ultimo/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: null,
        tiene_permiso: false
      });
    }

    const ultimoResultado = await obtenerUltimoResultadoVocacional(usuarioId, usuarioActualId);
    const tienePermiso = ultimoResultado !== null || usuarioActualId === usuarioId;
    
    if (!ultimoResultado) {
      return res.status(404).json({
        exito: false,
        error: 'No se encontraron resultados vocacionales',
        data: null,
        tiene_permiso: tienePermiso
      });
    }
    
    res.json({ 
      exito: true, 
      data: ultimoResultado,
      mensaje: 'Último resultado vocacional obtenido exitosamente',
      tiene_permiso: true
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/ultimo/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el último resultado vocacional',
      data: null,
      tiene_permiso: false
    });
  }
});

// ==================== ESTADÍSTICAS ====================

// GET /api/vocacional/estadisticas - Obtener estadísticas vocacionales del usuario
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('📈 GET /vocacional/estadisticas - Usuario ID:', usuarioId);
    
    const estadisticas = await obtenerEstadisticasVocacionales(usuarioId, usuarioId);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas vocacionales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/estadisticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas vocacionales',
      data: {
        total_resultados: 0,
        promedio_general: "0.00",
        distribucion_zonas: [],
        fecha_ultimo_resultado: null,
        tiene_permiso: false
      }
    });
  }
});

// GET /api/vocacional/estadisticas/:usuarioId - Obtener estadísticas de otro usuario
router.get('/estadisticas/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📈 GET /vocacional/estadisticas/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: {
          total_resultados: 0,
          promedio_general: "0.00",
          distribucion_zonas: [],
          fecha_ultimo_resultado: null,
          tiene_permiso: false
        }
      });
    }

    const estadisticas = await obtenerEstadisticasVocacionales(usuarioId, usuarioActualId);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas vocacionales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/estadisticas/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas vocacionales',
      data: {
        total_resultados: 0,
        promedio_general: "0.00",
        distribucion_zonas: [],
        fecha_ultimo_resultado: null,
        tiene_permiso: false
      }
    });
  }
});

// ==================== RUTAS PARA LA PANTALLA DE RESULTADOS ====================

// GET /api/vocacional/resumen/:usuarioId - Resumen completo para la pantalla de resultados
router.get('/resumen/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    
    console.log('📋 GET /vocacional/resumen/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: {
          ultimo_resultado: null,
          estadisticas: {
            total_resultados: 0,
            promedio_general: "0.00",
            distribucion_zonas: [],
            fecha_ultimo_resultado: null,
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

    // Obtener todo en paralelo
    const [ultimoResultado, estadisticas] = await Promise.all([
      obtenerUltimoResultadoVocacional(usuarioId, usuarioActualId),
      obtenerEstadisticasVocacionales(usuarioId, usuarioActualId)
    ]);
    
    const esPropietario = usuarioActualId === usuarioId;
    const tienePermisoVerResultados = ultimoResultado !== null || esPropietario;
    const tienePermisoVerEstadisticas = estadisticas.tiene_permiso !== false;
    
    res.json({ 
      exito: true, 
      data: {
        ultimo_resultado: ultimoResultado,
        estadisticas: estadisticas,
        permisos: {
          ver_resultados: tienePermisoVerResultados,
          ver_estadisticas: tienePermisoVerEstadisticas,
          es_propietario: esPropietario
        }
      },
      mensaje: 'Resumen vocacional obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resumen/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener resumen vocacional',
      data: {
        ultimo_resultado: null,
        estadisticas: {
          total_resultados: 0,
          promedio_general: "0.00",
          distribucion_zonas: [],
          fecha_ultimo_resultado: null,
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

// GET /api/vocacional/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio vocacional funcionando',
    usuario: {
      id: req.usuario.id,
      nombre_usuario: req.usuario.username,
      email: req.usuario.email
    },
    timestamp: new Date().toISOString()
  });
});

export default router;