import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ==================== LOGIN NORMAL ====================
export const iniciarSesion = async (identificador, contrasena) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Login manual para:", identificador);
    
    if (!identificador || !contrasena) {
      return { 
        exito: false, 
        error: 'Credenciales incompletas',
        codigo: 'CREDENCIALES_INCOMPLETAS'
      };
    }
    
    client = await pool.connect();
    
    const query = `
      SELECT 
        id, 
        "fullName" as full_name, 
        email, 
        username, 
        role, 
        password, 
        "createdAt" as created_at, 
        "avatarUrl" as avatar_url, 
        "bannerUrl" as banner_url, 
        bio
      FROM "User" 
      WHERE email = $1 OR username = $1
    `;
    
    const result = await client.query(query, [identificador.trim()]);
    
    if (result.rows.length === 0) {
      return { exito: false, error: 'Usuario no encontrado', codigo: 'USUARIO_NO_ENCONTRADO' };
    }
    
    const usuario = result.rows[0];
    
    if (!usuario.password || typeof usuario.password !== 'string') {
      return { exito: false, error: 'Error en datos del usuario', codigo: 'DATOS_USUARIO_INVALIDOS' };
    }
    
    const hash = usuario.password.trim();
    const esHashBcrypt = hash.startsWith('$2');
    const esHashSHA256 = hash.length === 64 && /^[a-f0-9]{64}$/i.test(hash);
    
    let contrasenaValida = false;
    
    if (esHashBcrypt) {
      contrasenaValida = await bcrypt.compare(contrasena, hash);
    } 
    else if (esHashSHA256) {
      const hashCalculado = crypto.createHash('sha256').update(contrasena).digest('hex').toLowerCase();
      contrasenaValida = hashCalculado === hash.toLowerCase();
    }
    
    if (!contrasenaValida) {
      return { exito: false, error: 'Contraseña incorrecta', codigo: 'CONTRASENA_INCORRECTA' };
    }
    
    const usuarioRespuesta = {
      id: usuario.id,
      nombre: usuario.full_name,
      email: usuario.email,
      nombre_usuario: usuario.username,
      rol: usuario.role || 'AUTHOR',
      foto_perfil: usuario.avatar_url,
      banner_url: usuario.banner_url,
      bio: usuario.bio,
      fecha_creacion: usuario.created_at
    };
    
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.full_name, rol: usuario.role || 'AUTHOR' },
      process.env.JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    return { exito: true, usuario: usuarioRespuesta, token };
    
  } catch (error) {
    console.error('❌ Error en iniciarSesion:', error.message);
    return { exito: false, error: 'Error del servidor', codigo: 'ERROR_SERVIDOR' };
  } finally {
    if (client) client.release();
  }
};

