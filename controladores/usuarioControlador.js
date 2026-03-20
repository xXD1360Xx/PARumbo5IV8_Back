import { pool } from '../configuracion/basedeDatos.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as cloudinaryModule from '../configuracion/cloudinary.js';

console.log('🔄 IMPORTANDO MÓDULO CLOUDINARY...');
const { subirACloudinary, eliminarDeCloudinary, extraerPublicId } = cloudinaryModule;

console.log('✅ Módulo Cloudinary importado:', {
  funciones: Object.keys(cloudinaryModule)
});

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Verifica si un usuario puede ver el perfil de otro (por privacidad)
 */
const puedeVerPerfil = async (usuarioId, usuarioActualId) => {
  if (!usuarioActualId || usuarioActualId === usuarioId) return true;
  
  const perfilQuery = `SELECT "isPrivate" FROM "User" WHERE id = $1`;
  const perfilResult = await pool.query(perfilQuery, [usuarioId]);
  if (perfilResult.rows.length === 0) return false;
  
  if (!perfilResult.rows[0].isPrivate) return true;
  
  const sigueQuery = `
    SELECT 1 FROM "Follow"
    WHERE "followerId" = $1 AND "followingId" = $2
  `;
  const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
  return sigueResult.rows.length > 0;
};

// ==================== FUNCIONES DE BÚSQUEDA Y VERIFICACIÓN ====================

/**
 * Verificar disponibilidad de username y sugerir alternativos
 */
export const verificarDisponibilidadUsername = async (username) => {
  try {
    console.log('🔍 [CONTROLADOR] Verificando username:', username);

    if (!username || username.trim().length < 3) {
      return {
        disponible: false,
        mensaje: 'El nombre de usuario debe tener al menos 3 caracteres'
      };
    }

    const usernameLimpio = username.toLowerCase().trim();

    const query = `
      SELECT id, username FROM "User"
      WHERE LOWER(username) = $1
    `;
    const result = await pool.query(query, [usernameLimpio]);
    const existe = result.rows.length > 0;

    if (!existe) {
      return {
        disponible: true,
        mensaje: 'Nombre de usuario disponible'
      };
    }

    // Generar sugerencias
    const sugerencias = [];
    const base = usernameLimpio.replace(/[^a-z0-9]/g, '');

    if (base.length > 0) {
      for (let i = 1; i <= 5; i++) {
        sugerencias.push(`${base}${i}`);
        sugerencias.push(`${base}_${i}`);
      }
      sugerencias.push(`${base}${new Date().getFullYear().toString().slice(-2)}`);
      sugerencias.push(`${base}_real`);
    }

    const sugerenciasUnicas = [...new Set(sugerencias)].slice(0, 5);

    return {
      disponible: false,
      mensaje: 'Nombre de usuario no disponible',
      sugerencias: sugerenciasUnicas
    };

  } catch (error) {
    console.error('❌ Error en verificarDisponibilidadUsername:', error);
    throw error;
  }
};

/**
 * Buscar usuarios por término (con manejo de privacidad)
 */
