import {
  obtenerNotificacionesPorUsuario,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion
} from '../modelos/notificacionModelo.js';

export const obtenerNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { pagina = 1, limite = 20 } = req.query;
    
    const resultado = await obtenerNotificacionesPorUsuario(usuarioId, parseInt(limite), parseInt(pagina));
    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerNotificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

export const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    
    const notificacion = await marcarComoLeida(id, usuarioId);
    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json(notificacion);
  } catch (error) {
    console.error('Error en marcarLeida:', error);
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
};

export const marcarTodasLeidas = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const count = await marcarTodasComoLeidas(usuarioId);
    res.json({ mensaje: `Se marcaron ${count} notificaciones como leídas` });
  } catch (error) {
    console.error('Error en marcarTodasLeidas:', error);
    res.status(500).json({ error: 'Error al marcar todas como leídas' });
  }
};

export const eliminarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    
    const notificacion = await eliminarNotificacion(id, usuarioId);
    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json({ mensaje: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error en eliminarNotificacion:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
};