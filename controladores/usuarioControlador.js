import { pool } from '../configuracion/basedeDatos.js';

// Obtener perfil de usuario
export const obtenerPerfilUsuario = async (usuarioId, perfilPublico = false) => {
  try {
    let query;
    let params = [usuarioId];
    
    if (perfilPublico) {
      // Perfil público - excluir información sensible
      query = `
        SELECT 
          id, nombre, nombre_usuario, rol, biografia, 
          foto_perfil, portada, fecha_creacion, updated_at
        FROM usuarios 
        WHERE id = $1
      `;
    } else {
      // Perfil propio - incluye email
      query = `
        SELECT * FROM usuarios 
        WHERE id = $1
      `;
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const usuario = result.rows[0];
    
    // Si no es perfil público, excluir la contraseña
    if (!perfilPublico && usuario.contrasena_hash) {
      const { contrasena_hash, ...usuarioSinPassword } = usuario;
      return usuarioSinPassword;
    }
    
    return usuario;
  } catch (error) {
    console.error('Error en obtenerPerfilUsuario:', error);
    throw error;
  }
};

// Actualizar perfil de usuario
export const actualizarPerfilUsuario = async (usuarioId, datosActualizacion) => {
  try {
    const { nombre, biografia, foto_perfil, portada, nombreCompleto, bio, avatarUrl, bannerUrl } = datosActualizacion;
    
    // Mapear nombres diferentes para compatibilidad
    const nombreFinal = nombre || nombreCompleto;
    const biografiaFinal = biografia || bio;
    const fotoPerfilFinal = foto_perfil || avatarUrl;
    const portadaFinal = portada || bannerUrl;
    
    const query = `
      UPDATE usuarios 
      SET 
        nombre = COALESCE($1, nombre),
        biografia = COALESCE($2, biografia),
        foto_perfil = COALESCE($3, foto_perfil),
        portada = COALESCE($4, portada),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, nombre, email, nombre_usuario, rol, biografia, foto_perfil, portada, fecha_creacion, updated_at
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
    
    return result.rows[0];
  } catch (error) {
    console.error('Error en actualizarPerfilUsuario:', error);
    throw error;
  }
};

// Obtener configuración del usuario
export const obtenerConfiguracionUsuario = async (usuarioId) => {
  try {
    // Por ahora devolvemos configuración por defecto
    return {
      notificaciones: true,
      privacidad: 'publico',
      tema: 'claro'
    };
  } catch (error) {
    console.error('Error en obtenerConfiguracionUsuario:', error);
    throw error;
  }
};

// Obtener datos para el dashboard
export const obtenerDatosDashboard = async (usuarioId) => {
  try {
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
      `,
      // Estadísticas adicionales (si existen estas tablas)
      resultadosVocacionales: `
        SELECT COUNT(*) as total 
        FROM user_vocational_results 
        WHERE usuario_id = $1
      `
    };
    
    const [testsCompletados, promedioGeneral, ultimoTest, resultadosVocacionales] = await Promise.all([
      pool.query(consultas.testsCompletados, [usuarioId]),
      pool.query(consultas.promedioGeneral, [usuarioId]),
      pool.query(consultas.ultimoTest, [usuarioId]),
      pool.query(consultas.resultadosVocacionales, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })) // Tabla opcional
    ]);

    return {
      testsCompletados: parseInt(testsCompletados.rows[0]?.total || 0),
      promedioGeneral: parseFloat(promedioGeneral.rows[0]?.promedio) || 0,
      ultimoTest: ultimoTest.rows[0] || null,
      resultadosVocacionales: parseInt(resultadosVocacionales.rows[0]?.total || 0)
    };
  } catch (error) {
    console.error('Error en obtenerDatosDashboard:', error);
    throw error;
  }
};

// Buscar usuarios (para funcionalidad de búsqueda)
export const buscarUsuarios = async (termino, limite = 10) => {
  try {
    const query = `
      SELECT 
        id, nombre, nombre_usuario, foto_perfil, biografia
      FROM usuarios 
      WHERE 
        nombre ILIKE $1 OR 
        nombre_usuario ILIKE $1 OR 
        email ILIKE $1
      LIMIT $2
    `;
    
    const result = await pool.query(query, [`%${termino}%`, limite]);
    return result.rows;
  } catch (error) {
    console.error('Error en buscarUsuarios:', error);
    throw error;
  }
};

// Verificar existencia de usuario
export const verificarUsuarioExiste = async (usuarioId) => {
  try {
    const query = `
      SELECT EXISTS(SELECT 1 FROM usuarios WHERE id = $1) as existe
    `;
    
    const result = await pool.query(query, [usuarioId]);
    return result.rows[0].existe;
  } catch (error) {
    console.error('Error en verificarUsuarioExiste:', error);
    throw error;
  }
};