export const buscarUsuarios = async (terminoBusqueda, usuarioActualId = null, pagina = 1, limite = 20) => {
  try {
    console.log('🔍 [CONTROLADOR] Buscando usuarios:', terminoBusqueda);

    if (!terminoBusqueda || terminoBusqueda.trim().length < 2) {
      return [];
    }

    const offset = (pagina - 1) * limite;
    const termino = `%${terminoBusqueda.trim().toLowerCase()}%`;

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u.email,
        u.role as rol,
        u.bio as biografia,
        u."avatarUrl" as foto_perfil,
        u."bannerUrl" as portada,
        u."isPrivate" as privacidad,
        COUNT(DISTINCT f1."followerId") as seguidores,
        COUNT(DISTINCT f2."followingId") as seguidos,
        u."createdAt" as fecha_creacion,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM "Follow"
            WHERE "followerId" = $2 AND "followingId" = u.id
          ) as lo_sigo,
          u.id = $2 as es_yo
        ` : 'false as lo_sigo, false as es_yo'}
      FROM "User" u
      LEFT JOIN "Follow" f1 ON u.id = f1."followingId"
      LEFT JOIN "Follow" f2 ON u.id = f2."followerId"
      WHERE
        (LOWER(u.username) LIKE $1 OR
         LOWER(u."fullName") LIKE $1 OR
         LOWER(u.email) LIKE $1)
        ${usuarioActualId ? 'AND u.id != $2' : ''}
      GROUP BY u.id
      ORDER BY
        CASE
          WHEN LOWER(u.username) LIKE $1 THEN 1
          WHEN LOWER(u."fullName") LIKE $1 THEN 2
          WHEN LOWER(u.email) LIKE $1 THEN 3
          ELSE 4
        END,
        u.username
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;

    const params = usuarioActualId
      ? [termino, usuarioActualId, limite, offset]
      : [termino, limite, offset];

    const result = await pool.query(query, params);

    // Filtrar según privacidad
    const usuariosProcesados = result.rows.map(usuario => {
      if (usuario.privacidad && usuarioActualId && !usuario.es_yo && !usuario.lo_sigo) {
        return {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          nombre: 'Usuario privado',
          rol: 'usuario',
          foto_perfil: null,
          privacidad: true,
          seguidores: 0,
          seguidos: 0,
          es_privado: true,
          lo_sigo: usuario.lo_sigo,
          es_yo: usuario.es_yo
        };
      }
      return usuario;
    });

    console.log(`✅ Encontrados ${usuariosProcesados.length} usuarios`);
    return usuariosProcesados;

  } catch (error) {
    console.error('❌ Error en buscarUsuarios:', error);
    throw error;
  }
};

/**
 * Obtener perfil público de otro usuario con manejo de privacidad
 */
export const obtenerPerfilUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🔍 [CONTROLADOR] Obteniendo perfil ID:', usuarioId);

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u.email,
        u.role as rol,
        u.bio as biografia,
        u."avatarUrl" as foto_perfil,
        u."bannerUrl" as portada,
        u."isPrivate" as privacidad,
        COUNT(DISTINCT f1."followerId") as seguidores,
        COUNT(DISTINCT f2."followingId") as seguidos,
        u."createdAt" as fecha_creacion
      FROM "User" u
      LEFT JOIN "Follow" f1 ON u.id = f1."followingId"
      LEFT JOIN "Follow" f2 ON u.id = f2."followerId"
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await pool.query(query, [usuarioId]);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const usuario = result.rows[0];

    // Verificar permisos si es privado
    if (usuario.privacidad && usuarioActualId && usuarioActualId !== usuario.id) {
      const sigueQuery = `
        SELECT 1 FROM "Follow"
        WHERE "followerId" = $1 AND "followingId" = $2
      `;
      const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);

      if (sigueResult.rows.length === 0) {
        return {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          nombre: 'Usuario privado',
          rol: 'usuario',
          foto_perfil: null,
          privacidad: true,
          seguidores: 0,
          seguidos: 0,
          es_privado: true,
          lo_sigo: false,
          es_yo: false
        };
      }
    }

    // Verificar si el usuario actual sigue a este usuario
    let loSigo = false;
    if (usuarioActualId) {
      const sigueQuery = `
        SELECT 1 FROM "Follow"
        WHERE "followerId" = $1 AND "followingId" = $2
      `;
      const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
      loSigo = sigueResult.rows.length > 0;
    }

    return {
      ...usuario,
      lo_sigo: loSigo,
      es_yo: usuarioActualId === usuario.id,
      es_privado: false
    };

  } catch (error) {
    console.error('❌ Error en obtenerPerfilUsuario:', error);
    throw error;
  }
};

// ==================== FUNCIONES DE SEGUIMIENTO ====================

export const seguirUsuario = async (followerId, followingId) => {
  try {
    console.log('👥 [CONTROLADOR] Siguiendo usuario:', { followerId, followingId });

    if (followerId === followingId) {
      throw new Error('No puedes seguirte a ti mismo');
    }

    const usuarioExisteQuery = `SELECT id, "isPrivate" FROM "User" WHERE id = $1`;
    const usuarioExiste = await pool.query(usuarioExisteQuery, [followingId]);

    if (usuarioExiste.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const yaSigueQuery = `
      SELECT 1 FROM "Follow"
      WHERE "followerId" = $1 AND "followingId" = $2
    `;
    const yaSigue = await pool.query(yaSigueQuery, [followerId, followingId]);

    if (yaSigue.rows.length > 0) {
      throw new Error('Ya sigues a este usuario');
    }

    await pool.query('BEGIN');

    try {
      // Insertar en Follow
      await pool.query(
        `INSERT INTO "Follow" (id, "followerId", "followingId", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [followerId, followingId]
      );

      // Nota: La tabla User no tiene contadores followers_count y following_count.
      // Si se desean mantener, habría que agregarlos o calcularlos con subconsultas.
      // Por ahora no se actualizan contadores.

      await pool.query('COMMIT');

      console.log('✅ Usuario seguido exitosamente');
      return { exito: true, mensaje: 'Ahora sigues a este usuario' };

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error en seguirUsuario:', error);
    throw error;
  }
};

