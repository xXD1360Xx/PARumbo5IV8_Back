import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerResultadosVocacionales,
  obtenerUltimoResultadoVocacional,
  obtenerEstadisticasVocacionales,
  obtenerTopCarreras,
  crearResultadoVocacional,
  eliminarResultadoVocacional
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
      error: error.message || 'Error al obtener resultados vocacionales',
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
      error: error.message || 'Error al obtener resultados vocacionales',
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
      return res.status(200).json({
        exito: true,
        data: null,
        mensaje: 'No se encontraron resultados vocacionales',
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
      error: error.message || 'Error al obtener el último resultado vocacional',
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
      return res.status(200).json({
        exito: true,
        data: null,
        mensaje: 'No se encontraron resultados vocacionales',
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
      error: error.message || 'Error al obtener el último resultado vocacional',
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
      error: error.message || 'Error al obtener estadísticas vocacionales',
      data: {
        total_resultados: 0,
        promedio_general: "0.00",
        distribucion_zonas: [],
        fecha_ultimo_resultado: null,
        perfiles_promedio: {
          tecnologico: "0.0",
          cientifico: "0.0",
          salud: "0.0",
          administrativo: "0.0",
          social: "0.0"
        },
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
          perfiles_promedio: {
            tecnologico: "0.0",
            cientifico: "0.0",
            salud: "0.0",
            administrativo: "0.0",
            social: "0.0"
          },
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
      error: error.message || 'Error al obtener estadísticas vocacionales',
      data: {
        total_resultados: 0,
        promedio_general: "0.00",
        distribucion_zonas: [],
        fecha_ultimo_resultado: null,
        perfiles_promedio: {
          tecnologico: "0.0",
          cientifico: "0.0",
          salud: "0.0",
          administrativo: "0.0",
          social: "0.0"
        },
        tiene_permiso: false
      }
    });
  }
});

// ==================== TOP CARRERAS ====================

// GET /api/vocacional/top-carreras - Obtener top 5 carreras del usuario actual
router.get('/top-carreras', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const limite = req.query.limite ? parseInt(req.query.limite) : 5;
    
    console.log('🏆 GET /vocacional/top-carreras - Usuario ID:', usuarioId, 'Límite:', limite);
    
    const topCarreras = await obtenerTopCarreras(usuarioId, usuarioId, limite);
    
    res.json({ 
      exito: true, 
      data: topCarreras,
      mensaje: `Top ${topCarreras.length} carreras obtenidas exitosamente`,
      total: topCarreras.length,
      tiene_permiso: true
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/top-carreras:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener top carreras',
      data: [],
      tiene_permiso: false
    });
  }
});

// GET /api/vocacional/top-carreras/:usuarioId - Obtener top carreras de otro usuario
router.get('/top-carreras/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const usuarioActualId = req.usuario.id;
    const limite = req.query.limite ? parseInt(req.query.limite) : 5;
    
    console.log('🏆 GET /vocacional/top-carreras/:usuarioId - Usuario solicitado:', usuarioId, 'Usuario actual:', usuarioActualId);
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del usuario es requerido',
        data: [],
        tiene_permiso: false
      });
    }

    const topCarreras = await obtenerTopCarreras(usuarioId, usuarioActualId, limite);
    const tienePermiso = topCarreras.length > 0 || usuarioActualId === usuarioId;
    
    res.json({ 
      exito: true, 
      data: topCarreras,
      mensaje: `Top ${topCarreras.length} carreras obtenidas exitosamente`,
      total: topCarreras.length,
      tiene_permiso: tienePermiso
    });
  } catch (error) {
    console.error('❌ Error en GET /vocacional/top-carreras/:usuarioId:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener top carreras',
      data: [],
      tiene_permiso: false
    });
  }
});

// ==================== CRUD VOCACIONAL ====================

// POST /api/vocacional/crear - Crear nuevo resultado vocacional
router.post('/crear', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const datos = req.body;
    
    console.log('➕ POST /vocacional/crear - Usuario ID:', usuarioId, 'Datos recibidos:', Object.keys(datos));
    
    // Validar datos mínimos requeridos
    if (!datos.resultados_completos || !Array.isArray(datos.resultados_completos)) {
      return res.status(400).json({
        exito: false,
        error: 'El campo resultados_completos es requerido y debe ser un array'
      });
    }
    
    // Validar perfiles
    const perfilesRequeridos = [
      'perfil_tecnologico',
      'perfil_cientifico', 
      'perfil_salud',
      'perfil_administrativo',
      'perfil_social'
    ];
    
    for (const perfil of perfilesRequeridos) {
      if (datos[perfil] === undefined || datos[perfil] === null) {
        datos[perfil] = 0;
      }
    }
    
    const nuevoResultado = await crearResultadoVocacional(usuarioId, datos);
    
    res.status(201).json({
      exito: true,
      data: nuevoResultado,
      mensaje: 'Resultado vocacional creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en POST /vocacional/crear:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al crear resultado vocacional'
    });
  }
});

