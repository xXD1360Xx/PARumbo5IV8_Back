import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// POST /autenticacion/login - Login manual
router.post('/login', async (req, res) => {
  const { identificador, contrasena } = req.body;
  
  if (!identificador || !contrasena) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Email/usuario y contraseña son requeridos' 
    });
  }
  
  try {
    const resultado = await iniciarSesion(identificador, contrasena);
    
    if (resultado.exito) {
      const token = resultado.token;  // ← Usa el token del controlador
      
      // Configurar cookie
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,  // ← ¡Agrega esto también!
        mensaje: 'Inicio de sesión exitoso'
      });
    } else {
      return res.status(401).json({
        exito: false,
        error: resultado.error
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión' 
    });
  }
});

// POST /autenticacion/registro - Registro manual
router.post('/registro', async (req, res) => {
  const { nombre, email, contrasena, nombreUsuario } = req.body;
  
  if (!nombre || !email || !contrasena || !nombreUsuario) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Todos los campos son requeridos' 
    });
  }
  
  try {
    const resultado = await registrarUsuario({
      nombre,
      email,
      contrasena,
      nombreUsuario
    });
    
    if (resultado.exito) {
      return res.status(201).json({
        exito: true,
        usuario: resultado.usuario,
        mensaje: 'Usuario registrado exitosamente'
      });
    } else {
      return res.status(400).json({
        exito: false,
        error: resultado.error
      });
    }
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor en registro' 
    });
  }
});

// POST /autenticacion/google - Login con Google
router.post('/google', async (req, res) => {
  const { access_token } = req.body;
  
  if (!access_token) {
    console.error("❌ [RUTA] No se recibió access_token");
    return res.status(400).json({ 
      exito: false, 
      error: 'Token de Google es requerido' 
    });
  }
  
  console.log("🔍 [RUTA] Token recibido:", access_token?.substring(0, 20) + '...');
  
  try {
    const resultado = await loginConGoogle(access_token);
    
    if (resultado.exito) {
      const { id, rol, email } = resultado.usuario;
      
      // 🚨 ¡CRÍTICO! El controlador YA generó un token, NO generar otro
      const token = resultado.token;  // ← Usa el token del controlador
      
      console.log("✅ [RUTA] Token JWT recibido del controlador:", token?.substring(0, 20) + '...');

      // Configurar cookie
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      // 🚨 ¡IMPORTANTE! Devuelve el token en la respuesta JSON
      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,  // ← ¡¡¡AGREGA ESTO!!!
        mensaje: 'Inicio de sesión con Google exitoso'
      });
    } else {
      return res.status(401).json({
        exito: false,
        error: resultado.error
      });
    }
  } catch (error) {
    console.error('Error en login con Google:', error);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión con Google' 
    });
  }
});


// POST /autenticacion/logout - Cerrar sesión
router.post('/logout', autenticarUsuario, (req, res) => {
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: process.env.ENTORNO === 'produccion',
    sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax'
  });
  
  res.json({ 
    exito: true, 
    mensaje: 'Sesión cerrada correctamente' 
  });
});

// POST /autenticacion/cambiar-contrasena - Cambiar contraseña
router.post('/cambiar-contrasena', autenticarUsuario, async (req, res) => {
  const { contrasenaActual, nuevaContrasena } = req.body;
  const usuarioId = req.usuario.id;
  
  if (!contrasenaActual || !nuevaContrasena) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Contraseña actual y nueva contraseña son requeridas' 
    });
  }
  
  // Validar que la nueva contraseña sea segura
  const regex = /^(?=.*\d).{6,}$/;
  if (!regex.test(nuevaContrasena)) {
    return res.status(400).json({
      exito: false,
      error: 'La contraseña debe tener al menos 6 caracteres y contener al menos un número'
    });
  }
  
  try {
    const resultado = await cambiarContrasena(usuarioId, contrasenaActual, nuevaContrasena);
    
    if (resultado.exito) {
      return res.json({
        exito: true,
        mensaje: 'Contraseña actualizada correctamente'
      });
    } else {
      return res.status(400).json({
        exito: false,
        error: resultado.error
      });
    }
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al cambiar contraseña' 
    });
  }
});

// GET /autenticacion/verificar - Verificar token
router.get('/verificar', autenticarUsuario, (req, res) => {
  res.json({
    exito: true,
    usuario: req.usuario,
    mensaje: 'Token válido'
  });
});

export default router;