export const dejarDeSeguirUsuario = async (followerId, followingId) => {
  try {
    console.log('👥 [CONTROLADOR] Dejando de seguir usuario:', { followerId, followingId });

    const existeRelacionQuery = `
      SELECT id FROM "Follow"
      WHERE "followerId" = $1 AND "followingId" = $2
    `;
    const existeRelacion = await pool.query(existeRelacionQuery, [followerId, followingId]);

    if (existeRelacion.rows.length === 0) {
      throw new Error('No sigues a este usuario');
    }

    await pool.query('BEGIN');

    try {
      await pool.query(
        `DELETE FROM "Follow"
         WHERE "followerId" = $1 AND "followingId" = $2`,
        [followerId, followingId]
      );

      await pool.query('COMMIT');

      console.log('✅ Dejaste de seguir al usuario');
      return { exito: true, mensaje: 'Dejaste de seguir a este usuario' };

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error en dejarDeSeguirUsuario:', error);
    throw error;
  }
};

export const obtenerSeguidores = async (usuarioId, usuarioActualId = null, pagina = 1, limite = 20) => {
  try {
    console.log('👥 [CONTROLADOR] Obteniendo seguidores para usuario ID:', usuarioId);

    const offset = (pagina - 1) * limite;

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u."avatarUrl" as foto_perfil,
        u.bio as biografia,
        u.role as rol,
        u."isPrivate" as privacidad,
        f."createdAt" as fecha_seguimiento,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM "Follow" f2
            WHERE f2."followerId" = $1 AND f2."followingId" = u.id
          ) as yo_lo_sigo,
          u.id = $1 as es_yo
        ` : 'false as yo_lo_sigo, false as es_yo'}
      FROM "Follow" f
      JOIN "User" u ON f."followerId" = u.id
      WHERE f."followingId" = ${usuarioActualId ? '$2' : '$1'}
      ORDER BY f."createdAt" DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;

    const params = usuarioActualId
      ? [usuarioActualId, usuarioId, limite, offset]
      : [usuarioId, limite, offset];

    const result = await pool.query(query, params);

    const seguidoresProcesados = result.rows.map(seguidor => {
      if (seguidor.privacidad && usuarioActualId && !seguidor.es_yo && !seguidor.yo_lo_sigo) {
        return {
          id: seguidor.id,
          nombre_usuario: seguidor.nombre_usuario,
          nombre: 'Usuario privado',
          rol: 'usuario',
          foto_perfil: null,
          privacidad: true,
          es_privado: true,
          yo_lo_sigo: seguidor.yo_lo_sigo,
          es_yo: seguidor.es_yo
        };
      }
      return seguidor;
    });

    return seguidoresProcesados;

  } catch (error) {
    console.error('❌ Error en obtenerSeguidores:', error);
    throw error;
  }
};

export const obtenerSeguidos = async (usuarioId, usuarioActualId = null, pagina = 1, limite = 20) => {
  try {
    console.log('👥 [CONTROLADOR] Obteniendo seguidos para usuario ID:', usuarioId);

    const offset = (pagina - 1) * limite;

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u."avatarUrl" as foto_perfil,
        u.bio as biografia,
        u.role as rol,
        u."isPrivate" as privacidad,
        f."createdAt" as fecha_seguimiento,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM "Follow" f2
            WHERE f2."followerId" = u.id AND f2."followingId" = $1
          ) as me_sigue,
          u.id = $1 as es_yo
        ` : 'false as me_sigue, false as es_yo'}
      FROM "Follow" f
      JOIN "User" u ON f."followingId" = u.id
      WHERE f."followerId" = ${usuarioActualId ? '$2' : '$1'}
      ORDER BY f."createdAt" DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;

    const params = usuarioActualId
      ? [usuarioActualId, usuarioId, limite, offset]
      : [usuarioId, limite, offset];

    const result = await pool.query(query, params);

    const seguidosProcesados = result.rows.map(seguido => {
      if (seguido.privacidad && usuarioActualId && !seguido.es_yo && !seguido.me_sigue) {
        return {
          id: seguido.id,
          nombre_usuario: seguido.nombre_usuario,
          nombre: 'Usuario privado',
          rol: 'usuario',
          foto_perfil: null,
          privacidad: true,
          es_privado: true,
          me_sigue: seguido.me_sigue,
          es_yo: seguido.es_yo
        };
      }
      return seguido;
    });

    return seguidosProcesados;

  } catch (error) {
    console.error('❌ Error en obtenerSeguidos:', error);
    throw error;
  }
};

