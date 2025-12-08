import { pool } from '../configuracion/basedeDatos.js';
import crypto from 'crypto';
import { subirACloudinary, eliminarDeCloudinary, extraerPublicId } from '../configuracion/cloudinary.js';

// ==================== FUNCIONES DE BÚSQUEDA Y SEGUIMIENTO ====================

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
    
    // Verificar si ya existe
    const query = `
      SELECT id, username FROM _users 
      WHERE LOWER(username) = $1
    `;
    
    const result = await pool.query(query, [usernameLimpio]);
    const existe = result.rows.length > 0;
    
    // Si no existe, está disponible
    if (!existe) {
      return {
        disponible: true,
        mensaje: 'Nombre de usuario disponible'
      };
    }
    
    // Si existe, generar sugerencias
    const sugerencias = [];
    const base = usernameLimpio.replace(/[^a-z0-9]/g, '');
    
    if (base.length > 0) {
      // Sugerencias con números
      for (let i = 1; i <= 5; i++) {
        sugerencias.push(`${base}${i}`);
        sugerencias.push(`${base}_${i}`);
      }
      
      // Sugerencia con año
      sugerencias.push(`${base}${new Date().getFullYear().toString().slice(-2)}`);
      
      // Sugerencia con "real"
      sugerencias.push(`${base}_real`);
    }
    
    // Eliminar duplicados y limitar
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
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM user_follows 
            WHERE follower_id = $2 AND following_id = _users.id
          ) as lo_sigo,
          _users.id = $2 as es_yo
        ` : 'false as lo_sigo, false as es_yo'}
      FROM _users 
      WHERE 
        (LOWER(username) LIKE $1 OR
         LOWER(full_name) LIKE $1 OR
         LOWER(email) LIKE $1 OR
         id::text ILIKE $1)
        ${usuarioActualId ? 'AND id != $2' : ''}
      ORDER BY 
        CASE 
          WHEN LOWER(username) LIKE $1 THEN 1
          WHEN LOWER(full_name) LIKE $1 THEN 2
          WHEN LOWER(email) LIKE $1 THEN 3
          ELSE 4
        END,
        username
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;
    
    const params = usuarioActualId 
      ? [termino, usuarioActualId, limite, offset]
      : [termino, limite, offset];
    
    const result = await pool.query(query, params);
    
    // Filtrar según privacidad
    const usuariosProcesados = result.rows.map(usuario => {
      // Si el perfil es privado y el usuario actual no es el dueño ni lo sigue
      if (usuario.privacidad && usuarioActualId && !usuario.es_yo && !usuario.lo_sigo) {
        return {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          nombre: 'Usuario privado',
          rol: 'usuario',
          foto_perfil: null, // No mostrar foto de perfil
          privacidad: true,
          seguidores: 0, // No mostrar conteo real
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
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion
      FROM _users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuario = result.rows[0];
    
    // Verificar si es perfil privado
    if (usuario.privacidad && usuarioActualId && usuarioActualId !== usuario.id) {
      // Verificar si el usuario actual sigue a este usuario
      const sigueQuery = `
        SELECT 1 FROM user_follows 
        WHERE follower_id = $1 AND following_id = $2
      `;
      const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
      
      if (sigueResult.rows.length === 0) {
        // Perfil privado y no lo sigue, devolver información limitada
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
        SELECT 1 FROM user_follows 
        WHERE follower_id = $1 AND following_id = $2
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
    
    // Verificar que no sea el mismo usuario
    if (followerId === followingId) {
      throw new Error('No puedes seguirte a ti mismo');
    }
    
    // Verificar que el usuario a seguir existe
    const usuarioExisteQuery = `SELECT id, is_private FROM _users WHERE id = $1`;
    const usuarioExiste = await pool.query(usuarioExisteQuery, [followingId]);
    
    if (usuarioExiste.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    // Verificar si ya lo sigue
    const yaSigueQuery = `
      SELECT 1 FROM user_follows 
      WHERE follower_id = $1 AND following_id = $2
    `;
    const yaSigue = await pool.query(yaSigueQuery, [followerId, followingId]);
    
    if (yaSigue.rows.length > 0) {
      throw new Error('Ya sigues a este usuario');
    }
    
    // Iniciar transacción
    await pool.query('BEGIN');
    
    try {
      // 1. Insertar en user_follows
      const insertQuery = `
        INSERT INTO user_follows (follower_id, following_id) 
        VALUES ($1, $2)
        RETURNING id, created_at
      `;
      await pool.query(insertQuery, [followerId, followingId]);
      
      // 2. Actualizar contadores MANUALMENTE
      await pool.query(
        `UPDATE _users SET following_count = following_count + 1 WHERE id = $1`,
        [followerId]
      );
      
      await pool.query(
        `UPDATE _users SET followers_count = followers_count + 1 WHERE id = $1`,
        [followingId]
      );
      
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
    
    // Verificar que existe la relación
    const existeRelacionQuery = `
      SELECT id FROM user_follows 
      WHERE follower_id = $1 AND following_id = $2
    `;
    const existeRelacion = await pool.query(existeRelacionQuery, [followerId, followingId]);
    
    if (existeRelacion.rows.length === 0) {
      throw new Error('No sigues a este usuario');
    }
    
    // Iniciar transacción
    await pool.query('BEGIN');
    
    try {
      // 1. Eliminar de user_follows
      const deleteQuery = `
        DELETE FROM user_follows 
        WHERE follower_id = $1 AND following_id = $2
        RETURNING id
      `;
      await pool.query(deleteQuery, [followerId, followingId]);
      
      // 2. Actualizar contadores MANUALMENTE
      await pool.query(
        `UPDATE _users SET following_count = following_count - 1 WHERE id = $1`,
        [followerId]
      );
      
      await pool.query(
        `UPDATE _users SET followers_count = followers_count - 1 WHERE id = $1`,
        [followingId]
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
        u.full_name as nombre,
        u.avatar_url as foto_perfil,
        u.bio as biografia,
        u.role as rol,
        u.is_private as privacidad,
        uf.created_at as fecha_seguimiento,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM user_follows f2 
            WHERE f2.follower_id = $1 AND f2.following_id = u.id
          ) as yo_lo_sigo,
          u.id = $1 as es_yo
        ` : 'false as yo_lo_sigo, false as es_yo'}
      FROM user_follows uf
      JOIN _users u ON uf.follower_id = u.id
      WHERE uf.following_id = ${usuarioActualId ? '$2' : '$1'}
      ORDER BY uf.created_at DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;
    
    const params = usuarioActualId 
      ? [usuarioActualId, usuarioId, limite, offset]
      : [usuarioId, limite, offset];
    
    const result = await pool.query(query, params);
    
    // Filtrar según privacidad
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
        u.full_name as nombre,
        u.avatar_url as foto_perfil,
        u.bio as biografia,
        u.role as rol,
        u.is_private as privacidad,
        uf.created_at as fecha_seguimiento,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM user_follows f2 
            WHERE f2.follower_id = u.id AND f2.following_id = $1
          ) as me_sigue,
          u.id = $1 as es_yo
        ` : 'false as me_sigue, false as es_yo'}
      FROM user_follows uf
      JOIN _users u ON uf.following_id = u.id
      WHERE uf.follower_id = ${usuarioActualId ? '$2' : '$1'}
      ORDER BY uf.created_at DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;
    
    const params = usuarioActualId 
      ? [usuarioActualId, usuarioId, limite, offset]
      : [usuarioId, limite, offset];
    
    const result = await pool.query(query, params);
    
    // Filtrar según privacidad
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
      SELECT 1 FROM user_follows 
      WHERE follower_id = $1 AND following_id = $2
    `;
    
    const result = await pool.query(query, [followerId, followingId]);
    
    return result.rows.length > 0;
    
  } catch (error) {
    console.error('❌ Error en verificarSiSigue:', error);
    throw error;
  }
};

