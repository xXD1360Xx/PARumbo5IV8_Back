import { pool } from '../configuracion/basedeDatos.js';

// Crear una notificación individual
export const crearNotificacion = async (userId, type, title, body, link = null) => {
  const query = `
    INSERT INTO "Notification" (id, "userId", type, title, body, link, read, "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())
    RETURNING *;
  `;
  const result = await pool.query(query, [userId, type, title, body, link]);
  return result.rows[0];
};

// Crear múltiples notificaciones (batch insert)
export const crearNotificacionesMasivas = async (notificacionesArray) => {
  if (!notificacionesArray.length) return [];
  
  let values = [];
  let placeholders = [];
  let index = 1;
  
  notificacionesArray.forEach((notif) => {
    placeholders.push(`(gen_random_uuid(), $${index}, $${index+1}, $${index+2}, $${index+3}, $${index+4}, false, NOW())`);
    values.push(
      notif.userId,
      notif.type,
      notif.title,
      notif.body,
      notif.link || null
    );
    index += 5;
  });
  
  const query = `
    INSERT INTO "Notification" (id, "userId", type, title, body, link, read, "createdAt")
    VALUES ${placeholders.join(', ')}
    RETURNING *;
  `;
  
  const result = await pool.query(query, values);
  return result.rows;
};

// Obtener notificaciones de un usuario con paginación
export const obtenerNotificacionesPorUsuario = async (usuarioId, limite = 20, pagina = 1) => {
  const offset = (pagina - 1) * limite;
  const query = `
    SELECT *
    FROM "Notification"
    WHERE "userId" = $1
    ORDER BY read ASC, "createdAt" DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await pool.query(query, [usuarioId, limite, offset]);
  
  const countQuery = `SELECT COUNT(*) FROM "Notification" WHERE "userId" = $1;`;
  const countResult = await pool.query(countQuery, [usuarioId]);
  
  return {
    notificaciones: result.rows,
    total: parseInt(countResult.rows[0].count),
    pagina,
    totalPaginas: Math.ceil(countResult.rows[0].count / limite)
  };
};

// Marcar una notificación como leída
export const marcarComoLeida = async (notificacionId, usuarioId) => {
  const query = `
    UPDATE "Notification"
    SET read = true
    WHERE id = $1 AND "userId" = $2
    RETURNING *;
  `;
  const result = await pool.query(query, [notificacionId, usuarioId]);
  return result.rows[0];
};

// Marcar todas como leídas
export const marcarTodasComoLeidas = async (usuarioId) => {
  const query = `
    UPDATE "Notification"
    SET read = true
    WHERE "userId" = $1 AND read = false
    RETURNING *;
  `;
  const result = await pool.query(query, [usuarioId]);
  return result.rowCount;
};

// Eliminar una notificación
export const eliminarNotificacion = async (notificacionId, usuarioId) => {
  const query = `DELETE FROM "Notification" WHERE id = $1 AND "userId" = $2 RETURNING *;`;
  const result = await pool.query(query, [notificacionId, usuarioId]);
  return result.rows[0];
};