// ==================== REGISTRO MANUAL ====================
export const registrarUsuario = async (datosUsuario) => {
  console.log("🔍 [BACKEND] Datos recibidos:", JSON.stringify(datosUsuario, null, 2));
  
  // El frontend envía: nombre, email, contrasena, nombreUsuario, profileType
  const { nombre, email, contrasena, nombreUsuario, profileType } = datosUsuario;
  
  // Role fijo para todos los registros (la web espera AUTHOR, STUDENT o ADMIN)
  const finalRole = 'AUTHOR';          // Usuario normal
  const finalProfileType = profileType || 'explorando';  // Perfil seleccionado
  
  let client;
  
  try {
    // Validaciones básicas
    if (!nombre?.trim()) return { exito: false, error: 'El nombre es requerido', codigo: 'NOMBRE_REQUERIDO' };
    if (!email?.trim()) return { exito: false, error: 'El email es requerido', codigo: 'EMAIL_REQUERIDO' };
    if (!contrasena?.trim()) return { exito: false, error: 'La contraseña es requerida', codigo: 'CONTRASENA_REQUERIDA' };
    if (!nombreUsuario?.trim()) return { exito: false, error: 'El nombre de usuario es requerido', codigo: 'USERNAME_REQUERIDO' };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { exito: false, error: 'Formato de email inválido', codigo: 'EMAIL_INVALIDO' };
    if (contrasena.length < 6) return { exito: false, error: 'La contraseña debe tener al menos 6 caracteres', codigo: 'CONTRASENA_CORTA' };
    if (nombreUsuario.length < 3) return { exito: false, error: 'El nombre de usuario debe tener al menos 3 caracteres', codigo: 'USERNAME_CORTO' };
    
    client = await pool.connect();
    
    // Verificar existencia
    const existe = await client.query(
      'SELECT id FROM "User" WHERE email = $1 OR username = $2',
      [email.trim().toLowerCase(), nombreUsuario.trim()]
    );
    if (existe.rows.length > 0) {
      const conflicto = existe.rows[0].email === email ? 'EMAIL_EXISTENTE' : 'USERNAME_EXISTENTE';
      return { exito: false, error: 'El usuario ya existe', codigo: conflicto };
    }
    
    // Hash con bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(contrasena, saltRounds);
    const userId = uuidv4();
    
    const insertQuery = `
      INSERT INTO "User" (
        id, username, "fullName", email, password, role, "profileType",
        "createdAt", "updatedAt", provider, "isActive"
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 'local', true)
      RETURNING id, username, "fullName" as full_name, email, role, "profileType", "createdAt" as created_at
    `;
    
    const result = await client.query(insertQuery, [
      userId,
      nombreUsuario.trim(),
      nombre.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      finalRole,
      finalProfileType
    ]);
    
    const nuevoUsuario = result.rows[0];
    
    const token = jwt.sign(
      { id: nuevoUsuario.id, email: nuevoUsuario.email, nombre: nuevoUsuario.full_name, rol: nuevoUsuario.role },
      process.env.JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    return {
      exito: true,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.full_name,
        email: nuevoUsuario.email,
        nombre_usuario: nuevoUsuario.username,
        rol: nuevoUsuario.role,
        profileType: nuevoUsuario.profileType,
        fecha_creacion: nuevoUsuario.created_at
      },
      token
    };
    
  } catch (error) {
    console.error('❌ Error en registrarUsuario:', error.message);
    return { exito: false, error: 'Error del servidor: ' + error.message, codigo: 'ERROR_SERVIDOR' };
  } finally {
    if (client) client.release();
  }
};

