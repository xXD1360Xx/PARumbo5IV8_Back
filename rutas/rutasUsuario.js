import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { 
  obtenerPerfilUsuario,
  actualizarPerfilUsuario,
} from '../controladores/usuarioControlador.js';

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
    
    if (!usuarioId) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario es requerido'
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
    const { nombreCompleto, bio, avatarUrl, bannerUrl, configuraciones } = req.body;
    
    const datosActualizacion = {
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

// GET /usuario/dashboard - Obtener datos para el dashboard
router.get('/dashboard', autenticarUsuario, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    
    // Consultas para el dashboard
    const consultas = {
      testsCompletados: `
        SELECT COUNT(*) as total 
        FROM resultados_test 
        WHERE usuario_id = $1
      `,
      promedioGeneral: `
        SELECT AVG(puntuacion) as promedio 
        FROM resultados_test 
        WHERE usuario_id = $1
      `,
      ultimoTest: `
        SELECT t.nombre, r.puntuacion, r.fecha_realizacion
        FROM resultados_test r
        JOIN tests_vocacionales t ON r.test_id = t.id
        WHERE r.usuario_id = $1
        ORDER BY r.fecha_realizacion DESC
        LIMIT 1
      `
    };

    const { pool } = await import('../configuracion/baseDeDatos.js');
    
    const [testsCompletados, promedioGeneral, ultimoTest] = await Promise.all([
      pool.query(consultas.testsCompletados, [usuarioId]),
      pool.query(consultas.promedioGeneral, [usuarioId]),
      pool.query(consultas.ultimoTest, [usuarioId])
    ]);

    const dashboardData = {
      testsCompletados: parseInt(testsCompletados.rows[0].total),
      promedioGeneral: parseFloat(promedioGeneral.rows[0].promedio) || 0,
      ultimoTest: ultimoTest.rows[0] || null
    };

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

export default router;