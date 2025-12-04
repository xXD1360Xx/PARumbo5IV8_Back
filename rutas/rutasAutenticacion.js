import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import sgMail from '@sendgrid/mail';

// CONFIGURACIÓN SEGURA DE SENDGRID
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

console.log('🔍 Variables de SendGrid:');
console.log('  - SENDGRID_API_KEY:', SENDGRID_API_KEY ? '✅ Presente' : '❌ FALTANTE');
console.log('  - EMAIL_FROM:', EMAIL_FROM || '❌ FALTANTE');

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid configurado correctamente');
} else {
  console.error('🚨 CRÍTICO: SENDGRID_API_KEY no está definida');
  console.error('🚨 Verifica las variables en Northflank');
}

const router = express.Router();

// Middleware de logging para todas las rutas
router.use((req, res, next) => {
  console.log(`📥 [RUTA] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Ruta de diagnóstico - DEBE IR AL PRINCIPIO
router.get('/debug-env-now', (req, res) => {
  console.log('🔍 DEBUG ENV - Variables disponibles:');
  console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SI' : 'NO');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'NO');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('ENTORNO:', process.env.ENTORNO);
  
  res.json({
    success: true,
    sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
    email_from_exists: !!process.env.EMAIL_FROM,
    sendgrid_key: process.env.SENDGRID_API_KEY ? '***' + process.env.SENDGRID_API_KEY.slice(-10) : null,
    email_from: process.env.EMAIL_FROM,
    all_env_keys: Object.keys(process.env).filter(key => 
      key.includes('SENDGRID') || 
      key.includes('EMAIL') || 
      key.includes('NODE') ||
      key.includes('ENTORNO')
    )
  });
});

// POST /autenticacion/login - Login manual
router.post('/login', async (req, res) => {
  console.log('🔐 [RUTA LOGIN] Datos recibidos:', { 
    identificador: req.body.identificador ? '✓' : '✗',
    tieneContrasena: !!req.body.contrasena 
  });
  
  const { identificador, contrasena } = req.body;
  
  if (!identificador || !contrasena) {
    console.log('❌ [RUTA LOGIN] Faltan credenciales');
    return res.status(400).json({ 
      exito: false, 
      error: 'Email/usuario y contraseña son requeridos' 
    });
  }
  
  try {
    const resultado = await iniciarSesion(identificador, contrasena);
    
    console.log(`📊 [RUTA LOGIN] Resultado: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    if (resultado.exito) {
      const token = resultado.token;
      
      console.log('🔑 [RUTA LOGIN] Token generado:', token?.substring(0, 20) + '...');
      
      // Configurar cookie (opcional, depende de tu frontend)
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días (consistente con token JWT)
        path: '/'
      });

      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,  // ← ¡IMPORTANTE para React Native/Expo!
        mensaje: 'Inicio de sesión exitoso'
      });
    } else {
      // Código específico para errores de DB
      let statusCode = 401;
      if (resultado.codigo === 'DNS_ERROR' || resultado.error?.includes('base de datos')) {
        statusCode = 503; // Servicio no disponible
      }
      
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo
      });
    }
  } catch (error) {
    console.error('🔥 [RUTA LOGIN] Error crítico:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión' 
    });
  }
});

