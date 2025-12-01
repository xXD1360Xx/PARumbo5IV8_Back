import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  cerrarSesion,
  loginConGoogle
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
      const { id, rol, email } = resultado.usuario;
      
      // Generar token JWT
      const token = jwt.sign(
        { id, rol, email }, 
        process.env.JWT_SECRETO, 
        { expiresIn: '24h' }
      );

      // Configurar cookie
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        path: '/'
      });

      return res.json({
        exito: true,
        usuario: resultado.usuario,
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
  const { tokenGoogle } = req.body;
  
  if (!tokenGoogle) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Token de Google es requerido' 
    });
  }
  
  try {
    const resultado = await loginConGoogle(tokenGoogle);
    
    if (resultado.exito) {
      const { id, rol, email } = resultado.usuario;
      
      // Generar token JWT
      const token = jwt.sign(
        { id, rol, email }, 
        process.env.JWT_SECRETO, 
        { expiresIn: '24h' }
      );

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

// GET /autenticacion/verificar - Verificar token
router.get('/verificar', autenticarUsuario, (req, res) => {
  res.json({
    exito: true,
    usuario: req.usuario,
    mensaje: 'Token válido'
  });
});

export default router;