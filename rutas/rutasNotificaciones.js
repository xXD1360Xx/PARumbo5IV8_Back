import express from 'express';
import {
  obtenerNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion
} from '../controladores/notificacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// GET /api/notificaciones - Obtener notificaciones del usuario
router.get('/', obtenerNotificaciones);

// PUT /api/notificaciones/:id/leer - Marcar una notificación como leída
router.put('/:id/leer', marcarLeida);

// PUT /api/notificaciones/leer-todas - Marcar todas como leídas
router.put('/leer-todas', marcarTodasLeidas);

// DELETE /api/notificaciones/:id - Eliminar una notificación
router.delete('/:id', eliminarNotificacion);

export default router;