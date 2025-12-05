import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from './controladores/autenticacionControlador.js';
import { autenticarUsuario, logAutenticado  } from './middleware/autenticacionMiddleware.js';
import sgMail from '@sendgrid/mail';

// ============ DEBUG INICIAL ============
console.log('🔧 rutasAutenticacion.js - CARGA INICIADA');
console.log('📍 Directorio actual: /rutas/');
console.log('📧 SendGrid:', process.env.SENDGRID_API_KEY ? '✓ CONFIGURADO' : '✗ NO CONFIGURADO');

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid API Key configurada');
} else {
  console.error('❌ ERROR CRÍTICO: SENDGRID_API_KEY no encontrada');
  console.log('🔍 Variables de entorno disponibles:', Object.keys(process.env).filter(k => 
    k.includes('SENDGRID') || k.includes('EMAIL') || k.includes('ENTORNO')
  ));
}

const router = express.Router();

// ============ RUTAS DE DEBUG ============

// Ruta PING para verificar router
router.get('/ping', (req, res) => {
  console.log('🏓 GET /api/auth/ping');
  res.json({ 
    success: true, 
    message: 'Router de autenticación funcionando correctamente',
    timestamp: new Date().toISOString(),
    sendgrid_configured: !!process.env.SENDGRID_API_KEY,
    environment: process.env.ENTORNO || 'desarrollo'
  });
});

// Ruta de diagnóstico de entorno
router.get('/debug-env', (req, res) => {
  console.log('🔍 GET /api/auth/debug-env');
  res.json({
    success: true,
    sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
    sendgrid_key_prefix: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 5) + '...' : null,
    node_env: process.env.NODE_ENV,
    entorno: process.env.ENTORNO,
    email_from_fixed: 'cdmxrumbo@gmail.com',
    timestamp: new Date().toISOString()
  });
});

// Status del servicio
router.get('/status', (req, res) => {
  console.log('📡 GET /api/auth/status');
  res.json({
    exito: true,
    servicio: 'autenticacion',
    timestamp: new Date().toISOString(),
    entorno: process.env.ENTORNO || 'desarrollo',
    version: '1.0.0',
    rutas_disponibles: [
      'POST /login',
      'POST /registro', 
      'POST /enviarCorreo',
      'POST /google',
      'POST /logout',
      'POST /cambiar-contrasena',
      'GET /verificar',
      'GET /ping',
      'GET /debug-env',
      'GET /status'
    ]
  });
});

// ============ RUTAS PRINCIPALES ============

