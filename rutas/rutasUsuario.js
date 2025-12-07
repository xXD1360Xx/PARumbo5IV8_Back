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

/**
 * Cambiar contraseña del usuario
 */
export const cambiarContrasenaUsuario = async (usuarioId, datos) => {
  try {
    console.log('🔐 [CONTROLADOR] Cambiando contraseña para usuario ID:', usuarioId);
    
    const { 
      contrasena_actual, 
      nueva_contrasena,
      confirmar_contrasena 
    } = datos;
    
    // Validaciones
    if (!contrasena_actual || !nueva_contrasena) {
      throw new Error('Se requieren la contraseña actual y la nueva');
    }
    
    if (nueva_contrasena !== confirmar_contrasena) {
      throw new Error('Las contraseñas nuevas no coinciden');
    }
    
    if (nueva_contrasena.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }
    
    // 1. Verificar contraseña actual
    const usuarioQuery = `
      SELECT password FROM _users WHERE id = $1
    `;
    const usuarioResult = await pool.query(usuarioQuery, [usuarioId]);
    
    if (usuarioResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const contrasenaActualHash = usuarioResult.rows[0].password;
    
    // Comparar contraseña actual
    const bcrypt = require('bcrypt');
    const contrasenaValida = await bcrypt.compare(contrasena_actual, contrasenaActualHash);
    
    if (!contrasenaValida) {
      throw new Error('La contraseña actual es incorrecta');
    }
    
    // 2. Encriptar nueva contraseña
    const saltRounds = 10;
    const nuevaContrasenaHash = await bcrypt.hash(nueva_contrasena, saltRounds);
    
    // 3. Actualizar contraseña
    const updateQuery = `
      UPDATE _users 
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email
    `;
    
    const result = await pool.query(updateQuery, [nuevaContrasenaHash, usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Error al actualizar la contraseña');
    }
    
    console.log('✅ Contraseña cambiada para usuario ID:', usuarioId);
    
    return {
      exito: true,
      mensaje: 'Contraseña actualizada exitosamente'
    };
    
  } catch (error) {
    console.error('❌ Error en cambiarContrasenaUsuario:', error);
    throw error;
  }
};

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