// ==================== FUNCIONES DE RESULTADOS TESTS ====================

/**
 * Obtener resultados de tests de un usuario con manejo de privacidad
 */
export const obtenerResultadosTestsUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📊 [TESTS] Obteniendo resultados para usuario ID:', usuarioId);
    
    // Verificar privacidad si no es el propio usuario
    if (usuarioActualId && usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        // Verificar si el usuario actual sigue a este usuario
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          // Perfil privado y no lo sigue, no mostrar resultados
          return [];
        }
      }
    }
    
    const query = `
      SELECT 
        id,
        user_id as usuario_id,
        test_id,
        score as puntuacion,
        completed_at as fecha_completado,
        created_at
      FROM _user_test_results 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    console.log(`✅ Encontrados ${result.rows.length} resultados de tests`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error en obtenerResultadosTestsUsuario:', error);
    return [];
  }
};

/**
 * Obtener resultados vocacionales con manejo de privacidad
 */
export const obtenerResultadosVocacionalesUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('🎓 [VOCACIONAL] Obteniendo resultados para usuario ID:', usuarioId);
    
    // Verificar privacidad si no es el propio usuario
    if (usuarioActualId && usuarioActualId !== usuarioId) {
      const perfilQuery = `SELECT is_private FROM _users WHERE id = $1`;
      const perfilResult = await pool.query(perfilQuery, [usuarioId]);
      
      if (perfilResult.rows.length > 0 && perfilResult.rows[0].is_private) {
        // Verificar si el usuario actual sigue a este usuario
        const sigueQuery = `
          SELECT 1 FROM user_follows 
          WHERE follower_id = $1 AND following_id = $2
        `;
        const sigueResult = await pool.query(sigueQuery, [usuarioActualId, usuarioId]);
        
        if (sigueResult.rows.length === 0) {
          // Perfil privado y no lo sigue, no mostrar resultados
          return [];
        }
      }
    }
    
    const query = `
      SELECT 
        id,
        user_id as usuario_id,
        test_date as fecha,
        resultados_completos as respuestas,
        top_carreras as carreras,
        score_global as promedio_general,
        zona_ikigai,
        created_at,
        updated_at,
        perfil_tecnologico,
        perfil_cientifico,
        perfil_salud,
        perfil_administrativo,
        perfil_social
      FROM user_vocational_results 
      WHERE user_id = $1 
      ORDER BY test_date DESC
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    // Parsear los JSON strings si es necesario
    const resultados = result.rows.map(item => ({
      ...item,
      respuestas: item.respuestas ? (typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas) : {},
      carreras: item.carreras ? (typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras) : []
    }));
    
    console.log(`✅ Encontrados ${resultados.length} resultados vocacionales`);
    return resultados;
    
  } catch (error) {
    console.error('❌ Error en obtenerResultadosVocacionalesUsuario:', error);
    return [];
  }
};

