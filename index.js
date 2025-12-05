import dotenv from 'dotenv';
dotenv.config(); 

import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';
import rutasAutenticacion from './rutas/rutasAutenticacion.js';

const app = express();
const PORT = process.env.PORT || 3000; // ← CAMBIADO A 3000

// ============ DEBUG INICIAL ============
console.log('='.repeat(60));
console.log('🚀 INICIANDO SERVIDOR RUMBO API');
console.log('='.repeat(60));
console.log(`📦 Puerto configurado: ${PORT}`);
console.log(`🌍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
console.log(`🔑 SendGrid: ${process.env.SENDGRID_API_KEY ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
console.log(`🗄️  JWT: ${process.env.JWT_SECRETO ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);

// === 1. MIDDLEWARE BÁSICOS ===
app.use(cors({
  origin: '*',
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === 2. LOGGING MEJORADO ===
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length > 0 && req.method !== 'GET') {
    console.log('   Body:', JSON.stringify(req.body).substring(0, 200) + '...');
  }
  next();
});

// === 3. RUTAS BÁSICAS DE PRUEBA ===

// Ruta de prueba directa
app.get('/test', (req, res) => {
  console.log('✅ /test accedida');
  res.json({ 
    success: true, 
    message: 'API Rumbo funcionando correctamente',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.ENTORNO || 'desarrollo'
  });
});

// Health check simple (sin DB para debug rápido)
app.get('/health', (req, res) => {
  console.log('🩺 /health accedido');
  res.json({ 
    status: 'healthy',
    service: 'rumbo-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    environment: process.env.ENTORNO || 'desarrollo'
  });
});

// Health check completo con DB
app.get('/health-full', async (req, res) => {
  console.log('🏥 /health-full accedido');
  try {
    const dbStatus = await verificarConexionDB(1);
    
    const healthStatus = {
      status: dbStatus.connected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.ENTORNO || 'desarrollo',
      database: dbStatus.connected ? "connected" : "disconnected",
      database_error: dbStatus.error,
      memory: process.memoryUsage(),
      services: {
        sendgrid: process.env.SENDGRID_API_KEY ? "configured" : "not_configured",
        cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? "configured" : "not_configured",
        jwt: process.env.JWT_SECRETO ? "configured" : "not_configured"
      }
    };
    
    res.status(dbStatus.connected ? 200 : 503).json(healthStatus);
  } catch (error) {
    console.error('Error en health-full:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta de debug general
app.get('/debug', (req, res) => {
  console.log('🔍 /debug accedida');
  res.json({
    success: true,
    message: 'Debug endpoint funcionando',
    timestamp: new Date().toISOString(),
    server_info: {
      node_version: process.version,
      platform: process.platform,
      port: PORT,
      environment: process.env.ENTORNO || 'desarrollo'
    },
    environment_variables: {
      sendgrid_key: process.env.SENDGRID_API_KEY ? '***' + process.env.SENDGRID_API_KEY.slice(-8) : null,
      entorno: process.env.ENTORNO,
      node_env: process.env.NODE_ENV,
      port: process.env.PORT
    },
    routes_available: [
      'GET  /test',
      'GET  /health',
      'GET  /health-full',
      'GET  /debug',
      'GET  /api/auth/ping',
      'GET  /api/auth/status',
      'GET  /api/auth/debug-env',
      'POST /api/auth/login',
      'POST /api/auth/registro',
      'POST /api/auth/enviarCorreo',
      'POST /api/auth/google'
    ]
  });
});

// === 4. MONTAR RUTAS DE AUTENTICACIÓN ===
console.log('\n🔧 Montando rutas de autenticación...');
try {
  app.use('/api/auth', rutasAutenticacion);
  console.log('✅ Rutas montadas en /api/auth');
} catch (error) {
  console.error('❌ ERROR montando rutas de autenticación:', error.message);
  console.error('Stack trace:', error.stack);
}

// === 5. MIDDLEWARE 404 (AL FINAL) ===
app.use('*', (req, res) => {
  console.log(`❌ 404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: [
      '/test',
      '/health', 
      '/health-full',
      '/debug',
      '/api/auth/ping',
      '/api/auth/status',
      '/api/auth/debug-env'
    ]
  });
});

// === 6. MANEJADOR DE ERRORES GLOBAL ===
app.use((err, req, res, next) => {
  console.error('🔥 ERROR GLOBAL:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.ENTORNO === 'desarrollo' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// === 7. INICIAR SERVIDOR ===
const iniciarServidor = async () => {
  try {
    console.log('\n🔗 Verificando conexión a base de datos...');
    const dbStatus = await verificarConexionDB(3);
    
    if (!dbStatus.connected) {
      console.warn('⚠️  Advertencia: No se pudo conectar a la base de datos');
      console.warn('   Error:', dbStatus.error);
      console.warn('   El servidor iniciará pero algunas funciones pueden no trabajar');
    } else {
      console.log('✅ Conexión a base de datos establecida');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SERVIDOR INICIADO CORRECTAMENTE');
      console.log('='.repeat(60));
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
      console.log(`🗄️  Base de datos: ${dbStatus.connected ? '✅ Conectada' : '❌ Desconectada'}`);
      console.log(`📧 SendGrid: ${process.env.SENDGRID_API_KEY ? '✅ Configurado' : '❌ No configurado'}`);
      console.log('\n🔗 URLs para probar:');
      console.log(`   📍 Local: http://localhost:${PORT}`);
      console.log(`   🩺 Health: http://localhost:${PORT}/health`);
      console.log(`   🧪 Test: http://localhost:${PORT}/test`);
      console.log(`   🔍 Debug: http://localhost:${PORT}/debug`);
      console.log(`   🏓 Auth Ping: http://localhost:${PORT}/api/auth/ping`);
      console.log(`   📡 Auth Status: http://localhost:${PORT}/api/auth/status`);
      console.log('\n📋 Rutas principales:');
      console.log(`   POST /api/auth/enviarCorreo   - Enviar código de verificación`);
      console.log(`   POST /api/auth/login         - Iniciar sesión`);
      console.log(`   POST /api/auth/registro      - Registrar usuario`);
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('❌ ERROR CRÍTICO al iniciar servidor:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Iniciar servidor
iniciarServidor();

export default app;