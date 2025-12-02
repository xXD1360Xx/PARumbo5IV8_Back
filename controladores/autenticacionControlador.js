import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login normal (usuario/contraseña)
export const iniciarSesion = async (identificador, contrasena) => {
  try {
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
    
    // 🆕 Generar token aquí también para consistencia
    const JWT_SECRETO = process.env.JWT_SECRETO || 'tu_secreto_jwt';
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email,
        rol: usuario.rol 
      },
      JWT_SECRETO,
      { expiresIn: '24h' }
    );
    
    return { 
      exito: true, 
      usuario: usuarioSinPassword,
      token: token  // ← Agregar token
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

// Login con Google - VERSIÓN CORREGIDA
// En tu controlador de Google login
export const loginConGoogle = async (accessToken) => {
  try {
    console.log("🔍 [BACKEND CONTROLADOR] Token recibido:", accessToken?.substring(0, 30) + '...');
    
    if (!accessToken || accessToken.trim() === '') {
      console.error("❌ [BACKEND] Token vacío o inválido");
      return { exito: false, error: 'Token inválido' };
    }
    
    console.log("🔍 [BACKEND] Llamando a Google API...");
    
    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`,
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log("✅ [BACKEND] Respuesta de Google recibida:", {
      email: respuesta.data.email,
      name: respuesta.data.name,
      id: respuesta.data.id
    });

    // Buscar usuario en tu base de datos por email
    const query = 'SELECT * FROM usuarios WHERE email = $1';
    const result = await pool.query(query, [respuesta.data.email]);
    
    let usuario;
    
    if (result.rows.length > 0) {
      // Usuario existe
      usuario = result.rows[0];
      const { contrasena_hash, ...usuarioSinPassword } = usuario;
      usuario = usuarioSinPassword;
    } else {
      // Crear nuevo usuario
      const nombreUsuario = respuesta.data.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 10000);
      
      const insertQuery = `
        INSERT INTO usuarios (nombre, email, nombre_usuario, rol, foto_perfil) 
        VALUES ($1, $2, $3, 'usuario', $4) 
        RETURNING id, nombre, email, nombre_usuario, rol, foto_perfil
      `;
      
      const nuevoUsuario = await pool.query(insertQuery, [
        respuesta.data.name,
        respuesta.data.email,
        nombreUsuario,
        respuesta.data.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png'
      ]);
      
      usuario = nuevoUsuario.rows[0];
    }
    
    // 🔴 CRÍTICO: Generar un token JWT para tu app
    const JWT_SECRETO = process.env.JWT_SECRETO || 'tu_secreto_jwt'; // Asegúrate de configurar esto
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email,
        rol: usuario.rol 
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ [BACKEND] Token JWT generado:", token.substring(0, 30) + '...');
    
    return {  // ← AHORA INCLUYE EL TOKEN
      exito: true, 
      usuario: usuario,
      token: token  // ← AÑADE ESTO
    };
    
  } catch (error) {
    console.error('❌ [BACKEND CONTROLADOR] Error COMPLETO:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    return { exito: false, error: 'Error autenticando con Google: ' + error.message };
  }
};

// Cerrar sesión
export const cerrarSesion = async (usuarioId) => {
  // Aquí podrías agregar lógica como invalidar tokens, etc.
  return { exito: true };
};