import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerMiPerfil,
  obtenerEstadisticasUsuario,
  actualizarPerfilUsuario,
  subirFotoPerfil,
  subirFotoPortada,
  eliminarFotoPerfil,
  eliminarFotoPortada,
  upload,
  // NUEVAS FUNCIONES
  verificarDisponibilidadUsername,
  buscarUsuarios,
  obtenerPerfilUsuario,
  seguirUsuario,
  dejarDeSeguirUsuario,
  obtenerSeguidores,
  obtenerSeguidos,
  verificarSiSigue
} from '../controladores/usuarioControlador.js';

const router = express.Router();

// ==================== RUTAS DE PERFIL ====================

// GET /api/usuario/perfil - Obtener perfil del usuario
router.get('/perfil', autenticarUsuario, async (req, res) => {
  try {
    console.log('👤 GET /usuario/perfil - Usuario ID:', req.usuario.id);
    
    const perfil = await obtenerMiPerfil(req.usuario.id);
    
    if (!perfil) {
      return res.status(404).json({
        exito: false,
        error: 'Perfil no encontrado'
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
      error: 'Error al obtener el perfil'
    });
  }
});

// PUT /api/usuario/perfil - Actualizar perfil del usuario
router.put('/perfil', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    console.log('✏️ PUT /usuario/perfil - Usuario ID:', usuarioId);
    console.log('📝 Datos recibidos:', req.body);
    
    // Validar que haya datos para actualizar
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        exito: false,
        error: 'No se proporcionaron datos para actualizar'
      });
    }
    
    // Roles permitidos
    const rolesPermitidos = ['estudiante', 'egresado', 'maestro', 'admin'];
    
    // Validar rol si se está actualizando
    if (req.body.role || req.body.rol) {
      const rolEnviado = (req.body.role || req.body.rol).toLowerCase();
      
      if (!rolesPermitidos.includes(rolEnviado)) {
        return res.status(400).json({
          exito: false,
          error: `Rol inválido. Roles permitidos: ${rolesPermitidos.join(', ')}`
        });
      }
    }
    
    const perfilActualizado = await actualizarPerfilUsuario(usuarioId, req.body);
    
    res.json({ 
      exito: true, 
      usuario: perfilActualizado,
      mensaje: 'Perfil actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error en PUT /usuario/perfil:', error);
    
    let statusCode = 500;
    let mensajeError = 'Error al actualizar el perfil';
    
    if (error.message.includes('ya está en uso')) {
      statusCode = 409;
      mensajeError = error.message;
    } else if (error.message.includes('No se proporcionaron datos')) {
      statusCode = 400;
      mensajeError = error.message;
    } else if (error.message.includes('no encontrado')) {
      statusCode = 404;
      mensajeError = 'Usuario no encontrado';
    } else if (error.message.includes('inválido')) {
      statusCode = 400;
      mensajeError = error.message;
    }
    
    res.status(statusCode).json({ 
      exito: false, 
      error: mensajeError,
      detalle: error.message
    });
  }
});

// ==================== RUTAS DE VERIFICACIÓN DE USERNAME ====================

// GET /api/usuario/verificar-username/:username
router.get('/verificar-username/:username', autenticarUsuario, async (req, res) => {
  try {
    const { username } = req.params;
    console.log('🔍 GET /verificar-username/:username - Verificando:', username);
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        exito: false,
        error: 'El nombre de usuario debe tener al menos 3 caracteres'
      });
    }
    
    const resultado = await verificarDisponibilidadUsername(username);
    
    res.json({
      exito: true,
      disponible: resultado.disponible,
      mensaje: resultado.mensaje,
      sugerencias: resultado.sugerencias || []
    });
    
  } catch (error) {
    console.error('❌ Error en GET /verificar-username:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al verificar el nombre de usuario'
    });
  }
});

// ==================== RUTAS DE BÚSQUEDA ====================

