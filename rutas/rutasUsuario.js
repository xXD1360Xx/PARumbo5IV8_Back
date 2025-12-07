import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerMiPerfil,
  obtenerEstadisticasUsuario,
  actualizarPerfilUsuario,  // ← ÚNICA función para actualizar perfil
  subirFotoPerfil,
  subirFotoPortada,
  eliminarFotoPerfil,
  eliminarFotoPortada,
  upload
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

// PUT /api/usuario/perfil - Actualizar perfil (nombre y biografía)
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
      data: {
        resultados: 0,
        tests_completados: 0,
        seguidores: 0,
        seguidos: 0
      }
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