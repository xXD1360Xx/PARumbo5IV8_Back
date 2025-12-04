import express from 'express';
import { 
  iniciarSesion, 
  registrarUsuario, 
  loginConGoogle,
  cambiarContrasena  
} from '../controladores/autenticacionControlador.js';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';

const router = express.Router();

// Middleware de logging para todas las rutas
router.use((req, res, next) => {
  console.log(`📥 [RUTA] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
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