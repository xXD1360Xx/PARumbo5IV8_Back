import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerPerfilUsuario,
  actualizarPerfilUsuario,
  obtenerDatosDashboard,           // ✅ Nueva función importada
  obtenerConfiguracionUsuario,     // ✅ Si la necesitas
  buscarUsuarios,                  // ✅ Para funcionalidad de búsqueda
  verificarUsuarioExiste           // ✅ Para validaciones
} from '../controladores/usuarioControlador.js';
// ⚠️ ELIMINADO: import dinámico de pool en la ruta

const router = express.Router();

// GET /usuario/perfil - Obtener perfil del usuario autenticado
router.get('/perfil', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const perfil = await obtenerPerfilUsuario(usuarioId);
    
    if (!perfil) {
      return res.status(404).json({
        exito: false,
        error: 'Perfil de usuario no encontrado'
      });
    }

    res.json({ 
      exito: true, 
      datos: perfil,
      mensaje: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el perfil del usuario' 
    });
  }
});

// GET /usuario/perfil/:usuarioId - Obtener perfil de otro usuario (público)
router.get('/perfil/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const perfil = await obtenerPerfilUsuario(usuarioId, true); // true = perfil público
    
    if (!perfil) {
      return res.status(404).json({
        exito: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({ 
      exito: true, 
      datos: perfil,
      mensaje: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener perfil público:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el perfil del usuario' 
    });
  }
});

// PUT /usuario/perfil - Actualizar perfil del usuario
router.put('/perfil', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { nombre, biografia, foto_perfil, portada, nombreCompleto, bio, avatarUrl, bannerUrl, configuraciones } = req.body;
    
    const datosActualizacion = {
      nombre,
      biografia,
      foto_perfil,
      portada,
      nombreCompleto,
      bio,
      avatarUrl,
      bannerUrl,
      configuraciones
    };

    const perfilActualizado = await actualizarPerfilUsuario(usuarioId, datosActualizacion);
    
    res.json({ 
      exito: true, 
      datos: perfilActualizado,
      mensaje: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al actualizar el perfil' 
    });
  }
});

// GET /usuario/dashboard - Obtener datos para el dashboard (CORREGIDO)
router.get('/dashboard', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    
    const dashboardData = await obtenerDatosDashboard(usuarioId);  // ✅ Usa función del controlador
    
    res.json({ 
      exito: true, 
      datos: dashboardData,
      mensaje: 'Datos del dashboard obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener datos del dashboard' 
    });
  }
});

// GET /usuario/configuracion - Obtener configuración del usuario
router.get('/configuracion', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const configuracion = await obtenerConfiguracionUsuario(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: configuracion,
      mensaje: 'Configuración obtenida exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener configuración' 
    });
  }
});

// GET /usuario/buscar - Buscar usuarios
router.get('/buscar', autenticarUsuario, async (req, res) => {
  try {
    const { q, limite = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        exito: false,
        error: 'Término de búsqueda demasiado corto (mínimo 2 caracteres)'
      });
    }

    const resultados = await buscarUsuarios(q, parseInt(limite));
    
    res.json({ 
      exito: true, 
      datos: resultados,
      mensaje: 'Búsqueda completada exitosamente',
      total: resultados.length
    });
  } catch (error) {
    console.error('Error en búsqueda de usuarios:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al buscar usuarios' 
    });
  }
});

// GET /usuario/verificar/:usuarioId - Verificar si un usuario existe
router.get('/verificar/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const existe = await verificarUsuarioExiste(usuarioId);
    
    res.json({ 
      exito: true, 
      datos: { existe },
      mensaje: existe ? 'Usuario encontrado' : 'Usuario no encontrado'
    });
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al verificar usuario' 
    });
  }
});

export default router;