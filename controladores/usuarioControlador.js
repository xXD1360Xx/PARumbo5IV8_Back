import { pool } from '../configuracion/basedeDatos.js';

// Obtener perfil del usuario autenticado
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

// Obtener perfil público de otro usuario
export const obtenerPerfilPublico = async (usuarioId) => {
  try {
    console.log('🔍 [CONTROLADOR] Obteniendo perfil público para ID:', usuarioId);
    
    const query = `
      SELECT 
        id, 
        username as nombre_usuario,
        full_name as nombre,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        created_at as fecha_creacion
      FROM _users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error en obtenerPerfilPublico:', error);
    throw error;
  }
};

// Obtener estadísticas del usuario
export const obtenerEstadisticasUsuario = async (usuarioId) => {
  try {
    console.log('📊 [CONTROLADOR] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    // Consultas para estadísticas
    const consultas = {
      // Contar resultados de tests (usando tabla correcta)
      resultadosTests: `
        SELECT COUNT(*) as total 
        FROM _user_test_results 
        WHERE usuario_id = $1
      `,
      
      // Obtener seguidores (si tienes tabla de seguidores)
      seguidores: `
        SELECT COUNT(*) as total 
        FROM _user_followers 
        WHERE user_id_followed = $1
      `,
      
      // Obtener seguidos (si tienes tabla de seguidores)
      seguidos: `
        SELECT COUNT(*) as total 
        FROM _user_followers 
        WHERE user_id_follower = $1
      `,
      
      // Obtener resultados vocacionales
      resultadosVocacionales: `
        SELECT COUNT(*) as total 
        FROM user_vocational_results 
        WHERE usuario_id = $1
      `
    };
    
    // Ejecutar consultas en paralelo
    const [resultadosTests, seguidores, seguidos, resultadosVocacionales] = await Promise.all([
      pool.query(consultas.resultadosTests, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(consultas.seguidores, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(consultas.seguidos, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(consultas.resultadosVocacionales, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] }))
    ]);
    
    const estadisticas = {
      resultados: parseInt(resultadosTests.rows[0]?.total || 0),
      seguidores: parseInt(seguidores.rows[0]?.total || 0),
      seguidos: parseInt(seguidos.rows[0]?.total || 0),
      resultados_vocacionales: parseInt(resultadosVocacionales.rows[0]?.total || 0),
      tests_completados: parseInt(resultadosTests.rows[0]?.total || 0)
    };
    
    console.log('📈 Estadísticas obtenidas:', estadisticas);
    
    return estadisticas;
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasUsuario:', error);
    // Retornar valores por defecto en caso de error
    return {
      resultados: 0,
      seguidores: 0,
      seguidos: 0,
      resultados_vocacionales: 0,
      tests_completados: 0
    };
  }
};

// Obtener datos para el dashboard
export const obtenerDatosDashboard = async (usuarioId) => {
  try {
    console.log('📋 [CONTROLADOR] Obteniendo dashboard para usuario ID:', usuarioId);
    
    // Obtener perfil y estadísticas juntos
    const [perfil, estadisticas] = await Promise.all([
      obtenerMiPerfil(usuarioId),
      obtenerEstadisticasUsuario(usuarioId)
    ]);
    
    // Obtener últimos tests realizados
    const ultimosTestsQuery = `
      SELECT 
        r.test_id,
        r.score as puntuacion,
        r.created_at as fecha_realizacion,
        'Test ' || r.test_id as nombre
      FROM _user_test_results r
      WHERE r.usuario_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `;
    
    const ultimosTests = await pool.query(ultimosTestsQuery, [usuarioId])
      .catch(() => ({ rows: [] }));
    
    // Obtener últimos resultados vocacionales
    const ultimosVocacionalesQuery = `
      SELECT 
        id,
        resultado,
        fecha_creacion
      FROM user_vocational_results 
      WHERE usuario_id = $1
      ORDER BY fecha_creacion DESC
      LIMIT 3
    `;
    
    const ultimosVocacionales = await pool.query(ultimosVocacionalesQuery, [usuarioId])
      .catch(() => ({ rows: [] }));
    
    const dashboardData = {
      usuario: perfil,
      estadisticas: estadisticas,
      actividad_reciente: {
        ultimos_tests: ultimosTests.rows,
        ultimos_vocacionales: ultimosVocacionales.rows,
        total_actividades: estadisticas.resultados + estadisticas.resultados_vocacionales
      },
      resumen: {
        nivel_actividad: estadisticas.resultados > 10 ? 'Alta' : 
                         estadisticas.resultados > 3 ? 'Media' : 'Baja',
        completado_perfil: perfil?.biografia && perfil?.avatar_url ? 100 : 
                           perfil?.biografia || perfil?.avatar_url ? 50 : 0
      }
    };
    
    console.log('✅ Dashboard generado exitosamente');
    
    return dashboardData;
  } catch (error) {
    console.error('❌ Error en obtenerDatosDashboard:', error);
    throw error;
  }
};

// Actualizar perfil del usuario
export const actualizarPerfilUsuario = async (usuarioId, datosActualizacion) => {
  try {
    console.log('✏️ [CONTROLADOR] Actualizando perfil para usuario ID:', usuarioId);
    console.log('📝 Datos de actualización:', datosActualizacion);
    
    const { 
      nombre, 
      biografia, 
      foto_perfil, 
      portada,
      nombreCompleto,
      bio,
      avatarUrl,
      bannerUrl
    } = datosActualizacion;
    
    // Usar nombres alternativos si los principales no están
    const nombreFinal = nombre || nombreCompleto;
    const biografiaFinal = biografia || bio;
    const fotoPerfilFinal = foto_perfil || avatarUrl;
    const portadaFinal = portada || bannerUrl;
    
    const query = `
      UPDATE _users 
      SET 
        full_name = COALESCE($1, full_name),
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url),
        banner_url = COALESCE($4, banner_url),
        updated_at = NOW()
      WHERE id = $5
      RETURNING 
        id, 
        username as nombre_usuario,
        full_name as nombre,
        email,
        role as rol,
        bio as biografia,
        avatar_url as foto_perfil,
        banner_url as portada,
        created_at as fecha_creacion,
        updated_at
    `;
    
    const result = await pool.query(query, [
      nombreFinal, 
      biografiaFinal, 
      fotoPerfilFinal, 
      portadaFinal, 
      usuarioId
    ]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioActualizado = result.rows[0];
    console.log('✅ Perfil actualizado para:', usuarioActualizado.email);
    
    return usuarioActualizado;
  } catch (error) {
    console.error('❌ Error en actualizarPerfilUsuario:', error);
    throw error;
  }
};

// Buscar usuarios
export const buscarUsuarios = async (termino, limite = 10) => {
  try {
    console.log('🔍 [CONTROLADOR] Buscando usuarios con término:', termino);
    
    const query = `
      SELECT 
        id, 
        username as nombre_usuario,
        full_name as nombre,
        bio as biografia,
        avatar_url as foto_perfil,
        role as rol
      FROM _users 
      WHERE 
        username ILIKE $1 OR 
        full_name ILIKE $1 OR 
        email ILIKE $1
      ORDER BY 
        CASE 
          WHEN username ILIKE $1 THEN 1
          WHEN full_name ILIKE $1 THEN 2
          ELSE 3
        END
      LIMIT $2
    `;
    
    const result = await pool.query(query, [`%${termino}%`, limite]);
    console.log('✅ Encontrados', result.rows.length, 'usuarios');
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error en buscarUsuarios:', error);
    throw error;
  }
};

// Verificar si un usuario existe
export const verificarUsuarioExiste = async (usuarioId) => {
  try {
    const query = `
      SELECT EXISTS(SELECT 1 FROM _users WHERE id = $1) as existe
    `;
    
    const result = await pool.query(query, [usuarioId]);
    return result.rows[0].existe;
  } catch (error) {
    console.error('❌ Error en verificarUsuarioExiste:', error);
    throw error;
  }
};

// Obtener configuración del usuario
export const obtenerConfiguracionUsuario = async (usuarioId) => {
  try {
    // Por ahora retornamos configuración por defecto
    return {
      notificaciones: true,
      privacidad_perfil: 'publico',
      tema_interfaz: 'oscuro',
      idioma: 'es',
      recibir_correos: true
    };
  } catch (error) {
    console.error('❌ Error en obtenerConfiguracionUsuario:', error);
    throw error;
  }
};

// Actualizar configuración del usuario
export const actualizarConfiguracionUsuario = async (usuarioId, configuracion) => {
  try {
    console.log('⚙️ [CONTROLADOR] Actualizando configuración para usuario ID:', usuarioId);
    console.log('🔧 Configuración:', configuracion);
    
    // Por ahora solo logueamos, en el futuro podrías guardar en una tabla de configuraciones
    console.log('✅ Configuración actualizada (simulado)');
    
    return {
      ...configuracion,
      actualizado_en: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error en actualizarConfiguracionUsuario:', error);
    throw error;
  }
};