// GET /api/usuario/buscar
router.get('/buscar', autenticarUsuario, async (req, res) => {
  try {
    const { q, pagina = 1, limite = 20 } = req.query;
    const usuarioId = req.usuario.id;
    
    console.log('🔍 GET /usuario/buscar - Término:', q, 'Usuario ID:', usuarioId);
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        exito: false,
        error: 'El término de búsqueda debe tener al menos 2 caracteres',
        data: []
      });
    }
    
    const usuarios = await buscarUsuarios(q.trim(), usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: usuarios,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: usuarios.length
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/buscar:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al buscar usuarios',
      data: []
    });
  }
});

// GET /api/usuario/perfil/:id - Obtener perfil público de otro usuario
router.get('/perfil/:id', autenticarUsuario, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    
    console.log('👤 GET /usuario/perfil/:id - ID solicitado:', id, 'Usuario ID:', usuarioId);
    
    const perfil = await obtenerPerfilUsuario(id, usuarioId);
    
    res.json({
      exito: true,
      usuario: perfil,
      mensaje: 'Perfil obtenido exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/perfil/:id:', error);
    
    let statusCode = 500;
    let mensajeError = 'Error al obtener el perfil';
    
    if (error.message.includes('no encontrado')) {
      statusCode = 404;
      mensajeError = 'Usuario no encontrado';
    } else if (error.message.includes('privado')) {
      statusCode = 403;
      mensajeError = 'Perfil privado';
    }
    
    res.status(statusCode).json({
      exito: false,
      error: mensajeError
    });
  }
});

// ==================== RUTAS DE SEGUIMIENTO ====================

// POST /api/usuario/seguir/:id - Seguir a un usuario
router.post('/seguir/:id', autenticarUsuario, async (req, res) => {
  try {
    const followerId = req.usuario.id;
    const { id: followingId } = req.params;
    
    console.log('👥 POST /usuario/seguir/:id - Seguidor:', followerId, 'Seguido:', followingId);
    
    const resultado = await seguirUsuario(followerId, followingId);
    
    res.json({
      exito: true,
      mensaje: resultado.mensaje
    });
    
  } catch (error) {
    console.error('❌ Error en POST /usuario/seguir/:id:', error);
    
    let statusCode = 500;
    let mensajeError = 'Error al seguir al usuario';
    
    if (error.message.includes('No puedes seguirte a ti mismo')) {
      statusCode = 400;
      mensajeError = error.message;
    } else if (error.message.includes('no encontrado')) {
      statusCode = 404;
      mensajeError = 'Usuario no encontrado';
    } else if (error.message.includes('Ya sigues')) {
      statusCode = 409;
      mensajeError = error.message;
    }
    
    res.status(statusCode).json({
      exito: false,
      error: mensajeError
    });
  }
});

// DELETE /api/usuario/seguir/:id - Dejar de seguir a un usuario
router.delete('/seguir/:id', autenticarUsuario, async (req, res) => {
  try {
    const followerId = req.usuario.id;
    const { id: followingId } = req.params;
    
    console.log('👥 DELETE /usuario/seguir/:id - Seguidor:', followerId, 'Seguido:', followingId);
    
    const resultado = await dejarDeSeguirUsuario(followerId, followingId);
    
    res.json({
      exito: true,
      mensaje: resultado.mensaje
    });
    
  } catch (error) {
    console.error('❌ Error en DELETE /usuario/seguir/:id:', error);
    
    let statusCode = 500;
    let mensajeError = 'Error al dejar de seguir al usuario';
    
    if (error.message.includes('No sigues a este usuario')) {
      statusCode = 404;
      mensajeError = error.message;
    }
    
    res.status(statusCode).json({
      exito: false,
      error: mensajeError
    });
  }
});