export const verificarSiSigue = async (followerId, followingId) => {
  try {
    const query = `
      SELECT 1 FROM "Follow"
      WHERE "followerId" = $1 AND "followingId" = $2
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Error en verificarSiSigue:', error);
    throw error;
  }
};

// ==================== FUNCIONES DE PERFIL ====================

export const obtenerMiPerfil = async (usuarioId) => {
  try {
    console.log('🔍 [CONTROLADOR] Obteniendo perfil para usuario ID:', usuarioId);

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u.email,
        u.role as rol,
        u.bio as biografia,
        u."avatarUrl" as foto_perfil,
        u."bannerUrl" as portada,
        u."isPrivate" as privacidad,
        COUNT(DISTINCT f1."followerId") as seguidores,
        COUNT(DISTINCT f2."followingId") as seguidos,
        u."createdAt" as fecha_creacion,
        u."updatedAt" as updated_at
      FROM "User" u
      LEFT JOIN "Follow" f1 ON u.id = f1."followingId"
      LEFT JOIN "Follow" f2 ON u.id = f2."followerId"
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await pool.query(query, [usuarioId]);

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado ID:', usuarioId);
      return null;
    }

    const usuario = result.rows[0];
    console.log('✅ Perfil obtenido para:', usuario.email);
    return usuario;

  } catch (error) {
    console.error('❌ Error en obtenerMiPerfil:', error);
    throw error;
  }
};

export const actualizarPerfilUsuario = async (usuarioId, datosActualizacion) => {
  try {
    console.log('✏️ [CONTROLADOR] Actualizando perfil para usuario ID:', usuarioId);
    console.log('📝 Datos de actualización:', datosActualizacion);

    const {
      full_name,
      username,
      email,
      password,
      role,
      is_private,
      bio,
      avatar_url,
      banner_url
    } = datosActualizacion;

    // Verificar disponibilidad de username si se está cambiando
    if (username) {
      const verificarUsuarioQuery = `
        SELECT id FROM "User"
        WHERE LOWER(username) = LOWER($1) AND id != $2
      `;
      const usuarioExistente = await pool.query(verificarUsuarioQuery, [username, usuarioId]);
      if (usuarioExistente.rows.length > 0) {
        throw new Error('El nombre de usuario ya está en uso');
      }
    }

    // Verificar si el nuevo email ya existe
    if (email) {
      const verificarEmailQuery = `
        SELECT id FROM "User"
        WHERE LOWER(email) = LOWER($1) AND id != $2
      `;
      const emailExistente = await pool.query(verificarEmailQuery, [email, usuarioId]);
      if (emailExistente.rows.length > 0) {
        throw new Error('El correo electrónico ya está en uso');
      }
    }

    // Validar rol si se está actualizando
    if (role) {
      const rolesPermitidos = ['explorando', 'estudiante', 'egresado', 'profesor', 'docente', 'admin'];
      if (!rolesPermitidos.includes(role.toLowerCase())) {
        throw new Error(`Rol inválido. Los roles válidos son: ${rolesPermitidos.join(', ')}`);
      }
    }

    // Preparar los valores para la actualización
    const valoresActualizacion = [];
    const partesQuery = [];
    let contador = 1;

    if (full_name !== undefined) {
      partesQuery.push(`"fullName" = $${contador}`);
      valoresActualizacion.push(full_name);
      contador++;
    }
    if (username !== undefined) {
      partesQuery.push(`username = $${contador}`);
      valoresActualizacion.push(username);
      contador++;
    }
    if (email !== undefined) {
      partesQuery.push(`email = $${contador}`);
      valoresActualizacion.push(email);
      contador++;
    }
    if (password !== undefined && password.trim() !== '') {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      partesQuery.push(`password = $${contador}`);
      valoresActualizacion.push(hash);
      contador++;
    }
    if (role !== undefined) {
      partesQuery.push(`role = $${contador}`);
      valoresActualizacion.push(role.toLowerCase());
      contador++;
    }
    if (is_private !== undefined) {
      partesQuery.push(`"isPrivate" = $${contador}`);
      valoresActualizacion.push(Boolean(is_private));
      contador++;
    }
    if (bio !== undefined) {
      partesQuery.push(`bio = $${contador}`);
      valoresActualizacion.push(bio);
      contador++;
    }
    if (avatar_url !== undefined) {
      partesQuery.push(`"avatarUrl" = $${contador}`);
      valoresActualizacion.push(avatar_url);
      contador++;
    }
    if (banner_url !== undefined) {
      partesQuery.push(`"bannerUrl" = $${contador}`);
      valoresActualizacion.push(banner_url);
      contador++;
    }

    partesQuery.push(`"updatedAt" = NOW()`);

    if (partesQuery.length === 1) {
      throw new Error('No se proporcionaron datos para actualizar');
    }

    valoresActualizacion.push(usuarioId);

    const query = `
      UPDATE "User"
      SET ${partesQuery.join(', ')}
      WHERE id = $${contador}
      RETURNING
        id,
        username,
        "fullName" as full_name,
        email,
        role,
        bio,
        "avatarUrl" as avatar_url,
        "bannerUrl" as banner_url,
        "isPrivate" as is_private,
        "createdAt" as created_at,
        "updatedAt" as updated_at
    `;

    console.log('🔍 Query ejecutada:', query);
    console.log('📊 Valores:', valoresActualizacion);

    const result = await pool.query(query, valoresActualizacion);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const usuarioActualizado = result.rows[0];
    console.log('✅ Perfil actualizado para:', usuarioActualizado.email);

    return {
      id: usuarioActualizado.id,
      nombre_usuario: usuarioActualizado.username,
      nombre: usuarioActualizado.full_name,
      email: usuarioActualizado.email,
      rol: usuarioActualizado.role,
      biografia: usuarioActualizado.bio,
      foto_perfil: usuarioActualizado.avatar_url,
      portada: usuarioActualizado.banner_url,
      privacidad: usuarioActualizado.is_private,
      // Los contadores no se actualizan aquí, se obtendrán por separado si es necesario
      fecha_creacion: usuarioActualizado.created_at,
      fecha_actualizacion: usuarioActualizado.updated_at
    };

  } catch (error) {
    console.error('❌ Error en actualizarPerfilUsuario:', error);
    if (error.code === '23505') {
      if (error.constraint?.includes('username')) throw new Error('El nombre de usuario ya está en uso');
      if (error.constraint?.includes('email')) throw new Error('El correo electrónico ya está en uso');
    }
    throw error;
  }
};

// ==================== FUNCIONES DE BÚSQUEDA POR ROL Y FILTROS ====================

export const buscarUsuariosPorRol = async (rol, usuarioActualId = null, pagina = 1, limite = 50) => {
  try {
    console.log('👥 [CONTROLADOR] Buscando usuarios por rol:', rol);

    const offset = (pagina - 1) * limite;

    const query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u.email,
        u.role as rol,
        u.bio as biografia,
        u."avatarUrl" as foto_perfil,
        u."bannerUrl" as portada,
        u."isPrivate" as privacidad,
        COUNT(DISTINCT f1."followerId") as seguidores,
        COUNT(DISTINCT f2."followingId") as seguidos,
        u."createdAt" as fecha_creacion,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM "Follow"
            WHERE "followerId" = $2 AND "followingId" = u.id
          ) as lo_sigo,
          u.id = $2 as es_yo
        ` : 'false as lo_sigo, false as es_yo'}
      FROM "User" u
      LEFT JOIN "Follow" f1 ON u.id = f1."followingId"
      LEFT JOIN "Follow" f2 ON u.id = f2."followerId"
      WHERE u.role = $1
      GROUP BY u.id
      ORDER BY seguidores DESC, u."createdAt" DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;

    const params = usuarioActualId
      ? [rol, usuarioActualId, limite, offset]
      : [rol, limite, offset];

    const result = await pool.query(query, params);

    const usuariosProcesados = result.rows.map(usuario => {
      if (usuario.privacidad && usuarioActualId && !usuario.es_yo && !usuario.lo_sigo) {
        return {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          nombre: 'Usuario privado',
          rol: usuario.rol,
          foto_perfil: null,
          privacidad: true,
          seguidores: 0,
          seguidos: 0,
          es_privado: true,
          lo_sigo: usuario.lo_sigo,
          es_yo: usuario.es_yo
        };
      }
      return usuario;
    });

    console.log(`✅ Encontrados ${usuariosProcesados.length} usuarios con rol ${rol}`);
    return usuariosProcesados;

  } catch (error) {
    console.error('❌ Error en buscarUsuariosPorRol:', error);
    throw error;
  }
};