// POST /api/auth/login - Login manual
router.post('/login', async (req, res) => {
  console.log('🔐 POST /api/auth/login');
  console.log('   Body:', { 
    identificador: req.body.identificador ? '✓' : '✗',
    tieneContrasena: !!req.body.contrasena 
  });
  
  const { identificador, contrasena } = req.body;
  
  if (!identificador || !contrasena) {
    console.log('❌ Faltan credenciales');
    return res.status(400).json({ 
      exito: false, 
      error: 'Email/usuario y contraseña son requeridos' 
    });
  }
  
  try {
    const resultado = await iniciarSesion(identificador, contrasena);
    console.log(`📊 Resultado login: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    if (resultado.exito) {
      const token = resultado.token;
      
      // Configurar cookie
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
    console.error('🔥 Error en login:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión' 
    });
  }
});

// POST /api/auth/registro - Registro manual
router.post('/registro', async (req, res) => {
  console.log('📝 POST /api/auth/registro');
  console.log('   Body recibido');
  
  const { nombre, email, contrasena, nombreUsuario } = req.body;
  
  if (!nombre || !email || !contrasena || !nombreUsuario) {
    console.log('❌ Faltan campos requeridos');
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
    
    console.log(`📊 Resultado registro: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    if (resultado.exito) {
      return res.status(201).json({
        exito: true,
        usuario: resultado.usuario,
        token: resultado.token,
        mensaje: 'Usuario registrado exitosamente'
      });
    } else {
      let statusCode = 400;
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
    console.error('🔥 Error en registro:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor en registro' 
    });
  }
});

// POST /api/auth/google - Login con Google
router.post('/google', async (req, res) => {
  console.log('🔐 POST /api/auth/google');
  const { access_token } = req.body;
  
  if (!access_token) {
    console.log('❌ No se recibió access_token');
    return res.status(400).json({ 
      exito: false, 
      error: 'Token de Google es requerido' 
    });
  }
  
  try {
    const resultado = await loginConGoogle(access_token);
    console.log(`📊 Resultado Google login: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
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
    console.error('🔥 Error en Google login:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión con Google' 
    });
  }
});

// POST /api/auth/enviarCorreo - Enviar código de verificación
router.post('/enviarCorreo', async (req, res) => {
  console.log('📧 POST /api/auth/enviarCorreo');
  console.log('   Body:', { 
    correo: req.body.correo ? '✓' : '✗', 
    codigo: req.body.codigo ? '✓' : '✗',
    modo: req.body.modo || 'no especificado'
  });
  
  const { correo, codigo, modo } = req.body;
  
  if (!correo) {
    console.log('❌ Falta correo');
    return res.status(400).json({ 
      exito: false, 
      error: 'Correo electrónico es requerido' 
    });
  }
  
  if (!codigo) {
    console.log('❌ Falta código');
    return res.status(400).json({ 
      exito: false, 
      error: 'Código de verificación es requerido' 
    });
  }
  
  try {
    console.log(`📤 Enviando correo a: ${correo}`);
    console.log(`🔢 Código: ${codigo.substring(0, 3)}...`);
    
    // Determinar asunto
    let asunto = 'Tu código de verificación - Rumbo';
    if (modo === 'crear') {
      asunto = 'Bienvenido a Rumbo - Código de verificación';
    } else if (modo === 'recuperar') {
      asunto = 'Recuperación de contraseña - Rumbo';
    }
    
    // Configurar el email - CORREO FIJO
    const msg = {
      to: correo,
      from: 'cdmxrumbo@gmail.com',  // ← CORREO FIJO DIRECTAMENTE
      subject: asunto,
      text: `Tu código de verificación es: ${codigo}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 30px; border-radius: 15px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8a003a; font-size: 28px; margin-bottom: 10px;">RUMBO</h1>
            <p style="color: #666; font-size: 14px; margin-top: 0;">Plataforma de orientación profesional</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px; text-align: center;">
              ${modo === 'crear' ? '¡Bienvenido a Rumbo!' : 'Verificación de cuenta'}
            </h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              ${modo === 'crear' 
                ? 'Estás a un paso de crear tu cuenta en Rumbo. Usa el siguiente código para completar tu registro:' 
                : modo === 'recuperar'
                ? 'Has solicitado recuperar tu contraseña. Usa el siguiente código para continuar:'
                : 'Usa el siguiente código para verificar tu cuenta:'}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #8a003a, #cc3a6d); padding: 3px; border-radius: 12px;">
                <div style="background-color: white; padding: 20px 40px; border-radius: 10px;">
                  <div style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #8a003a; font-family: monospace;">
                    ${codigo}
                  </div>
                </div>
              </div>
            </div>
            
            <p style="color: #777; font-size: 14px; text-align: center; margin-bottom: 30px;">
              Este código expirará en <strong>10 minutos</strong>.
            </p>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
              <p style="color: #888; font-size: 12px; text-align: center; margin-bottom: 5px;">
                Si no solicitaste este código, puedes ignorar este mensaje.
              </p>
              <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
                © 2025 Rumbo - Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      `,
    };
    
    // Enviar email
    await sgMail.send(msg);
    console.log('✅ Correo enviado exitosamente');
    
    return res.json({
      exito: true,
      mensaje: 'Código enviado exitosamente',
      correo: correo,
      modo: modo
    });
    
  } catch (error) {
    console.error('🔥 ERROR enviando correo:', error.message);
    
    // Log detallado para SendGrid errors
    if (error.response) {
      console.error('🔧 SendGrid response:', error.response.body);
    }
    
    return res.status(500).json({ 
      exito: false, 
      error: 'Error al enviar el correo',
      detalle: process.env.ENTORNO === 'desarrollo' ? error.message : undefined
    });
  }
});

// ============ RUTAS PROTEGIDAS ============

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', autenticarUsuario, (req, res) => {
  console.log('🚪 POST /api/auth/logout');
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

// POST /api/auth/cambiar-contrasena - Cambiar contraseña
router.post('/cambiar-contrasena', autenticarUsuario, async (req, res) => {
  console.log('🔐 POST /api/auth/cambiar-contrasena');
  const { contrasenaActual, nuevaContrasena } = req.body;
  const usuarioId = req.usuario.id;
  
  if (!contrasenaActual || !nuevaContrasena) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Contraseña actual y nueva contraseña son requeridas' 
    });
  }
  
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
    console.error('🔥 Error cambiando contraseña:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al cambiar contraseña' 
    });
  }
});

// GET /api/auth/verificar - Verificar token
router.get('/verificar', autenticarUsuario, logAutenticado, (req, res) => {
  res.json({
    exito: true,
    usuario: req.usuario,
    mensaje: 'Token válido'
  });
});

// ============ FINAL ============
console.log('✅ rutasAutenticacion.js - CARGA COMPLETADA');
console.log('📡 Rutas montadas en /api/auth:');
console.log('   GET  /ping');
console.log('   GET  /debug-env');
console.log('   GET  /status');
console.log('   POST /login');
console.log('   POST /registro');
console.log('   POST /enviarCorreo ← CRÍTICA');
console.log('   POST /google');
console.log('   POST /logout');
console.log('   POST /cambiar-contrasena');
console.log('   GET  /verificar');

export default router;