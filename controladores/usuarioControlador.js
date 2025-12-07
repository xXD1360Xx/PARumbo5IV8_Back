import { pool } from '../configuracion/basedeDatos.js';
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// ==================== CONFIGURACIÓN CLOUDINARY (BACKEND) ====================
// Configura Cloudinary (variables deben estar en .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ==================== FUNCIONES DE CLOUDINARY ====================

/**
 * Sube una imagen a Cloudinary
 * @param {string} filePath - Ruta del archivo temporal
 * @param {string} tipo - 'perfil' o 'portada'
 * @returns {string} URL de la imagen en Cloudinary
 */
const subirImagenACloudinaryBackend = async (filePath, tipo = 'perfil') => {
  try {
    console.log('☁️ [BACKEND] Subiendo imagen a Cloudinary...');
    
    const resultado = await cloudinary.uploader.upload(filePath, {
      folder: `rumbo/${tipo}`,
      transformation: tipo === 'perfil' 
        ? [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }]
        : [{ width: 1200, height: 400, crop: 'fill' }]
    });

    // Eliminar archivo temporal
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return resultado.secure_url;
  } catch (error) {
    console.error('❌ Error subiendo a Cloudinary:', error);
    // Intentar eliminar archivo temporal en caso de error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

// ==================== FUNCIONES DEL CONTROLADOR ====================

/**
 * Obtener perfil del usuario autenticado
 */
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

/**
 * Obtener estadísticas del usuario
 */
export const obtenerEstadisticasUsuario = async (usuarioId) => {
  try {
    console.log('📊 [CONTROLADOR] Obteniendo estadísticas para usuario ID:', usuarioId);
    
    const queryTests = `
      SELECT COUNT(*) as total 
      FROM _user_test_results 
      WHERE usuario_id = $1
    `;
    
    const querySeguidores = `
      SELECT COUNT(*) as total 
      FROM _user_followers 
      WHERE user_id_followed = $1
    `;
    
    const querySeguidos = `
      SELECT COUNT(*) as total 
      FROM _user_followers 
      WHERE user_id_follower = $1
    `;
    
    const [resultTests, resultSeguidores, resultSeguidos] = await Promise.all([
      pool.query(queryTests, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(querySeguidores, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(querySeguidos, [usuarioId]).catch(() => ({ rows: [{ total: 0 }] }))
    ]);
    
    const estadisticas = {
      resultados: parseInt(resultTests.rows[0]?.total || 0),
      tests_completados: parseInt(resultTests.rows[0]?.total || 0),
      seguidores: parseInt(resultSeguidores.rows[0]?.total || 0),
      seguidos: parseInt(resultSeguidos.rows[0]?.total || 0),
    };
    
    console.log('📈 Estadísticas obtenidas:', estadisticas);
    
    return estadisticas;
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasUsuario:', error);
    return {
      resultados: 0,
      tests_completados: 0,
      seguidores: 0,
      seguidos: 0,
    };
  }
};

/**
 * Actualizar perfil del usuario (nombre y biografía)
 */
/**
 * Actualizar perfil completo del usuario
 * Permite actualizar: nombre, nombre de usuario, biografía, correo, contraseña
 */
export const actualizarPerfilUsuario = async (usuarioId, datosActualizacion) => {
  try {
    console.log('✏️ [CONTROLADOR] Actualizando perfil para usuario ID:', usuarioId);
    console.log('📝 Datos de actualización:', datosActualizacion);
    
    const { 
      nombre,           // Nombre completo
      nombre_usuario,   // Nombre de usuario (username)
      email,            // Correo electrónico
      contrasena,       // Contraseña (si se quiere cambiar)
      biografia,        // Biografía
      nombreCompleto,   // Alias para nombre
      bio,              // Alias para biografía
      username,         // Alias para nombre_usuario
      password          // Alias para contraseña
    } = datosActualizacion;
    
    // Usar nombres alternativos si los principales no están
    const nombreFinal = nombre || nombreCompleto;
    const nombreUsuarioFinal = nombre_usuario || username;
    const biografiaFinal = biografia || bio;
    const contrasenaFinal = contrasena || password;
    
    // Verificar si el nuevo nombre de usuario ya existe (si se está cambiando)
    if (nombreUsuarioFinal) {
      const verificarUsuarioQuery = `
        SELECT id FROM _users 
        WHERE username = $1 AND id != $2
      `;
      const usuarioExistente = await pool.query(verificarUsuarioQuery, [nombreUsuarioFinal, usuarioId]);
      
      if (usuarioExistente.rows.length > 0) {
        throw new Error('El nombre de usuario ya está en uso');
      }
    }
    
    // Verificar si el nuevo correo ya existe (si se está cambiando)
    if (email) {
      const verificarEmailQuery = `
        SELECT id FROM _users 
        WHERE email = $1 AND id != $2
      `;
      const emailExistente = await pool.query(verificarEmailQuery, [email, usuarioId]);
      
      if (emailExistente.rows.length > 0) {
        throw new Error('El correo electrónico ya está en uso');
      }
    }
    
    // Preparar los valores para la actualización
    const valoresActualizacion = [];
    const partesQuery = [];
    let contador = 1;
    
    // Nombre completo
    if (nombreFinal !== undefined) {
      partesQuery.push(`full_name = $${contador}`);
      valoresActualizacion.push(nombreFinal);
      contador++;
    }
    
    // Nombre de usuario
    if (nombreUsuarioFinal !== undefined) {
      partesQuery.push(`username = $${contador}`);
      valoresActualizacion.push(nombreUsuarioFinal);
      contador++;
    }
    
    // Correo electrónico
    if (email !== undefined) {
      partesQuery.push(`email = $${contador}`);
      valoresActualizacion.push(email);
      contador++;
    }
    
    // Contraseña (si se proporciona)
    if (contrasenaFinal !== undefined) {
      // Encriptar la contraseña antes de guardarla
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const contrasenaEncriptada = await bcrypt.hash(contrasenaFinal, saltRounds);
      
      partesQuery.push(`password = $${contador}`);
      valoresActualizacion.push(contrasenaEncriptada);
      contador++;
    }
    
    // Biografía
    if (biografiaFinal !== undefined) {
      partesQuery.push(`bio = $${contador}`);
      valoresActualizacion.push(biografiaFinal);
      contador++;
    }
    
    // Siempre actualizar la fecha de modificación
    partesQuery.push(`updated_at = NOW()`);
    
    // Si no hay nada que actualizar, retornar error
    if (partesQuery.length === 1) { // Solo updated_at
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
    
    const result = await pool.query(query, valoresActualizacion);
    
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

/**
 * Cambiar contraseña del usuario
 */
export const cambiarContrasenaUsuario = async (usuarioId, datos) => {
  try {
    console.log('🔐 [CONTROLADOR] Cambiando contraseña para usuario ID:', usuarioId);
    
    const { 
      contrasena_actual, 
      nueva_contrasena,
      confirmar_contrasena 
    } = datos;
    
    // Validaciones
    if (!contrasena_actual || !nueva_contrasena) {
      throw new Error('Se requieren la contraseña actual y la nueva');
    }
    
    if (nueva_contrasena !== confirmar_contrasena) {
      throw new Error('Las contraseñas nuevas no coinciden');
    }
    
    if (nueva_contrasena.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }
    
    // 1. Verificar contraseña actual
    const usuarioQuery = `
      SELECT password FROM _users WHERE id = $1
    `;
    const usuarioResult = await pool.query(usuarioQuery, [usuarioId]);
    
    if (usuarioResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const contrasenaActualHash = usuarioResult.rows[0].password;
    
    // Comparar contraseña actual
    const bcrypt = require('bcrypt');
    const contrasenaValida = await bcrypt.compare(contrasena_actual, contrasenaActualHash);
    
    if (!contrasenaValida) {
      throw new Error('La contraseña actual es incorrecta');
    }
    
    // 2. Encriptar nueva contraseña
    const saltRounds = 10;
    const nuevaContrasenaHash = await bcrypt.hash(nueva_contrasena, saltRounds);
    
    // 3. Actualizar contraseña
    const updateQuery = `
      UPDATE _users 
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email
    `;
    
    const result = await pool.query(updateQuery, [nuevaContrasenaHash, usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Error al actualizar la contraseña');
    }
    
    console.log('✅ Contraseña cambiada para usuario ID:', usuarioId);
    
    return {
      exito: true,
      mensaje: 'Contraseña actualizada exitosamente'
    };
    
  } catch (error) {
    console.error('❌ Error en cambiarContrasenaUsuario:', error);
    throw error;
  }
};

// ==================== FUNCIONES PARA FOTOS ====================

/**
 * Subir y actualizar foto de perfil (con Cloudinary)
 */
export const subirFotoPerfil = async (usuarioId, filePath) => {
  try {
    console.log('📸 [CONTROLADOR] Subiendo foto de perfil para usuario ID:', usuarioId);
    
    // 1. Subir a Cloudinary
    const cloudinaryUrl = await subirImagenACloudinaryBackend(filePath, 'perfil');
    console.log('✅ URL de Cloudinary:', cloudinaryUrl);
    
    // 2. Actualizar en base de datos
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
        created_at as fecha_creacion,
        updated_at
    `;
    
    const result = await pool.query(query, [cloudinaryUrl, usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioActualizado = result.rows[0];
    console.log('✅ Foto de perfil actualizada para:', usuarioActualizado.email);
    
    return {
      usuario: usuarioActualizado,
      url: cloudinaryUrl
    };
  } catch (error) {
    console.error('❌ Error en subirFotoPerfil:', error);
    throw error;
  }
};

/**
 * Subir y actualizar foto de portada (con Cloudinary)
 */
export const subirFotoPortada = async (usuarioId, filePath) => {
  try {
    console.log('🌅 [CONTROLADOR] Subiendo foto de portada para usuario ID:', usuarioId);
    
    // 1. Subir a Cloudinary
    const cloudinaryUrl = await subirImagenACloudinaryBackend(filePath, 'portada');
    console.log('✅ URL de Cloudinary:', cloudinaryUrl);
    
    // 2. Actualizar en base de datos
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
        created_at as fecha_creacion,
        updated_at
    `;
    
    const result = await pool.query(query, [cloudinaryUrl, usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioActualizado = result.rows[0];
    console.log('✅ Foto de portada actualizada para:', usuarioActualizado.email);
    
    return {
      usuario: usuarioActualizado,
      url: cloudinaryUrl
    };
  } catch (error) {
    console.error('❌ Error en subirFotoPortada:', error);
    throw error;
  }
};

/**
 * Eliminar foto de perfil (poner por defecto)
 */
export const eliminarFotoPerfil = async (usuarioId) => {
  try {
    console.log('🗑️ [CONTROLADOR] Eliminando foto de perfil para usuario ID:', usuarioId);
    
    const fotoPorDefecto = 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';
    
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
        created_at as fecha_creacion,
        updated_at
    `;
    
    const result = await pool.query(query, [fotoPorDefecto, usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioActualizado = result.rows[0];
    console.log('✅ Foto de perfil eliminada para:', usuarioActualizado.email);
    
    return usuarioActualizado;
  } catch (error) {
    console.error('❌ Error en eliminarFotoPerfil:', error);
    throw error;
  }
};

/**
 * Eliminar foto de portada (poner null)
 */
export const eliminarFotoPortada = async (usuarioId) => {
  try {
    console.log('🗑️ [CONTROLADOR] Eliminando foto de portada para usuario ID:', usuarioId);
    
    const query = `
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
        created_at as fecha_creacion,
        updated_at
    `;
    
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioActualizado = result.rows[0];
    console.log('✅ Foto de portada eliminada para:', usuarioActualizado.email);
    
    return usuarioActualizado;
  } catch (error) {
    console.error('❌ Error en eliminarFotoPortada:', error);
    throw error;
  }
};