export const buscarUsuariosConFiltros = async (filtros, usuarioActualId = null, pagina = 1, limite = 50) => {
  try {
    console.log('🔍 [CONTROLADOR] Buscando usuarios con filtros:', filtros);

    const offset = (pagina - 1) * limite;
    const { rol, carrera, perfilVocacional, areaConocimiento } = filtros;

    let query = `
      SELECT
        u.id,
        u.username as nombre_usuario,
        u."fullName" as nombre,
        u.email,
        u.role as rol,
        u.bio as biografia,
        u."avatarUrl" as foto_perfil,
        u."bannerUrl" as portada,
        u."isPrivate" as privacidad,
        COUNT(DISTINCT f1."followerId") as seguidores,
        COUNT(DISTINCT f2."followingId") as seguidos,
        u."createdAt" as fecha_creacion,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM "Follow"
            WHERE "followerId" = $1 AND "followingId" = u.id
          ) as lo_sigo,
          u.id = $1 as es_yo
        ` : 'false as lo_sigo, false as es_yo'}
      FROM "User" u
      LEFT JOIN "Follow" f1 ON u.id = f1."followingId"
      LEFT JOIN "Follow" f2 ON u.id = f2."followerId"
      WHERE 1=1
    `;

    const params = usuarioActualId ? [usuarioActualId] : [];
    let paramIndex = usuarioActualId ? 2 : 1;

    // Filtrar por rol
    if (rol && rol !== 'todos') {
      const mapeoRoles = {
        'explorando': ['explorando'],
        'estudiante': ['estudiante'],
        'egresado': ['egresado'],
        'docente': ['docente', 'profesor'],
        'admin': ['admin']
      };
      const rolesABuscar = mapeoRoles[rol] || [rol];
      const condicionesRol = rolesABuscar.map((_, i) => `u.role = $${paramIndex + i}`).join(' OR ');
      query += ` AND (${condicionesRol})`;
      params.push(...rolesABuscar);
      paramIndex += rolesABuscar.length;
    }

    // Otros filtros (carrera, perfilVocacional, etc.) se pueden agregar según necesidad
    // Por ahora no hay columnas de carrera en User; se podrían agregar luego.

    query += ` GROUP BY u.id ORDER BY seguidores DESC, u."createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limite, offset);

    console.log('🔍 Query final:', query);
    console.log('📊 Parámetros:', params);

    const result = await pool.query(query, params);

    const usuariosProcesados = result.rows.map(usuario => {
      if (usuario.privacidad && usuarioActualId && !usuario.es_yo && !usuario.lo_sigo) {
        return {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          nombre: 'Usuario privado',
          rol: usuario.rol,
          foto_perfil: null,
          privacidad: true,
          seguidores: 0,
          seguidos: 0,
          es_privado: true,
          lo_sigo: usuario.lo_sigo,
          es_yo: usuario.es_yo
        };
      }
      return usuario;
    });

    console.log(`✅ Encontrados ${usuariosProcesados.length} usuarios con filtros`);
    return usuariosProcesados;

  } catch (error) {
    console.error('❌ Error en buscarUsuariosConFiltros:', error);
    throw error;
  }
};

