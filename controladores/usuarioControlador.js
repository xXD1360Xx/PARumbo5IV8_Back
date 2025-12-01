import { pool } from '../configuracion/baseDeDatos.js';

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
    const { nombre, biografia, foto_perfil, portada } = datosActualizacion;
    
    const query = `
      UPDATE usuarios 
      SET 
        nombre = COALESCE($1, nombre),
        biografia = COALESCE($2, biografia),
        foto_perfil = COALESCE($3, foto_perfil),
        portada = COALESCE($4, portada),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, nombre, email, nombre_usuario, rol, biografia, foto_perfil, portada, fecha_creacion
    `;
    
    const result = await pool.query(query, [
      nombre, 
      biografia, 
      foto_perfil, 
      portada, 
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
    // Puedes crear una tabla de configuraciones si la necesitas
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