// POST /autenticacion/registro - Registro manual
router.post('/registro', async (req, res) => {
  console.log('📝 [RUTA REGISTRO] Datos recibidos');
  
  const { nombre, email, contrasena, nombreUsuario } = req.body;
  
  if (!nombre || !email || !contrasena || !nombreUsuario) {
    console.log('❌ [RUTA REGISTRO] Faltan campos requeridos');
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
    
    console.log(`📊 [RUTA REGISTRO] Resultado: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    if (resultado.exito) {
      return res.status(201).json({
        exito: true,
        usuario: resultado.usuario,
        token: resultado.token,  // ← ¡AGREGA ESTO para consistencia!
        mensaje: 'Usuario registrado exitosamente'
      });
    } else {
      // Código específico para errores de DB
      let statusCode = 400;
      if (resultado.codigo === 'DNS_ERROR' || resultado.error?.includes('base de datos')) {
        statusCode = 503; // Servicio no disponible
      }
      
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo
      });
    }
  } catch (error) {
    console.error('🔥 [RUTA REGISTRO] Error crítico:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor en registro' 
    });
  }
});

// POST /autenticacion/google - Login con Google
router.post('/google', async (req, res) => {
  const { access_token } = req.body;
  
  console.log('🔐 [RUTA GOOGLE] Token recibido:', access_token ? '✓' : '✗');
  if (access_token) {
    console.log('🔑 Token (primeros 20 chars):', access_token.substring(0, 20) + '...');
  }
  
  if (!access_token) {
    console.error("❌ [RUTA GOOGLE] No se recibió access_token");
    return res.status(400).json({ 
      exito: false, 
      error: 'Token de Google es requerido' 
    });
  }
  
  try {
    const resultado = await loginConGoogle(access_token);
    
    console.log(`📊 [RUTA GOOGLE] Resultado: ${resultado.exito ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    if (resultado.exito) {
      const token = resultado.token;
      
      console.log("✅ [RUTA GOOGLE] Token JWT recibido:", token?.substring(0, 20) + '...');

      // Configurar cookie (opcional)
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.ENTORNO === 'produccion',
        sameSite: process.env.ENTORNO === 'produccion' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        path: '/'
      });

      return res.json({
        exito: true,
        usuario: resultado.usuario,
        token: token,  // ← ¡CRÍTICO para React Native!
        mensaje: 'Inicio de sesión con Google exitoso'
      });
    } else {
      // Determinar código de estado apropiado
      let statusCode = 401;
      if (resultado.codigo === 'DNS_ERROR' || resultado.codigo === 'QUERY_ERROR') {
        statusCode = 503; // Servicio no disponible
        console.error('🚨 [RUTA GOOGLE] Error de DB:', resultado.error);
      }
      
      return res.status(statusCode).json({
        exito: false,
        error: resultado.error,
        codigo: resultado.codigo
      });
    }
  } catch (error) {
    console.error('🔥 [RUTA GOOGLE] Error crítico:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al iniciar sesión con Google' 
    });
  }
});

// POST /autenticacion/logout - Cerrar sesión
router.post('/logout', autenticarUsuario, (req, res) => {
  console.log('🚪 [RUTA LOGOUT] Usuario:', req.usuario?.email);
  
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
  console.log('🔐 [RUTA CAMBIAR-CONTRASEÑA] Usuario:', req.usuario?.email);
  
  const { contrasenaActual, nuevaContrasena } = req.body;
  const usuarioId = req.usuario.id;
  
  if (!contrasenaActual || !nuevaContrasena) {
    console.log('❌ [RUTA CAMBIAR-CONTRASEÑA] Faltan contraseñas');
    return res.status(400).json({ 
      exito: false, 
      error: 'Contraseña actual y nueva contraseña son requeridas' 
    });
  }
  
  // Validar que la nueva contraseña sea segura
  const regex = /^(?=.*\d).{6,}$/;
  if (!regex.test(nuevaContrasena)) {
    console.log('❌ [RUTA CAMBIAR-CONTRASEÑA] Contraseña no cumple requisitos');
    return res.status(400).json({
      exito: false,
      error: 'La contraseña debe tener al menos 6 caracteres y contener al menos un número'
    });
  }
  
  try {
    const resultado = await cambiarContrasena(usuarioId, contrasenaActual, nuevaContrasena);
    
    console.log(`📊 [RUTA CAMBIAR-CONTRASEÑA] Resultado: ${resultado.exito ? '✅' : '❌'}`);
    
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
    console.error('🔥 [RUTA CAMBIAR-CONTRASEÑA] Error crítico:', error.message);
    return res.status(500).json({ 
      exito: false, 
      error: 'Error del servidor al cambiar contraseña' 
    });
  }
});