// ==================== FUNCIONES DE ESTADÍSTICAS DE USUARIO ====================

export const obtenerEstadisticasUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📊 [CONTROLADOR] Obteniendo estadísticas para usuario ID:', usuarioId);

    const puedeVer = await puedeVerPerfil(usuarioId, usuarioActualId);

    if (!puedeVer) {
      return {
        resultados_tests: 0,
        resultados_vocacionales: 0,
        seguidores: 0,
        seguidos: 0,
        privacidad: true
      };
    }

    // Obtener conteo de seguidores y seguidos
    const countsQuery = `
      SELECT
        (SELECT COUNT(*) FROM "Follow" WHERE "followingId" = $1) as seguidores,
        (SELECT COUNT(*) FROM "Follow" WHERE "followerId" = $1) as seguidos
    `;
    const countsResult = await pool.query(countsQuery, [usuarioId]);

    // Obtener conteo de tests (desde KnowledgeTestResult)
    const testsQuery = `SELECT COUNT(*) as total FROM "KnowledgeTestResult" WHERE "userId" = $1`;
    const testsResult = await pool.query(testsQuery, [usuarioId]);

    // Obtener conteo de vocacional (desde VocalTestResult)
    const vocacionalQuery = `SELECT COUNT(*) as total FROM "VocalTestResult" WHERE "userId" = $1`;
    const vocacionalResult = await pool.query(vocacionalQuery, [usuarioId]);

    const estadisticas = {
      resultados_tests: parseInt(testsResult.rows[0]?.total || 0),
      resultados_vocacionales: parseInt(vocacionalResult.rows[0]?.total || 0),
      seguidores: parseInt(countsResult.rows[0]?.seguidores || 0),
      seguidos: parseInt(countsResult.rows[0]?.seguidos || 0),
      privacidad: false
    };

    console.log('📈 Estadísticas obtenidas:', estadisticas);
    return estadisticas;

  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasUsuario:', error);
    return {
      resultados_tests: 0,
      resultados_vocacionales: 0,
      seguidores: 0,
      seguidos: 0,
      privacidad: false
    };
  }
};

// ==================== FUNCIONES DE CLOUDINARY ====================