// GET /api/usuario/seguidores - Obtener seguidores del usuario
router.get('/seguidores', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 20 } = req.query;
    
    console.log('👥 GET /usuario/seguidores - Usuario ID:', usuarioId);
    
    const seguidores = await obtenerSeguidores(usuarioId, usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: seguidores,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: seguidores.length
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/seguidores:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener seguidores',
      data: []
    });
  }
});

// GET /api/usuario/seguidores/:id - Obtener seguidores de otro usuario
router.get('/seguidores/:id', autenticarUsuario, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 20 } = req.query;
    
    console.log('👥 GET /usuario/seguidores/:id - Usuario ID:', id);
    
    const seguidores = await obtenerSeguidores(id, usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: seguidores,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: seguidores.length
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/seguidores/:id:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener seguidores',
      data: []
    });
  }
});

// GET /api/usuario/seguidos - Obtener usuarios que sigue el usuario
router.get('/seguidos', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 20 } = req.query;
    
    console.log('👥 GET /usuario/seguidos - Usuario ID:', usuarioId);
    
    const seguidos = await obtenerSeguidos(usuarioId, usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: seguidos,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: seguidos.length
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/seguidos:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener seguidos',
      data: []
    });
  }
});

// GET /api/usuario/seguidos/:id - Obtener usuarios que sigue otro usuario
router.get('/seguidos/:id', autenticarUsuario, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 20 } = req.query;
    
    console.log('👥 GET /usuario/seguidos/:id - Usuario ID:', id);
    
    const seguidos = await obtenerSeguidos(id, usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: seguidos,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: seguidos.length
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/seguidos/:id:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener seguidos',
      data: []
    });
  }
});

// GET /api/usuario/verificar-seguimiento/:id - Verificar si sigue a un usuario
router.get('/verificar-seguimiento/:id', autenticarUsuario, async (req, res) => {
  try {
    const followerId = req.usuario.id;
    const { id: followingId } = req.params;
    
    console.log('🔍 GET /verificar-seguimiento/:id - Seguidor:', followerId, 'Seguido:', followingId);
    
    const sigue = await verificarSiSigue(followerId, followingId);
    
    res.json({
      exito: true,
      sigue: sigue,
      mensaje: sigue ? 'Sigues a este usuario' : 'No sigues a este usuario'
    });
    
  } catch (error) {
    console.error('❌ Error en GET /verificar-seguimiento/:id:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al verificar seguimiento',
      sigue: false
    });
  }
});

// ==================== RUTAS DE FOTOS ====================

// POST /api/usuario/foto-perfil - Subir foto de perfil
router.post('/foto-perfil', autenticarUsuario, upload.single('imagen'), async (req, res) => {
  try {
    console.log('📸 POST /usuario/foto-perfil - Usuario ID:', req.usuario.id);
    
    if (!req.file) {
      return res.status(400).json({
        exito: false,
        error: 'No se subió ninguna imagen'
      });
    }

    const resultado = await subirFotoPerfil(req.usuario.id, req.file.path);
    
    res.json({ 
      exito: true, 
      usuario: resultado.usuario,
      url: resultado.url,
      mensaje: 'Foto de perfil actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en POST /usuario/foto-perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al subir la foto de perfil'
    });
  }
});

// POST /api/usuario/foto-portada - Subir foto de portada
router.post('/foto-portada', autenticarUsuario, upload.single('imagen'), async (req, res) => {
  try {
    console.log('🌅 POST /usuario/foto-portada - Usuario ID:', req.usuario.id);
    
    if (!req.file) {
      return res.status(400).json({
        exito: false,
        error: 'No se subió ninguna imagen'
      });
    }

    const resultado = await subirFotoPortada(req.usuario.id, req.file.path);
    
    res.json({ 
      exito: true, 
      usuario: resultado.usuario,
      url: resultado.url,
      mensaje: 'Foto de portada actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en POST /usuario/foto-portada:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al subir la foto de portada'
    });
  }
});

