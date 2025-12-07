import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerMiPerfil,
  obtenerPerfilPublico,
  obtenerEstadisticasUsuario,
  obtenerDatosDashboard,
  actualizarPerfilUsuario,
  buscarUsuarios,
  verificarUsuarioExiste,
  obtenerConfiguracionUsuario,
  actualizarConfiguracionUsuario
} from '../controladores/usuarioControlador.js';

const router = express.Router();

// ==================== PERFIL ====================

// GET /api/usuario/perfil - Obtener perfil del usuario autenticado
router.get('/perfil', autenticarUsuario, async (req, res) => {
  try {
    console.log('👤 GET /usuario/perfil - Usuario ID:', req.usuario.id);
    
    const perfil = await obtenerMiPerfil(req.usuario.id);
    
    if (!perfil) {
      return res.status(404).json({
        exito: false,
        error: 'Perfil de usuario no encontrado'
      });
    }

    res.json({ 
      exito: true, 
      usuario: perfil,
      mensaje: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el perfil del usuario',
      detalle: error.message
    });
  }
});

// GET /api/usuario/perfil/:usuarioId - Obtener perfil público de otro usuario
router.get('/perfil/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    console.log('👤 GET /usuario/perfil/:id - ID solicitado:', usuarioId);
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const perfil = await obtenerPerfilPublico(usuarioId);
    
    if (!perfil) {
      return res.status(404).json({
        exito: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({ 
      exito: true, 
      usuario: perfil,
      mensaje: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/perfil/:id:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el perfil del usuario',
      detalle: error.message
    });
  }
});

// PUT /api/usuario/perfil - Actualizar perfil del usuario
router.put('/perfil', autenticarUsuario, async (req, res) => {
  try {
    console.log('✏️ PUT /usuario/perfil - Usuario ID:', req.usuario.id);
    console.log('📝 Datos recibidos:', req.body);
    
    const perfilActualizado = await actualizarPerfilUsuario(req.usuario.id, req.body);
    
    res.json({ 
      exito: true, 
      usuario: perfilActualizado,
      mensaje: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en PUT /usuario/perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al actualizar el perfil',
      detalle: error.message
    });
  }
});

// ==================== ESTADÍSTICAS ====================

// GET /api/usuario/estadisticas - Obtener estadísticas del usuario
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    console.log('📊 GET /usuario/estadisticas - Usuario ID:', req.usuario.id);
    
    const estadisticas = await obtenerEstadisticasUsuario(req.usuario.id);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/estadisticas:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas',
      detalle: error.message,
      // Aún en error, devolver valores por defecto
      data: {
        resultados: 0,
        seguidores: 0,
        seguidos: 0,
        resultados_vocacionales: 0,
        tests_completados: 0
      }
    });
  }
});

// ==================== DASHBOARD ====================

// GET /api/usuario/dashboard - Obtener datos completos para el dashboard
router.get('/dashboard', autenticarUsuario, async (req, res) => {
  try {
    console.log('📋 GET /usuario/dashboard - Usuario ID:', req.usuario.id);
    
    const dashboardData = await obtenerDatosDashboard(req.usuario.id);
    
    res.json({ 
      exito: true, 
      data: dashboardData,
      mensaje: 'Datos del dashboard obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/dashboard:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener datos del dashboard',
      detalle: error.message
    });
  }
});

// ==================== BÚSQUEDA ====================

// GET /api/usuario/buscar - Buscar usuarios
router.get('/buscar', autenticarUsuario, async (req, res) => {
  try {
    const { q, limite = 10 } = req.query;
    console.log('🔍 GET /usuario/buscar - Término:', q, 'Límite:', limite);
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        exito: false,
        error: 'Término de búsqueda demasiado corto (mínimo 2 caracteres)'
      });
    }

    const resultados = await buscarUsuarios(q, parseInt(limite));
    
    res.json({ 
      exito: true, 
      usuarios: resultados,
      total: resultados.length,
      mensaje: 'Búsqueda completada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/buscar:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al buscar usuarios',
      detalle: error.message
    });
  }
});

// ==================== VERIFICACIÓN ====================

// GET /api/usuario/verificar/:usuarioId - Verificar si un usuario existe
router.get('/verificar/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    console.log('✅ GET /usuario/verificar/:id - ID:', usuarioId);
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const existe = await verificarUsuarioExiste(usuarioId);
    
    res.json({ 
      exito: true, 
      existe: existe,
      mensaje: existe ? 'Usuario encontrado' : 'Usuario no encontrado'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/verificar/:id:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al verificar usuario',
      detalle: error.message
    });
  }
});

// ==================== CONFIGURACIÓN ====================

// GET /api/usuario/configuracion - Obtener configuración del usuario
router.get('/configuracion', autenticarUsuario, async (req, res) => {
  try {
    console.log('⚙️ GET /usuario/configuracion - Usuario ID:', req.usuario.id);
    
    const configuracion = await obtenerConfiguracionUsuario(req.usuario.id);
    
    res.json({ 
      exito: true, 
      configuracion: configuracion,
      mensaje: 'Configuración obtenida exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/configuracion:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener configuración',
      detalle: error.message
    });
  }
});

// PUT /api/usuario/configuracion - Actualizar configuración del usuario
router.put('/configuracion', autenticarUsuario, async (req, res) => {
  try {
    console.log('⚙️ PUT /usuario/configuracion - Usuario ID:', req.usuario.id);
    console.log('🔧 Datos de configuración:', req.body);
    
    const configuracionActualizada = await actualizarConfiguracionUsuario(req.usuario.id, req.body);
    
    res.json({ 
      exito: true, 
      configuracion: configuracionActualizada,
      mensaje: 'Configuración actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en PUT /usuario/configuracion:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al actualizar configuración',
      detalle: error.message
    });
  }
});

// ==================== ENDPOINT DE PRUEBA ====================

// GET /api/usuario/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio de usuarios funcionando',
    usuario: req.usuario,
    timestamp: new Date().toISOString()
  });
});

export default router;