// DELETE /api/vocacional/:resultadoId - Eliminar resultado vocacional
router.delete('/:resultadoId', autenticarUsuario, async (req, res) => {
  try {
    const { resultadoId } = req.params;
    const usuarioId = req.usuario.id;
    
    console.log('🗑️ DELETE /vocacional/:resultadoId - Resultado ID:', resultadoId, 'Usuario ID:', usuarioId);
    
    if (!resultadoId) {
      return res.status(400).json({
        exito: false,
        error: 'ID del resultado es requerido'
      });
    }
    
    const resultadoEliminado = await eliminarResultadoVocacional(resultadoId, usuarioId);
    
    res.json({
      exito: true,
      data: resultadoEliminado,
      mensaje: 'Resultado vocacional eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en DELETE /vocacional/:resultadoId:', error);
    const statusCode = error.message.includes('No tienes permiso') ? 403 : 
                      error.message.includes('no encontrado') ? 404 : 500;
    
    res.status(statusCode).json({
      exito: false,
      error: error.message || 'Error al eliminar resultado vocacional'
    });
  }
});

// ==================== RESÚMENES COMPLETOS ====================

// GET /api/vocacional/resumen - Resumen completo para el usuario actual
router.get('/resumen', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    
    console.log('📋 GET /vocacional/resumen - Usuario ID:', usuarioId);
    
    // Obtener todo en paralelo para mejor rendimiento
    const [ultimoResultado, estadisticas, topCarreras] = await Promise.all([
      obtenerUltimoResultadoVocacional(usuarioId, usuarioId),
      obtenerEstadisticasVocacionales(usuarioId, usuarioId),
      obtenerTopCarreras(usuarioId, usuarioId, 5)
    ]);
    
    const resumen = {
      exito: true,
      data: {
        ultimo_resultado: ultimoResultado,
        estadisticas: estadisticas,
        top_carreras: topCarreras,
        usuario: {
          id: usuarioId,
          es_propietario: true
        },
        timestamp: new Date().toISOString()
      },
      mensaje: 'Resumen vocacional obtenido exitosamente'
    };
    
    res.json(resumen);
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resumen:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al obtener resumen vocacional',
      data: {
        ultimo_resultado: null,
        estadisticas: {
          total_resultados: 0,
          promedio_general: "0.00",
          distribucion_zonas: [],
          fecha_ultimo_resultado: null,
          perfiles_promedio: {
            tecnologico: "0.0",
            cientifico: "0.0",
            salud: "0.0",
            administrativo: "0.0",
            social: "0.0"
          },
          tiene_permiso: false
        },
        top_carreras: [],
        usuario: {
          id: req.usuario?.id || null,
          es_propietario: true
        }
      }
    });
  }
});

// GET /api/vocacional/resumen/:usuarioId - Resumen completo para otro usuario
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
          top_carreras: [],
          usuario: {
            id: usuarioId,
            es_propietario: false
          }
        }
      });
    }

    // Obtener todo en paralelo
    const [ultimoResultado, estadisticas, topCarreras] = await Promise.all([
      obtenerUltimoResultadoVocacional(usuarioId, usuarioActualId),
      obtenerEstadisticasVocacionales(usuarioId, usuarioActualId),
      obtenerTopCarreras(usuarioId, usuarioActualId, 5)
    ]);
    
    const esPropietario = usuarioActualId === usuarioId;
    const tienePermisoVerResultados = ultimoResultado !== null || esPropietario;
    const tienePermisoVerEstadisticas = estadisticas.tiene_permiso !== false;
    const tienePermisoVerCarreras = topCarreras.length > 0 || esPropietario;
    
    const resumen = {
      exito: true,
      data: {
        ultimo_resultado: tienePermisoVerResultados ? ultimoResultado : null,
        estadisticas: tienePermisoVerEstadisticas ? estadisticas : {
          total_resultados: 0,
          promedio_general: "0.00",
          distribucion_zonas: [],
          fecha_ultimo_resultado: null,
          perfiles_promedio: {
            tecnologico: "0.0",
            cientifico: "0.0",
            salud: "0.0",
            administrativo: "0.0",
            social: "0.0"
          },
          tiene_permiso: false
        },
        top_carreras: tienePermisoVerCarreras ? topCarreras : [],
        usuario: {
          id: usuarioId,
          es_propietario: esPropietario
        },
        permisos: {
          ver_resultados: tienePermisoVerResultados,
          ver_estadisticas: tienePermisoVerEstadisticas,
          ver_carreras: tienePermisoVerCarreras
        },
        timestamp: new Date().toISOString()
      },
      mensaje: 'Resumen vocacional obtenido exitosamente'
    };
    
    res.json(resumen);
  } catch (error) {
    console.error('❌ Error en GET /vocacional/resumen/:usuarioId:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al obtener resumen vocacional',
      data: {
        ultimo_resultado: null,
        estadisticas: {
          total_resultados: 0,
          promedio_general: "0.00",
          distribucion_zonas: [],
          fecha_ultimo_resultado: null,
          tiene_permiso: false
        },
        top_carreras: [],
        usuario: {
          id: req.params?.usuarioId || null,
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
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// GET /api/vocacional/health - Health check
router.get('/health', (req, res) => {
  res.json({
    exito: true,
    servicio: 'vocacional',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;