export const subirFotoPerfil = async (usuarioId, filePath) => {
  const inicio = Date.now();
  console.log(`🚀 [SUBIENDO PERFIL] Iniciando proceso...`);
  console.log(`   👤 Usuario ID: ${usuarioId}`);
  console.log(`   📁 Ruta archivo: ${filePath}`);

  try {
    // Verificar que el usuario existe
    const usuarioCheckQuery = `SELECT id, "avatarUrl" FROM "User" WHERE id = $1`;
    const usuarioCheckResult = await pool.query(usuarioCheckQuery, [usuarioId]);

    if (usuarioCheckResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const avatarActual = usuarioCheckResult.rows[0].avatarUrl;
    const defaultAvatar = 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';
    const esAvatarPorDefecto = avatarActual === defaultAvatar || !avatarActual;

    // Verificar archivo
    if (!fs || typeof fs.existsSync !== 'function') throw new Error('El módulo fs no está disponible');
    if (!fs.existsSync(filePath)) throw new Error(`Archivo temporal no encontrado: ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`✅ Archivo válido. Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Eliminar avatar anterior si no es por defecto
    if (avatarActual && !esAvatarPorDefecto && avatarActual.includes('cloudinary.com')) {
      const publicIdAnterior = extraerPublicId(avatarActual);
      if (publicIdAnterior) {
        try {
          await eliminarDeCloudinary(publicIdAnterior);
          console.log(`✅ Avatar anterior eliminado: ${publicIdAnterior}`);
        } catch (error) {
          console.warn(`⚠️ No se pudo eliminar avatar anterior: ${error.message}`);
        }
      }
    }

    // Subir a Cloudinary
    const cloudinaryResult = await subirACloudinary(filePath, 'avatar');

    // Actualizar BD
    const query = `
      UPDATE "User"
      SET "avatarUrl" = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING
        id,
        username as nombre_usuario,
        "fullName" as nombre,
        email,
        role as rol,
        bio as biografia,
        "avatarUrl" as foto_perfil,
        "bannerUrl" as portada,
        "isPrivate" as privacidad,
        "createdAt" as fecha_creacion
    `;
    const result = await pool.query(query, [cloudinaryResult.url, usuarioId]);

    if (result.rows.length === 0) throw new Error('Usuario no encontrado al actualizar');

    const usuarioActualizado = result.rows[0];

    console.log(`🎉 [PERFIL SUBIDO] Proceso completado`);
    return {
      exito: true,
      mensaje: 'Foto de perfil actualizada exitosamente',
      usuario: usuarioActualizado,
      url: cloudinaryResult.url,
      public_id: cloudinaryResult.public_id,
      metadata: {
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        size_kb: Math.round(cloudinaryResult.bytes / 1024),
        format: cloudinaryResult.format,
        tiempo_total_ms: Date.now() - inicio,
        reemplazo: esAvatarPorDefecto ? 'avatar_por_defecto' : 'avatar_personalizado'
      }
    };

  } catch (error) {
    console.error(`💥 [ERROR SUBIENDO PERFIL] ${error.message}`);
    if (fs && typeof fs.existsSync === 'function' && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 Archivo temporal limpiado: ${filePath}`);
    }
    throw new Error(`Error al subir foto de perfil: ${error.message}`);
  }
};

export const subirFotoPortada = async (usuarioId, filePath) => {
  const inicio = Date.now();
  console.log(`🚀 [SUBIENDO PORTADA] Iniciando proceso...`);
  console.log(`   👤 Usuario ID: ${usuarioId}`);
  console.log(`   📁 Ruta archivo: ${filePath}`);

  try {
    const usuarioCheckQuery = `SELECT id, "bannerUrl" FROM "User" WHERE id = $1`;
    const usuarioCheckResult = await pool.query(usuarioCheckQuery, [usuarioId]);

    if (usuarioCheckResult.rows.length === 0) throw new Error('Usuario no encontrado');

    const bannerActual = usuarioCheckResult.rows[0].bannerUrl;

    if (!fs || typeof fs.existsSync !== 'function') throw new Error('El módulo fs no está disponible');
    if (!fs.existsSync(filePath)) throw new Error(`Archivo temporal no encontrado: ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`✅ Archivo válido. Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    if (bannerActual && bannerActual.includes('cloudinary.com')) {
      const publicIdAnterior = extraerPublicId(bannerActual);
      if (publicIdAnterior) {
        try {
          await eliminarDeCloudinary(publicIdAnterior);
          console.log(`✅ Banner anterior eliminado: ${publicIdAnterior}`);
        } catch (error) {
          console.warn(`⚠️ No se pudo eliminar banner anterior: ${error.message}`);
        }
      }
    }

    const cloudinaryResult = await subirACloudinary(filePath, 'banner');

    const query = `
      UPDATE "User"
      SET "bannerUrl" = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING
        id,
        username as nombre_usuario,
        "fullName" as nombre,
        email,
        role as rol,
        bio as biografia,
        "avatarUrl" as foto_perfil,
        "bannerUrl" as portada,
        "isPrivate" as privacidad,
        "createdAt" as fecha_creacion
    `;
    const result = await pool.query(query, [cloudinaryResult.url, usuarioId]);

    if (result.rows.length === 0) throw new Error('Usuario no encontrado al actualizar');

    const usuarioActualizado = result.rows[0];

    console.log(`🎉 [PORTADA SUBIDA] Proceso completado`);
    return {
      exito: true,
      mensaje: 'Foto de portada actualizada exitosamente',
      usuario: usuarioActualizado,
      url: cloudinaryResult.url,
      public_id: cloudinaryResult.public_id,
      metadata: {
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        size_kb: Math.round(cloudinaryResult.bytes / 1024),
        format: cloudinaryResult.format,
        tiempo_total_ms: Date.now() - inicio
      }
    };

  } catch (error) {
    console.error(`💥 [ERROR SUBIENDO PORTADA] ${error.message}`);
    if (fs && typeof fs.existsSync === 'function' && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 Archivo temporal limpiado: ${filePath}`);
    }
    throw new Error(`Error al subir foto de portada: ${error.message}`);
  }
};

export const eliminarFotoPerfil = async (usuarioId) => {
  try {
    console.log('🗑️ [CLOUDINARY] Eliminando foto de perfil para usuario ID:', usuarioId);

    const querySelect = `SELECT "avatarUrl" FROM "User" WHERE id = $1`;
    const resultSelect = await pool.query(querySelect, [usuarioId]);

    if (resultSelect.rows.length === 0) throw new Error('Usuario no encontrado');

    const currentAvatar = resultSelect.rows[0].avatarUrl;
    const defaultAvatar = 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';

    if (!currentAvatar || currentAvatar === defaultAvatar) {
      throw new Error('No hay foto de perfil para eliminar');
    }

    const publicId = extraerPublicId(currentAvatar);
    if (publicId) {
      await eliminarDeCloudinary(publicId).catch(err => console.warn('⚠️ No se pudo eliminar de Cloudinary:', err.message));
    }

    const queryUpdate = `
      UPDATE "User"
      SET "avatarUrl" = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING
        id,
        username as nombre_usuario,
        "fullName" as nombre,
        email,
        role as rol,
        bio as biografia,
        "avatarUrl" as foto_perfil,
        "bannerUrl" as portada,
        "isPrivate" as privacidad,
        "createdAt" as fecha_creacion
    `;
    const resultUpdate = await pool.query(queryUpdate, [defaultAvatar, usuarioId]);

    return {
      exito: true,
      usuario: resultUpdate.rows[0],
      mensaje: 'Foto de perfil eliminada exitosamente'
    };

  } catch (error) {
    console.error('❌ Error en eliminarFotoPerfil:', error);
    throw new Error(`Error al eliminar foto de perfil: ${error.message}`);
  }
};

export const eliminarFotoPortada = async (usuarioId) => {
  try {
    console.log('🗑️ [CLOUDINARY] Eliminando foto de portada para usuario ID:', usuarioId);

    const querySelect = `SELECT "bannerUrl" FROM "User" WHERE id = $1`;
    const resultSelect = await pool.query(querySelect, [usuarioId]);

    if (resultSelect.rows.length === 0) throw new Error('Usuario no encontrado');

    const currentBanner = resultSelect.rows[0].bannerUrl;
    if (!currentBanner) throw new Error('No hay foto de portada para eliminar');

    const publicId = extraerPublicId(currentBanner);
    if (publicId) {
      await eliminarDeCloudinary(publicId).catch(err => console.warn('⚠️ No se pudo eliminar de Cloudinary:', err.message));
    }

    const queryUpdate = `
      UPDATE "User"
      SET "bannerUrl" = NULL, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING
        id,
        username as nombre_usuario,
        "fullName" as nombre,
        email,
        role as rol,
        bio as biografia,
        "avatarUrl" as foto_perfil,
        "bannerUrl" as portada,
        "isPrivate" as privacidad,
        "createdAt" as fecha_creacion
    `;
    const resultUpdate = await pool.query(queryUpdate, [usuarioId]);

    return {
      exito: true,
      usuario: resultUpdate.rows[0],
      mensaje: 'Foto de portada eliminada exitosamente'
    };

  } catch (error) {
    console.error('❌ Error en eliminarFotoPortada:', error);
    throw new Error(`Error al eliminar foto de portada: ${error.message}`);
  }
};

// ==================== CONFIGURACIÓN DE NOTIFICACIONES ====================

import {
  obtenerConfigNotificaciones,
  actualizarConfigNotificaciones
} from '../modelos/usuarioModelo.js';

export const getConfigNotificaciones = async (req, res) => {
  try {
    const config = await obtenerConfigNotificaciones(req.usuario.id);
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
};

export const updateConfigNotificaciones = async (req, res) => {
  try {
    const { email_nuevo_post, email_nuevo_comentario, email_nuevo_seguidor,
            push_nuevo_post, push_nuevo_comentario, push_nuevo_seguidor } = req.body;

    const nuevos = {};
    if (email_nuevo_post !== undefined) nuevos.email_nuevo_post = email_nuevo_post;
    if (email_nuevo_comentario !== undefined) nuevos.email_nuevo_comentario = email_nuevo_comentario;
    if (email_nuevo_seguidor !== undefined) nuevos.email_nuevo_seguidor = email_nuevo_seguidor;
    if (push_nuevo_post !== undefined) nuevos.push_nuevo_post = push_nuevo_post;
    if (push_nuevo_comentario !== undefined) nuevos.push_nuevo_comentario = push_nuevo_comentario;
    if (push_nuevo_seguidor !== undefined) nuevos.push_nuevo_seguidor = push_nuevo_seguidor;

    const configActualizada = await actualizarConfigNotificaciones(req.usuario.id, nuevos);
    res.json(configActualizada);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
};

// ==================== EXPORTACIONES ====================

export default {
  // Búsqueda y verificación
  verificarDisponibilidadUsername,
  buscarUsuarios,
  buscarUsuariosPorRol,
  buscarUsuariosConFiltros,
  obtenerPerfilUsuario,

  // Seguimiento
  seguirUsuario,
  dejarDeSeguirUsuario,
  obtenerSeguidores,
  obtenerSeguidos,
  verificarSiSigue,

  // Perfil
  obtenerMiPerfil,
  actualizarPerfilUsuario,

  // Estadísticas
  obtenerEstadisticasUsuario,

  // Cloudinary
  subirFotoPerfil,
  subirFotoPortada,
  eliminarFotoPerfil,
  eliminarFotoPortada,

  // Notificaciones
  getConfigNotificaciones,
  updateConfigNotificaciones
};