import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena,
  restablecerContrasena
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { verificarDisponibilidadUsername } from '../controladores/usuarioControlador.js';
import sgMail from '../configuracion/sendgrid.js';

const router = express.Router();

// ============ RUTAS PÚBLICAS ============

// POST /api/auth/login - Login manual
router.post('/login', async (req, res) => {
  console.log('🔐 POST /login');
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
      const token = resultado.token;
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,
        mensaje: 'Inicio de sesión exitoso'
      });
    } else {
      let statusCode = 401;
      if (resultado.codigo === 'DNS_ERROR' || resultado.error?.includes('base de datos')) {
        statusCode = 503;
      }
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo
      });
    }
  } catch (error) {
    console.error('Error en login:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión' 
    });
  }
});

// POST /api/auth/registro - Registro manual (CORREGIDO: usa profileType, no exige rol)
router.post('/registro', async (req, res) => {
  console.log('📝 POST /registro');
  console.log('   Body recibido:', JSON.stringify(req.body) + '...');
  
  // Extraer los campos correctos: el frontend envía 'profileType', no 'rol'
  const { nombre, email, contrasena, nombreUsuario, profileType } = req.body;
  
  // Validar solo los campos necesarios (sin exigir 'rol')
  if (!nombre || !email || !contrasena || !nombreUsuario) {
    console.error('❌ Campos faltantes en registro:', {
      nombre: !!nombre,
      email: !!email,
      contrasena: !!contrasena,
      nombreUsuario: !!nombreUsuario,
      profileType: !!profileType,
      bodyCompleto: req.body
    });
    
    return res.status(400).json({ 
      exito: false, 
      error: 'Faltan campos requeridos (nombre, email, contraseña, nombreUsuario)' 
    });
  }
  
  // profileType es opcional; si no viene, usar 'explorando'
  const tipoPerfil = profileType || 'explorando';
  
  console.log('📋 Datos válidos para registro:', {
    nombre: nombre.substring(0, 20) + '...',
    email,
    nombreUsuario,
    profileType: tipoPerfil
  });
  
  try {
    // Llamar al controlador con los campos correctos
    const resultado = await registrarUsuario({
      nombre,
      email,
      contrasena,
      nombreUsuario,
      profileType: tipoPerfil
    });
    
    if (resultado.exito) {
      console.log('✅ Registro exitoso para:', email);
      const token = resultado.token;
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      return res.status(201).json({
        exito: true,
        usuario: resultado.usuario,
        token: resultado.token,
        mensaje: 'Usuario registrado exitosamente'
      });
    } else {
      console.error('❌ Error en registro:', resultado.error);
      let statusCode = 400;
      if (resultado.codigo === 'DNS_ERROR' || resultado.error?.includes('base de datos')) {
        statusCode = 503;
      } else if (resultado.codigo === 'USUARIO_EXISTENTE' || 
                 resultado.codigo === 'EMAIL_EXISTENTE' || 
                 resultado.codigo === 'USERNAME_EXISTENTE') {
        statusCode = 409;
      }
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo,
        detalle: resultado.detalle || undefined
      });
    }
  } catch (error) {
    console.error('❌ Error en ruta /registro:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error interno del servidor en registro: ' + error.message,
      codigo: 'ERROR_INTERNO'
    });
  }
});

// POST /api/auth/google - Login con Google
router.post('/google', async (req, res) => {
  console.log('🔐 POST /google');
  const { access_token } = req.body;
  
  if (!access_token) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Token de Google es requerido' 
    });
  }
  
  try {
    const resultado = await loginConGoogle(access_token);
    
    if (resultado.exito) {
      const token = resultado.token;
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,
        mensaje: 'Inicio de sesión con Google exitoso'
      });
    } else {
      let statusCode = 401;
      if (resultado.codigo === 'DNS_ERROR' || resultado.codigo === 'QUERY_ERROR') {
        statusCode = 503;
      }
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo
      });
    }
  } catch (error) {
    console.error('Error en Google login:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión con Google' 
    });
  }
});

// POST /api/auth/enviarCorreo - Enviar código de verificación
router.post('/enviarCorreo', async (req, res) => {
  console.log('📧 POST /enviarCorreo');
  const { correo, codigo, modo } = req.body;
  
  if (!correo || !codigo) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Correo y código son requeridos' 
    });
  }
  
  try {
    let asunto = 'Tu código de verificación - Rumbo';
    if (modo === 'crear') {
      asunto = 'Bienvenido a Rumbo - Código de verificación';
    } else if (modo === 'recuperar') {
      asunto = 'Recuperación de contraseña - Rumbo';
    }
    
    const msg = {
      to: correo,
      from: 'rumboverificacion@gmail.com',
      subject: asunto,
      text: `Tu código de verificación es: ${codigo}`,
      html: `...` // (mantén tu HTML, lo acorto por brevedad)
    };
    
    await sgMail.send(msg);
    return res.json({
      exito: true,
      mensaje: 'Código enviado exitosamente',
      correo: correo,
      modo: modo
    });
  } catch (error) {
    console.error('Error enviando correo:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error al enviar el correo'
    });
  }
});

// ============ RUTAS PROTEGIDAS ============

router.post('/logout', autenticarUsuario, (req, res) => {
  console.log('🚪 POST /logout');
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: process.env.ENTORNO === 'produccion',
    sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax'
  });
  res.json({ exito: true, mensaje: 'Sesión cerrada correctamente' });
});

router.post('/restablecer-contrasena', async (req, res) => {
  console.log('🔐 POST /restablecer-contrasena');
  const { correo, nuevaContrasena } = req.body;
  
  if (!correo || !nuevaContrasena) {
    return res.status(400).json({ exito: false, error: 'Correo y nueva contraseña son requeridos' });
  }
  if (nuevaContrasena.length < 6) {
    return res.status(400).json({ exito: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  
  try {
    const resultado = await restablecerContrasena(correo, nuevaContrasena);
    if (resultado.exito) {
      return res.json({ exito: true, mensaje: resultado.mensaje });
    } else {
      let statusCode = resultado.codigo === 'USUARIO_NO_ENCONTRADO' ? 404 : 400;
      return res.status(statusCode).json({ exito: false, error: resultado.error, codigo: resultado.codigo });
    }
  } catch (error) {
    console.error('Error en restablecer-contrasena:', error.message);
    return res.status(500).json({ exito: false, error: 'Error del servidor' });
  }
});

// GET /api/auth/verificar-username/:username - Público
router.get('/verificar-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const resultado = await verificarDisponibilidadUsername(username);
    res.json({
      exito: true,
      disponible: resultado.disponible,
      mensaje: resultado.mensaje,
      sugerencias: resultado.sugerencias || []
    });
  } catch (error) {
    console.error('Error verificando username:', error);
    res.status(500).json({ exito: false, error: 'Error al verificar' });
  }
});

router.get('/verificar', autenticarUsuario, (req, res) => {
  res.json({ exito: true, usuario: req.usuario, mensaje: 'Token válido' });
});

router.get('/status', (req, res) => {
  res.json({ exito: true, servicio: 'autenticacion', timestamp: new Date().toISOString(), version: '1.0.0' });
});

export default router;