// ==================== LOGIN CON GOOGLE ====================
export const loginConGoogle = async (accessToken) => {
  let client;
  
  try {
    if (!accessToken?.trim()) {
      return { exito: false, error: 'Token inválido', codigo: 'TOKEN_INVALIDO' };
    }
    
    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`,
      { timeout: 10000, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
    );
    
    client = await pool.connect();
    
    // Buscar o crear usuario
    const query = `
      SELECT id, "fullName" as nombre, email, username as nombre_usuario, role as rol, 
             "avatarUrl" as foto_perfil, "createdAt" as fecha_creacion, password
      FROM "User" WHERE email = $1
    `;
    let result = await client.query(query, [respuesta.data.email]);
    let usuario;
    
    if (result.rows.length > 0) {
      usuario = result.rows[0];
      if (respuesta.data.picture && !usuario.foto_perfil) {
        await client.query('UPDATE "User" SET "avatarUrl" = $1 WHERE id = $2', [respuesta.data.picture, usuario.id]);
        usuario.foto_perfil = respuesta.data.picture;
      }
    } else {
      // Crear nuevo usuario
      const userId = uuidv4();
      const nombreUsuarioBase = respuesta.data.name ? respuesta.data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) : 'usuario';
      const randomNum = Math.floor(Math.random() * 10000);
      const username = `${nombreUsuarioBase}_${randomNum}`;
      const fullName = respuesta.data.name || respuesta.data.email.split('@')[0];
      const avatar = respuesta.data.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';
      
      const insertQuery = `
        INSERT INTO "User" (id, username, "fullName", email, role, "avatarUrl", 
          "createdAt", "updatedAt", provider, "isActive") 
        VALUES ($1, $2, $3, $4, 'AUTHOR', $5, NOW(), NOW(), 'google', true) 
        RETURNING id, username as nombre_usuario, "fullName" as nombre, email, role as rol, 
                  "avatarUrl" as foto_perfil, "createdAt" as fecha_creacion
      `;
      const newUser = await client.query(insertQuery, [userId, username, fullName, respuesta.data.email, avatar]);
      usuario = newUser.rows[0];
    }
    
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    return {
      exito: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
        foto_perfil: usuario.foto_perfil,
        fecha_creacion: usuario.fecha_creacion
      },
      token
    };
    
  } catch (error) {
    console.error('❌ Error en loginConGoogle:', error.message);
    let mensaje = 'Error autenticando con Google';
    let codigo = 'ERROR_GOOGLE';
    if (error.response?.status === 401) { mensaje = 'Token de Google inválido o expirado'; codigo = 'GOOGLE_TOKEN_INVALIDO'; }
    return { exito: false, error: mensaje, codigo };
  } finally {
    if (client) client.release();
  }
};

// ==================== CAMBIAR CONTRASEÑA ====================
export const cambiarContrasena = async (usuarioId, contrasenaActual, nuevaContrasena) => {
  let client;
  try {
    if (nuevaContrasena.length < 6) {
      return { exito: false, error: 'La nueva contraseña debe tener al menos 6 caracteres', codigo: 'CONTRASENA_CORTA' };
    }
    client = await pool.connect();
    
    const result = await client.query('SELECT password FROM "User" WHERE id = $1', [usuarioId]);
    if (result.rows.length === 0) return { exito: false, error: 'Usuario no encontrado', codigo: 'USUARIO_NO_ENCONTRADO' };
    
    const hashActual = result.rows[0].password;
    let valida = false;
    if (hashActual.startsWith('$2')) {
      valida = await bcrypt.compare(contrasenaActual, hashActual);
    } else if (hashActual.length === 64 && /^[a-f0-9]{64}$/i.test(hashActual)) {
      const hashCalc = crypto.createHash('sha256').update(contrasenaActual).digest('hex').toLowerCase();
      valida = hashCalc === hashActual.toLowerCase();
    }
    if (!valida) return { exito: false, error: 'Contraseña actual incorrecta', codigo: 'CONTRASENA_ACTUAL_INCORRECTA' };
    
    const nuevaHash = await bcrypt.hash(nuevaContrasena, 10);
    await client.query('UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2', [nuevaHash, usuarioId]);
    return { exito: true, mensaje: 'Contraseña actualizada correctamente' };
  } catch (error) {
    console.error('❌ Error en cambiarContrasena:', error.message);
    return { exito: false, error: 'Error del servidor', codigo: 'ERROR_SERVIDOR' };
  } finally { if (client) client.release(); }
};

// ==================== RESTABLECER CONTRASEÑA ====================
export const restablecerContrasena = async (correo, nuevaContrasena) => {
  let client;
  try {
    if (nuevaContrasena.length < 6) return { exito: false, error: 'La nueva contraseña debe tener al menos 6 caracteres', codigo: 'CONTRASENA_CORTA' };
    client = await pool.connect();
    const result = await client.query('SELECT id FROM "User" WHERE email = $1', [correo]);
    if (result.rows.length === 0) return { exito: false, error: 'Usuario no encontrado', codigo: 'USUARIO_NO_ENCONTRADO' };
    const nuevaHash = await bcrypt.hash(nuevaContrasena, 10);
    await client.query('UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2', [nuevaHash, result.rows[0].id]);
    return { exito: true, mensaje: 'Contraseña restablecida correctamente' };
  } catch (error) {
    console.error('❌ Error en restablecerContrasena:', error.message);
    return { exito: false, error: 'Error del servidor', codigo: 'ERROR_SERVIDOR' };
  } finally { if (client) client.release(); }
};

// ==================== CERRAR SESIÓN ====================
export const cerrarSesion = async (usuarioId) => {
  console.log("🔍 [CONTROLADOR] Cerrar sesión para usuario ID:", usuarioId);
  return { exito: true, mensaje: 'Sesión cerrada correctamente' };
};

// ==================== DEBUG ====================
export const obtenerEstructuraUsers = async () => {
  let client;
  try {
    client = await pool.connect();
    const columnas = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'
      ORDER BY ordinal_position
    `);
    columnas.rows.forEach(col => console.log(`   ${col.column_name} (${col.data_type})`));
    return columnas.rows;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  } finally { if (client) client.release(); }
};