// GET /autenticacion/verificar - Verificar token
router.get('/verificar', autenticarUsuario, (req, res) => {
  console.log('✅ [RUTA VERIFICAR] Token válido para:', req.usuario?.email);
  
  res.json({
    exito: true,
    usuario: req.usuario,
    mensaje: 'Token válido'
  });
});

// Ruta de prueba simple (sin DB)
router.get('/status', (req, res) => {
  console.log('📡 [RUTA STATUS] Health check');
  
  res.json({
    exito: true,
    servicio: 'autenticacion',
    timestamp: new Date().toISOString(),
    entorno: process.env.ENTORNO || 'desarrollo'
  });
});

router.get('/config-email', (req, res) => {
  res.json({
    sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
    sendgrid_key_prefix: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 5) : 'no-key',
    email_from: process.env.EMAIL_FROM,
    timestamp: new Date().toISOString()
  });
});

// POST /enviarCorreo - Enviar código de verificación
router.post('/enviarCorreo', async (req, res) => {
  console.log('📧 [RUTA ENVIAR-CORREO] Datos recibidos:', {
    correo: req.body.correo ? '✓' : '✗',
    tieneCodigo: !!req.body.codigo,
    modo: req.body.modo || 'no especificado'
  });
  
  const { correo, codigo, modo } = req.body;
  
  if (!correo) {
    console.log('❌ [RUTA ENVIAR-CORREO] Falta correo');
    return res.status(400).json({ 
      exito: false, 
      error: 'Correo electrónico es requerido' 
    });
  }
  
  if (!codigo) {
    console.log('❌ [RUTA ENVIAR-CORREO] Falta código');
    return res.status(400).json({ 
      exito: false, 
      error: 'Código de verificación es requerido' 
    });
  }
  
  try {
    console.log('🔐 [RUTA ENVIAR-CORREO] Enviando código:', codigo.substring(0, 3) + '...');
    
    // Determinar asunto según el modo
    let asunto = 'Tu código de verificación - Rumbo';
    if (modo === 'crear') {
      asunto = 'Bienvenido a Rumbo - Código de verificación';
    } else if (modo === 'recuperar') {
      asunto = 'Recuperación de contraseña - Rumbo';
    }
    
    // Configurar el email - ¡USA LA VARIABLE EMAIL_FROM de Northflank!
    const msg = {
      to: correo,
      from: process.env.EMAIL_FROM,  // ← Esto viene de Northflank
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
    
    console.log('✅ [RUTA ENVIAR-CORREO] Correo enviado exitosamente a:', correo);
    
    return res.json({
      exito: true,
      mensaje: 'Código enviado exitosamente',
      correo: correo,
      modo: modo
    });
    
  } catch (error) {
    console.error('🔥 [RUTA ENVIAR-CORREO] Error crítico:', error.message);
    
    // Si es error de SendGrid
    if (error.response) {
      console.error('🔧 SendGrid error details:', error.response.body);
    }
    
    return res.status(500).json({ 
      exito: false, 
      error: 'Error al enviar el correo',
      detalle: process.env.ENTORNO === 'desarrollo' ? error.message : undefined
    });
  }
});

// RUTA TEMPORAL PARA DIAGNÓSTICO - Eliminar después
router.get('/debug-db', async (req, res) => {
  try {
    const { verificarConexionDB } = await import('../configuracion/basedeDatos.js');
    const dbStatus = await verificarConexionDB();
    
    res.json({
      timestamp: new Date().toISOString(),
      database_status: dbStatus.conectado ? 'connected' : 'disconnected',
      database_error: dbStatus.error,
      database_dns_error: dbStatus.esErrorDNS,
      environment: process.env.ENTORNO,
      hostname: process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1] || 'no-detectado'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;