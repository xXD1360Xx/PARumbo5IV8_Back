import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import sgMail from '@sendgrid/mail';

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('process.env.SENDGRID_API_KEY');
  console.log('✅ SendGrid configurado');
}

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
    console.error('Error en login:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión' 
    });
  }
});

// POST /api/auth/registro - Registro manual (CORREGIDO)
router.post('/registro', async (req, res) => {
  console.log('📝 POST /registro');
  console.log('   Body recibido:', JSON.stringify(req.body) + '...');
  
  // OBTENER TODOS LOS CAMPOS DEL BODY, INCLUYENDO 'rol'
  const { nombre, email, contrasena, nombreUsuario, rol } = req.body;
  
  // Validar que 'rol' también esté presente
  if (!nombre || !email || !contrasena || !nombreUsuario || !rol) {
    console.error('❌ Campos faltantes en registro:', {
      nombre: !!nombre,
      email: !!email,
      contrasena: !!contrasena,
      nombreUsuario: !!nombreUsuario,
      rol: !!rol,
      bodyCompleto: req.body
    });
    
    return res.status(400).json({ 
      exito: false, 
      error: 'Todos los campos son requeridos (nombre, email, contraseña, nombreUsuario, rol)' 
    });
  }
  
  console.log('📋 Campos validados correctamente:', {
    nombre: nombre.substring(0, 20) + '...',
    email,
    contrasena: '***' + contrasena.substring(contrasena.length - 2),
    nombreUsuario,
    rol
  });
  
  try {
    const resultado = await registrarUsuario({
      nombre,
      email,
      contrasena,
      nombreUsuario,
      rol  // <-- Ahora SÍ está definida
    });
    
    if (resultado.exito) {
      console.log('✅ Registro exitoso para:', email);
      
      // Configurar cookie con el token
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
      console.error('🔧 Código error:', resultado.codigo);
      
      let statusCode = 400;
      if (resultado.codigo === 'DNS_ERROR' || resultado.error?.includes('base de datos')) {
        statusCode = 503;
      } else if (resultado.codigo === 'USUARIO_EXISTENTE' || 
                 resultado.codigo === 'EMAIL_EXISTENTE' || 
                 resultado.codigo === 'USERNAME_EXISTENTE') {
        statusCode = 409; // Conflict
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
    console.error('🔧 Stack:', error.stack);
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
    // Determinar asunto
    let asunto = 'Tu código de verificación - Rumbo';
    if (modo === 'crear') {
      asunto = 'Bienvenido a Rumbo - Código de verificación';
    } else if (modo === 'recuperar') {
      asunto = 'Recuperación de contraseña - Rumbo';
    }
    
    // Configurar el email
    const msg = {
      to: correo,
      from: 'cdmxrumbo@gmail.com',
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
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #8a003a, #cc3a6d); padding: 3px; border-radius: 12px;">
                <div style="background-color: white; padding: 20px 40px; border-radius: 10px;">
                  <div style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #8a003a; font-family: monospace;">
                    ${codigo}
                  </div>
                </div>
              </div>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
              <p style="color: #888; font-size: 12px; text-align: center;">
                Este código expirará en <strong>10 minutos</strong>.
              </p>
            </div>
          </div>
        </div>
      `,
    };
    
    // Enviar email
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

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', autenticarUsuario, (req, res) => {
  console.log('🚪 POST /logout');
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
  console.log('🔐 POST /cambiar-contrasena');
  const { contrasenaActual, nuevaContrasena } = req.body;
  const usuarioId = req.usuario.id;
  
  if (!contrasenaActual || !nuevaContrasena) {
    return res.status(400).json({ 
      exito: false, 
      error: 'Contraseña actual y nueva contraseña son requeridas' 
    });
  }
  
  if (nuevaContrasena.length < 6) {
    return res.status(400).json({
      exito: false,
      error: 'La contraseña debe tener al menos 6 caracteres'
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
    console.error('Error cambiando contraseña:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al cambiar contraseña' 
    });
  }
});

// GET /api/auth/verificar - Verificar token
router.get('/verificar', autenticarUsuario, (req, res) => {
  res.json({
    exito: true,
    usuario: req.usuario,
    mensaje: 'Token válido'
  });
});

// GET /api/auth/status - Status del servicio (pública)
router.get('/status', (req, res) => {
  res.json({
    exito: true,
    servicio: 'autenticacion',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;