/**
 * Obtener estadísticas de usuario (tests y seguidores)
 */
export const obtenerEstadisticasUsuario = async (usuarioId, usuarioActualId = null) => {
  try {
    console.log('📊 [CONTROLADOR] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    // Obtener datos básicos del usuario
    const usuarioQuery = `
      SELECT 
        followers_count,
        following_count,
        is_private as privacidad
      FROM _users 
      WHERE id = $1
    `;
    
    const usuarioResult = await pool.query(usuarioQuery, [usuarioId]);
    
    if (usuarioResult.rows.length === 0) {
      return {
        resultados_tests: 0,
        tests_completados: 0,
        resultados_vocacionales: 0,
        seguidores: 0,
        seguidos: 0,
        privacidad: false
      };
    }
    
    const usuario = usuarioResult.rows[0];
    
    // Verificar privacidad para mostrar resultados
    let resultadosTests = 0;
    let resultadosVocacionales = 0;
    
    if (!usuario.privacidad || usuarioActualId === usuarioId || 
        (usuarioActualId && await verificarSiSigue(usuarioActualId, usuarioId))) {
      
      // Obtener conteo de tests de conocimiento
      const testsQuery = `
        SELECT COUNT(*) as total 
        FROM _user_test_results 
        WHERE user_id = $1
      `;
      const testsResult = await pool.query(testsQuery, [usuarioId]);
      resultadosTests = parseInt(testsResult.rows[0]?.total || 0);
      
      // Obtener conteo de tests vocacionales
      const vocacionalQuery = `
        SELECT COUNT(*) as total 
        FROM user_vocational_results 
        WHERE user_id = $1
      `;
      const vocacionalResult = await pool.query(vocacionalQuery, [usuarioId]);
      resultadosVocacionales = parseInt(vocacionalResult.rows[0]?.total || 0);
    }
    
    const estadisticas = {
      resultados_tests: resultadosTests,
      tests_completados: resultadosTests,
      resultados_vocacionales: resultadosVocacionales,
      seguidores: parseInt(usuario.followers_count || 0),
      seguidos: parseInt(usuario.following_count || 0),
      privacidad: usuario.privacidad || false
    };
    
    console.log('📈 Estadísticas obtenidas:', estadisticas);
    
    return estadisticas;
    
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasUsuario:', error);
    return {
      resultados_tests: 0,
      tests_completados: 0,
      resultados_vocacionales: 0,
      seguidores: 0,
      seguidos: 0,
      privacidad: false
    };
  }
};

// ==================== FUNCIONES DE PERFIL ====================

export const obtenerMiPerfil = async (usuarioId) => {
  try {
    console.log('🔍 [CONTROLADOR] Obteniendo perfil para usuario ID:', usuarioId);
    
    const query = `
      SELECT 
        id, 
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion,
        updated_at
      FROM _users 
      WHERE id = $1
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
        SELECT id FROM _users 
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
        SELECT id FROM _users 
        WHERE LOWER(email) = LOWER($1) AND id != $2
      `;
      const emailExistente = await pool.query(verificarEmailQuery, [email, usuarioId]);
      
      if (emailExistente.rows.length > 0) {
        throw new Error('El correo electrónico ya está en uso');
      }
    }
    
    // Validar rol si se está actualizando
    if (role) {
      const rolesPermitidos = ['estudiante', 'egresado', 'maestro', 'admin'];
      if (!rolesPermitidos.includes(role.toLowerCase())) {
        throw new Error(`Rol inválido. Los roles válidos son: ${rolesPermitidos.join(', ')}`);
      }
    }
    
    // Preparar los valores para la actualización
    const valoresActualizacion = [];
    const partesQuery = [];
    let contador = 1;
    
    // full_name
    if (full_name !== undefined) {
      partesQuery.push(`full_name = $${contador}`);
      valoresActualizacion.push(full_name);
      contador++;
    }
    
    // username
    if (username !== undefined) {
      partesQuery.push(`username = $${contador}`);
      valoresActualizacion.push(username);
      contador++;
    }
    
    // email
    if (email !== undefined) {
      partesQuery.push(`email = $${contador}`);
      valoresActualizacion.push(email);
      contador++;
    }
    
    // password (encriptar con SHA256 si se proporciona)
    if (password !== undefined && password.trim() !== '') {
      const hash = crypto.createHash('sha256');
      hash.update(password);
      const passwordEncriptada = hash.digest('hex');
      
      partesQuery.push(`password = $${contador}`);
      valoresActualizacion.push(passwordEncriptada);
      contador++;
    }
    
    // role
    if (role !== undefined) {
      partesQuery.push(`role = $${contador}`);
      valoresActualizacion.push(role.toLowerCase());
      contador++;
    }
    
    // is_private
    if (is_private !== undefined) {
      const isPrivateBool = Boolean(is_private);
      partesQuery.push(`is_private = $${contador}`);
      valoresActualizacion.push(isPrivateBool);
      contador++;
    }
    
    // bio
    if (bio !== undefined) {
      partesQuery.push(`bio = $${contador}`);
      valoresActualizacion.push(bio);
      contador++;
    }
    
    // avatar_url
    if (avatar_url !== undefined) {
      partesQuery.push(`avatar_url = $${contador}`);
      valoresActualizacion.push(avatar_url);
      contador++;
    }
    
    // banner_url
    if (banner_url !== undefined) {
      partesQuery.push(`banner_url = $${contador}`);
      valoresActualizacion.push(banner_url);
      contador++;
    }
    
    // Siempre actualizar la fecha de modificación
    partesQuery.push(`updated_at = NOW()`);
    
    // Si no hay nada que actualizar (solo updated_at), retornar error
    if (partesQuery.length === 1) {
      throw new Error('No se proporcionaron datos para actualizar');
    }
    
    // Agregar el ID del usuario al final
    valoresActualizacion.push(usuarioId);
    
    // Construir la query dinámica
    const query = `
      UPDATE _users 
      SET ${partesQuery.join(', ')}
      WHERE id = $${contador}
      RETURNING 
        id,
        username,
        full_name,
        email,
        role,
        bio,
        avatar_url,
        banner_url,
        is_private,
        followers_count,
        following_count,
        created_at,
        updated_at
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
      seguidores: usuarioActualizado.followers_count,
      seguidos: usuarioActualizado.following_count,
      fecha_creacion: usuarioActualizado.created_at,
      fecha_actualizacion: usuarioActualizado.updated_at
    };
    
  } catch (error) {
    console.error('❌ Error en actualizarPerfilUsuario:', error);
    
    // Manejar errores específicos de PostgreSQL
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('username')) {
        throw new Error('El nombre de usuario ya está en uso');
      } else if (error.constraint && error.constraint.includes('email')) {
        throw new Error('El correo electrónico ya está en uso');
      }
    }
    
    throw error;
  }
};

// En controladores/usuarioControlador.js
export const buscarUsuariosPorRol = async (rol, usuarioActualId = null, pagina = 1, limite = 50) => {
  try {
    console.log('👥 [CONTROLADOR] Buscando usuarios por rol:', rol);
    
    const offset = (pagina - 1) * limite;
    
    const query = `
      SELECT 
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion,
        ${usuarioActualId ? `
          EXISTS(
            SELECT 1 FROM user_follows 
            WHERE follower_id = $2 AND following_id = _users.id
          ) as lo_sigo,
          _users.id = $2 as es_yo
        ` : 'false as lo_sigo, false as es_yo'}
      FROM _users 
      WHERE role = $1
      ORDER BY followers_count DESC, created_at DESC
      LIMIT ${usuarioActualId ? '$3' : '$2'} OFFSET ${usuarioActualId ? '$4' : '$3'}
    `;
    
    const params = usuarioActualId 
      ? [rol, usuarioActualId, limite, offset]
      : [rol, limite, offset];
    
    const result = await pool.query(query, params);
    
    // Filtrar según privacidad
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




// ==================== FUNCIONES DE CLOUDINARY ====================

/**
 * Subir foto de perfil
 */
export const subirFotoPerfil = async (usuarioId, filePath) => {
  try {
    console.log('📸 [CLOUDINARY] Subiendo foto de perfil para usuario ID:', usuarioId);
    
    // Subir a Cloudinary
    const cloudinaryResult = await subirACloudinary(filePath, 'avatar');
    
    // Actualizar en base de datos
    const query = `
      UPDATE _users 
      SET avatar_url = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING 
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion
    `;

    const result = await pool.query(query, [cloudinaryResult.url, usuarioId]);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    return {
      exito: true,
      usuario: result.rows[0],
      url: cloudinaryResult.url,
      public_id: cloudinaryResult.public_id
    };

  } catch (error) {
    console.error('❌ Error en subirFotoPerfil:', error);
    throw new Error(`Error al subir foto de perfil: ${error.message}`);
  }
};

/**
 * Subir foto de portada
 */
export const subirFotoPortada = async (usuarioId, filePath) => {
  try {
    console.log('🌅 [CLOUDINARY] Subiendo foto de portada para usuario ID:', usuarioId);
    
    // Subir a Cloudinary
    const cloudinaryResult = await subirACloudinary(filePath, 'banner');
    
    // Actualizar en base de datos
    const query = `
      UPDATE _users 
      SET banner_url = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING 
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion
    `;

    const result = await pool.query(query, [cloudinaryResult.url, usuarioId]);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    return {
      exito: true,
      usuario: result.rows[0],
      url: cloudinaryResult.url,
      public_id: cloudinaryResult.public_id
    };

  } catch (error) {
    console.error('❌ Error en subirFotoPortada:', error);
    throw new Error(`Error al subir foto de portada: ${error.message}`);
  }
};

/**
 * Eliminar foto de perfil
 */
export const eliminarFotoPerfil = async (usuarioId) => {
  try {
    console.log('🗑️ [CLOUDINARY] Eliminando foto de perfil para usuario ID:', usuarioId);
    
    // 1. Obtener URL actual del avatar
    const querySelect = `
      SELECT avatar_url FROM _users WHERE id = $1
    `;
    
    const resultSelect = await pool.query(querySelect, [usuarioId]);
    
    if (resultSelect.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const currentAvatar = resultSelect.rows[0].avatar_url;
    const defaultAvatar = 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';
    
    // 2. Si ya tiene la foto por defecto o no tiene foto
    if (!currentAvatar || currentAvatar === defaultAvatar) {
      throw new Error('No hay foto de perfil para eliminar');
    }
    
    // 3. Extraer public_id y eliminar de Cloudinary
    const publicId = extraerPublicId(currentAvatar);
    if (publicId) {
      const eliminado = await eliminarDeCloudinary(publicId);
      if (!eliminado) {
        console.warn('⚠️ No se pudo eliminar de Cloudinary, pero continuamos...');
      }
    }
    
    // 4. Actualizar a foto por defecto en BD
    const queryUpdate = `
      UPDATE _users 
      SET avatar_url = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING 
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion
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

/**
 * Eliminar foto de portada
 */
export const eliminarFotoPortada = async (usuarioId) => {
  try {
    console.log('🗑️ [CLOUDINARY] Eliminando foto de portada para usuario ID:', usuarioId);
    
    // 1. Obtener URL actual del banner
    const querySelect = `
      SELECT banner_url FROM _users WHERE id = $1
    `;
    
    const resultSelect = await pool.query(querySelect, [usuarioId]);
    
    if (resultSelect.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const currentBanner = resultSelect.rows[0].banner_url;
    
    // 2. Si no tiene banner
    if (!currentBanner) {
      throw new Error('No hay foto de portada para eliminar');
    }
    
    // 3. Extraer public_id y eliminar de Cloudinary
    const publicId = extraerPublicId(currentBanner);
    if (publicId) {
      const eliminado = await eliminarDeCloudinary(publicId);
      if (!eliminado) {
        console.warn('⚠️ No se pudo eliminar de Cloudinary, pero continuamos...');
      }
    }
    
    // 4. Actualizar a null en BD
    const queryUpdate = `
      UPDATE _users 
      SET banner_url = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id,
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        is_private as privacidad,
        followers_count as seguidores,
        following_count as seguidos,
        created_at as fecha_creacion
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




// Exportar todas las funciones
export default {
  // Búsqueda y verificación
  verificarDisponibilidadUsername,
  buscarUsuarios,
  buscarUsuariosPorRol,
  obtenerPerfilUsuario,
  
  // Seguimiento
  seguirUsuario,
  dejarDeSeguirUsuario,
  obtenerSeguidores,
  obtenerSeguidos,
  verificarSiSigue,
  
  // Resultados
  obtenerResultadosTestsUsuario,
  obtenerResultadosVocacionalesUsuario,
  obtenerEstadisticasUsuario,
  
  // Perfil
  obtenerMiPerfil,
  actualizarPerfilUsuario
};