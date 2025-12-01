import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login manual (sin req, res)
export const iniciarSesion = async (identificador, contrasena) => {
  try {
    // Tu lógica de base de datos aquí
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
    
    const usuarioExistente = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1 OR nombre_usuario = $2',
      [email, nombreUsuario]
    );
    
    if (usuarioExistente.rows.length > 0) {
      return { exito: false, error: 'El usuario ya existe' };
    }
    
    const saltRounds = 10;
    const contrasenaHash = await bcrypt.hash(contrasena, saltRounds);
    
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

// Login con Google (MODIFICADO para que funcione con tus rutas)
export const loginConGoogle = async (tokenGoogle) => {
  try {
    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokenGoogle}`
    );
    const datosUsuario = respuesta.data;

    console.log("Usuario autenticado con Google:", datosUsuario);

    // Buscar o crear usuario en tu base de datos
    // Por ahora devolvemos un mock
    return { 
      exito: true, 
      usuario: {
        id: 1,
        nombre: datosUsuario.name,
        email: datosUsuario.email,
        rol: 'usuario'
      }
    };
  } catch (error) {
    console.error('Error en loginConGoogle:', error);
    return { exito: false, error: 'Error autenticando con Google' };
  }
};

// Cerrar sesión
export const cerrarSesion = async (usuarioId) => {
  return { exito: true };
};