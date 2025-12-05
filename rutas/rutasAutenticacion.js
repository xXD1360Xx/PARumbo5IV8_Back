import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import sgMail from '@sendgrid/mail';

// Configurar SendGrid directamente
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const router = express.Router();

// Ruta de diagnóstico
router.get('/debug-env-now', (req, res) => {
  res.json({
    success: true,
    sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
    sendgrid_key: process.env.SENDGRID_API_KEY ? '***' + process.env.SENDGRID_API_KEY.slice(-10) : null,
    node_env: process.env.NODE_ENV,
    entorno: process.env.ENTORNO
  });
});

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

// Ruta de prueba simple
router.get('/status', (req, res) => {
  res.json({
    exito: true,
    servicio: 'autenticacion',
    timestamp: new Date().toISOString(),
    entorno: process.env.ENTORNO || 'desarrollo'
  });
});

// POST /enviarCorreo - Enviar código de verificación
router.post('/enviarCorreo', async (req, res) => {
  const { correo, codigo, modo } = req.body;
  
  if (!correo) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Correo electrónico es requerido' 
    });
  }
  
  if (!codigo) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Código de verificación es requerido' 
    });
  }
  
  try {
    // Determinar asunto según el modo
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

export default router;