// DELETE /api/usuario/foto-perfil - Eliminar foto de perfil
router.delete('/foto-perfil', autenticarUsuario, async (req, res) => {
  try {
    console.log('🗑️ DELETE /usuario/foto-perfil - Usuario ID:', req.usuario.id);
    
    const usuarioActualizado = await eliminarFotoPerfil(req.usuario.id);
    
    res.json({ 
      exito: true, 
      usuario: usuarioActualizado,
      mensaje: 'Foto de perfil eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en DELETE /usuario/foto-perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al eliminar la foto de perfil'
    });
  }
});

// DELETE /api/usuario/foto-portada - Eliminar foto de portada
router.delete('/foto-portada', autenticarUsuario, async (req, res) => {
  try {
    console.log('🗑️ DELETE /usuario/foto-portada - Usuario ID:', req.usuario.id);
    
    const usuarioActualizado = await eliminarFotoPortada(req.usuario.id);
    
    res.json({ 
      exito: true, 
      usuario: usuarioActualizado,
      mensaje: 'Foto de portada eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en DELETE /usuario/foto-portada:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al eliminar la foto de portada'
    });
  }
});

// ==================== RUTAS DE ESTADÍSTICAS ====================

// GET /api/usuario/estadisticas - Obtener estadísticas del usuario
router.get('/estadisticas', autenticarUsuario, async (req, res) => {
  try {
    console.log('📊 GET /usuario/estadisticas - Usuario ID:', req.usuario.id);
    
    const estadisticas = await obtenerEstadisticasUsuario(req.usuario.id, req.usuario.id);
    
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
      data: {
        resultados_tests: 0,
        tests_completados: 0,
        resultados_vocacionales: 0,
        seguidores: 0,
        seguidos: 0,
        privacidad: false
      }
    });
  }
});

// GET /api/usuario/estadisticas/:id - Obtener estadísticas de otro usuario
router.get('/estadisticas/:id', autenticarUsuario, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    
    console.log('📊 GET /usuario/estadisticas/:id - Usuario ID:', id);
    
    const estadisticas = await obtenerEstadisticasUsuario(id, usuarioId);
    
    res.json({ 
      exito: true, 
      data: estadisticas,
      mensaje: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en GET /usuario/estadisticas/:id:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas',
      data: {
        resultados_tests: 0,
        tests_completados: 0,
        resultados_vocacionales: 0,
        seguidores: 0,
        seguidos: 0,
        privacidad: true
      }
    });
  }
});

// GET /api/usuario/buscar-por-rol/:rol
router.get('/buscar-por-rol/:rol', autenticarUsuario, async (req, res) => {
  try {
    const { rol } = req.params;
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 50 } = req.query;
    
    console.log('👥 GET /usuario/buscar-por-rol/:rol - Rol:', rol, 'Usuario ID:', usuarioId);
    
    const rolesPermitidos = ['estudiante', 'egresado', 'maestro', 'admin'];
    
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        exito: false,
        error: `Rol inválido. Roles permitidos: ${rolesPermitidos.join(', ')}`,
        data: []
      });
    }
    
    // Función que debes agregar al controlador
    const usuarios = await buscarUsuariosPorRol(rol, usuarioId, parseInt(pagina), parseInt(limite));
    
    res.json({
      exito: true,
      data: usuarios,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total: usuarios.length,
      rol: rol
    });
    
  } catch (error) {
    console.error('❌ Error en GET /usuario/buscar-por-rol/:rol:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al buscar usuarios por rol',
      data: []
    });
  }
});

// ==================== RUTA DE PRUEBA ====================

// GET /api/usuario/ping - Endpoint de prueba
router.get('/ping', autenticarUsuario, (req, res) => {
  res.json({ 
    exito: true, 
    mensaje: 'Servicio de usuarios funcionando',
    usuario: {
      id: req.usuario.id,
      nombre_usuario: req.usuario.username,
      email: req.usuario.email
    },
    timestamp: new Date().toISOString()
  });
});

export default router;