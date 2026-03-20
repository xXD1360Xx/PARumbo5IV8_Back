import { pool } from '../configuracion/basedeDatos.js';

// Obtener configuración de notificaciones
export const obtenerConfigNotificaciones = async (usuarioId) => {
  const query = `SELECT "notificationSettings" FROM "User" WHERE id = $1;`;
  const result = await pool.query(query, [usuarioId]);
  return result.rows[0]?.notificationSettings || {};
};

// Actualizar configuración (solo los campos que lleguen)
export const actualizarConfigNotificaciones = async (usuarioId, nuevosSettings) => {
  // Obtener configuración actual
  const actual = await obtenerConfigNotificaciones(usuarioId);
  const merged = { ...actual, ...nuevosSettings };
  
  const query = `
    UPDATE "User"
    SET "notificationSettings" = $1::jsonb
    WHERE id = $2
    RETURNING "notificationSettings";
  `;
  const result = await pool.query(query, [JSON.stringify(merged), usuarioId]);
  return result.rows[0].notificationSettings;
};

// Obtener seguidores de un usuario (para notificaciones masivas)
export const obtenerSeguidores = async (usuarioId) => {
  const query = `
    SELECT u.id, u.email, u."fullName" as nombre, u."notificationSettings"
    FROM "Follow" f
    JOIN "User" u ON f."followerId" = u.id
    WHERE f."followingId" = $1;
  `;
  const result = await pool.query(query, [usuarioId]);
  return result.rows;
};

// Obtener datos básicos de un usuario por ID
export const obtenerUsuarioPorId = async (usuarioId) => {
  const query = `
    SELECT id, "fullName" as nombre, email, "notificationSettings"
    FROM "User"
    WHERE id = $1;
  `;
  const result = await pool.query(query, [usuarioId]);
  return result.rows[0];
};