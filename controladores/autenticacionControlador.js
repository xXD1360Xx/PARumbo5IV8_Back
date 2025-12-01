import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login normal (usuario/contraseña)
export const iniciarSesion = async (identificador, contrasena) => {
  try {
    // Buscar usuario por email o nombre de usuario
    const query = `
      SELECT * FROM usuarios 
      WHERE email = $1 OR nombre_usuario = $1
    `;
    const result = await pool.query(query, [identificador]);
    
    if (result.rows.length === 0) {
      return { exito: false, error: 'Usuario no encontrado' };
    }
    
    const usuario = result.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    
    if (!contrasenaValida) {
      return { exito: false, error: 'Contraseña incorrecta' };
    }
    
    // Eliminar contraseña del objeto de respuesta
    const { contrasena_hash, ...usuarioSinPassword } = usuario;
    
    return { 
      exito: true, 
      usuario: usuarioSinPassword 
    };
    
  } catch (error) {
    console.error('Error en iniciarSesion:', error);
    return { exito: false, error: 'Error del servidor' };
  }
};

// Registro manual
export const registrarUsuario = async (datosUsuario) => {
  try {
    const { nombre, email, contrasena, nombreUsuario } = datosUsuario;
    
    // Verificar si el usuario ya existe
    const usuarioExistente = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1 OR nombre_usuario = $2',
      [email, nombreUsuario]
    );
    
    if (usuarioExistente.rows.length > 0) {
      return { exito: false, error: 'El usuario ya existe' };
    }
    
    // Hash de la contraseña
    const saltRounds = 10;
    const contrasenaHash = await bcrypt.hash(contrasena, saltRounds);
    
    // Insertar nuevo usuario
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, contrasena_hash, nombre_usuario, rol) 
       VALUES ($1, $2, $3, $4, 'usuario') 
       RETURNING id, nombre, email, nombre_usuario, rol, fecha_creacion`,
      [nombre, email, contrasenaHash, nombreUsuario]
    );
    
    return { 
      exito: true, 
      usuario: result.rows[0] 
    };
    
  } catch (error) {
    console.error('Error en registrarUsuario:', error);
    return { exito: false, error: 'Error del servidor' };
  }
};

// Cambiar contraseña
export const cambiarContrasena = async (usuarioId, contrasenaActual, nuevaContrasena) => {
  try {
    // 1. Obtener usuario actual
    const query = 'SELECT contrasena_hash FROM usuarios WHERE id = $1';
    const result = await pool.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return { exito: false, error: 'Usuario no encontrado' };
    }
    
    const usuario = result.rows[0];
    
    // 2. Verificar contraseña actual
    const contrasenaActualValida = await bcrypt.compare(contrasenaActual, usuario.contrasena_hash);
    
    if (!contrasenaActualValida) {
      return { exito: false, error: 'Contraseña actual incorrecta' };
    }
    
    // 3. Hash de la nueva contraseña
    const saltRounds = 10;
    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, saltRounds);
    
    // 4. Actualizar en la base de datos
    const updateQuery = 'UPDATE usuarios SET contrasena_hash = $1, updated_at = NOW() WHERE id = $2';
    await pool.query(updateQuery, [nuevaContrasenaHash, usuarioId]);
    
    return { exito: true };
    
  } catch (error) {
    console.error('Error en cambiarContrasena:', error);
    return { exito: false, error: 'Error del servidor' };
  }
};

// Login con Google
export const loginConGoogle = async (tokenGoogle) => {
  try {
    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokenGoogle}`
    );
    const datosGoogle = respuesta.data;

    console.log("Usuario autenticado con Google:", datosGoogle);

    // Buscar usuario en tu base de datos por email
    const query = 'SELECT * FROM usuarios WHERE email = $1';
    const result = await pool.query(query, [datosGoogle.email]);
    
    if (result.rows.length > 0) {
      // Usuario existe, devolverlo
      const usuario = result.rows[0];
      const { contrasena_hash, ...usuarioSinPassword } = usuario;
      
      return { 
        exito: true, 
        usuario: usuarioSinPassword 
      };
    } else {
      // Crear nuevo usuario si no existe
      const nombreUsuario = datosGoogle.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 10000);
      
      const insertQuery = `
        INSERT INTO usuarios (nombre, email, nombre_usuario, rol, foto_perfil) 
        VALUES ($1, $2, $3, 'usuario', $4) 
        RETURNING id, nombre, email, nombre_usuario, rol, foto_perfil
      `;
      
      const nuevoUsuario = await pool.query(insertQuery, [
        datosGoogle.name,
        datosGoogle.email,
        nombreUsuario,
        datosGoogle.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png'
      ]);
      
      return { 
        exito: true, 
        usuario: nuevoUsuario.rows[0] 
      };
    }
    
  } catch (error) {
    console.error('Error en loginConGoogle:', error);
    return { exito: false, error: 'Error autenticando con Google' };
  }
};

// Cerrar sesión
export const cerrarSesion = async (usuarioId) => {
  // Aquí podrías agregar lógica como invalidar tokens, etc.
  return { exito: true };
};