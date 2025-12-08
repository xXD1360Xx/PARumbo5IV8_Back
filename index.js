import dotenv from 'dotenv';
dotenv.config(); 

import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';

// Importar todas las rutas
import rutasAutenticacion from './rutas/rutasAutenticacion.js';
import rutasUsuario from './rutas/rutasUsuario.js';          // Nueva
import rutasTest from './rutas/rutasTest.js';                // Nueva
import rutasVocacional from './rutas/rutasVocacional.js';    // Nueva

import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Carpeta uploads creada:', uploadsDir);
} else {
  console.log('📁 Carpeta uploads ya existe:', uploadsDir);
}

const app = express();
const PORT = process.env.PORT || 3000;

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
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === 2. LOGGING MEJORADO ===
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  
  // Solo log body en desarrollo y si no es muy grande
  if (process.env.ENTORNO !== 'produccion' && 
      Object.keys(req.body).length > 0 && 
      req.method !== 'GET') {
    const bodyStr = JSON.stringify(req.body);
    console.log('   Body:', bodyStr.substring(0, 200) + (bodyStr.length > 200 ? '...' : ''));
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
    version: '1.0.0',
    services: {
      auth: true,
      usuario: true,
      tests: true,
      vocacional: true
    }
  });
});

// Health check simple
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
    const dbStatus = await verificarConexionDB(3);
    
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
        jwt: process.env.JWT_SECRETO ? "configured" : "not_configured",
        routes_loaded: true
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

// === 4. MONTAR TODAS LAS RUTAS ===
console.log('\n🔧 Montando rutas de la API...');

// Autenticación
try {
  app.use('/api/auth', rutasAutenticacion);
  console.log('✅ Rutas montadas en /api/auth');
} catch (error) {
  console.error('❌ ERROR montando rutas de autenticación:', error.message);
}

// Usuario
try {
  app.use('/api/usuario', rutasUsuario);
  console.log('✅ Rutas montadas en /api/usuario');
} catch (error) {
  console.error('❌ ERROR montando rutas de usuario:', error.message);
}

// Tests
try {
  app.use('/api/tests', rutasTest);
  console.log('✅ Rutas montadas en /api/tests');
} catch (error) {
  console.error('❌ ERROR montando rutas de tests:', error.message);
}

// Vocacional
try {
  app.use('/api/vocacional', rutasVocacional);
  console.log('✅ Rutas montadas en /api/vocacional');
} catch (error) {
  console.error('❌ ERROR montando rutas vocacional:', error.message);
}

// === 5. RUTA DE DEBUG CON TODAS LAS RUTAS ===
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
      environment: process.env.ENTORNO || 'desarrollo',
      uptime: process.uptime()
    },
    environment_variables: {
      entorno: process.env.ENTORNO,
      node_env: process.env.NODE_ENV,
      port: process.env.PORT
    },
    routes_available: {
      // Rutas de sistema
      system: [
        'GET  /test',
        'GET  /health',
        'GET  /health-full',
        'GET  /debug'
      ],
      
      // Rutas de autenticación
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/registro',
        'POST /api/auth/enviarCorreo',
        'POST /api/auth/google',
        'POST /api/auth/logout',
        'GET  /api/auth/verificar',
        'GET  /api/auth/status',
        'POST /api/auth/cambiar-contrasena'
      ],
      
      // Rutas de usuario
      usuario: [
        'GET  /api/usuario/perfil',
        'GET  /api/usuario/perfil/:id',
        'PUT  /api/usuario/perfil',
        'GET  /api/usuario/estadisticas',
        'GET  /api/usuario/dashboard',
        'GET  /api/usuario/buscar',
        'GET  /api/usuario/verificar/:id',
        'GET  /api/usuario/configuracion',
        'PUT  /api/usuario/configuracion'
      ],
      
      // Rutas de tests
      tests: [
        'GET  /api/tests/',
        'GET  /api/tests/mis-resultados',
        'GET  /api/tests/estadisticas/generales',
        'GET  /api/tests/:testId',
        'GET  /api/tests/vocacionales'
      ],
      
      // Rutas vocacionales
      vocacional: [
        'GET  /api/vocacional/resultados',
        'GET  /api/vocacional/ultimo',
        'GET  /api/vocacional/estadisticas',
        'GET  /api/vocacional/analisis/:id',
        'GET  /api/vocacional/ping'
      ]
    }
  });
});

// === 6. MIDDLEWARE 404 (AL FINAL) ===
app.use('*', (req, res) => {
  console.log(`❌ 404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Verifica la URL o consulta /debug para ver rutas disponibles',
    available_endpoints: [
      '/test',
      '/health', 
      '/health-full',
      '/debug',
      '/api/auth/*',
      '/api/usuario/*',
      '/api/tests/*',
      '/api/vocacional/*'
    ]
  });
});

// === 7. MANEJADOR DE ERRORES GLOBAL ===
app.use((err, req, res, next) => {
  console.error('🔥 ERROR GLOBAL:', err.message);
  console.error('Stack:', err.stack);
  
  // Determinar código de estado
  let statusCode = 500;
  let errorMessage = 'Error interno del servidor';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Error de validación';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = 'No autorizado';
  } else if (err.code === '23505') { // PostgreSQL duplicate key
    statusCode = 409;
    errorMessage = 'Registro duplicado';
  }
  
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    message: process.env.ENTORNO === 'desarrollo' ? err.message : undefined,
    code: err.code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// === 8. INICIAR SERVIDOR ===
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
      console.log(`🔐 JWT: ${process.env.JWT_SECRETO ? '✅ Configurado' : '❌ No configurado'}`);
      
      console.log('\n📡 ENDPOINTS DISPONIBLES:');
      console.log('   🔐 Autenticación:');
      console.log('      POST /api/auth/login         - Iniciar sesión');
      console.log('      POST /api/auth/registro      - Registrar usuario');
      console.log('      POST /api/auth/enviarCorreo  - Enviar código');
      
      console.log('\n   👤 Usuario:');
      console.log('      GET  /api/usuario/perfil     - Perfil del usuario');
      console.log('      GET  /api/usuario/estadisticas - Estadísticas');
      console.log('      GET  /api/usuario/dashboard  - Dashboard');
      
      console.log('\n   📊 Tests:');
      console.log('      GET  /api/tests/             - Tests disponibles');
      console.log('      GET  /api/tests/mis-resultados - Mis resultados');
      
      console.log('\n   🎓 Vocacional:');
      console.log('      GET  /api/vocacional/resultados - Resultados vocacionales');
      console.log('      GET  /api/vocacional/ultimo   - Último resultado');
      
      console.log('\n🔗 URLs para probar:');
      console.log(`   📍 Local: http://localhost:${PORT}`);
      console.log(`   🩺 Health: http://localhost:${PORT}/health`);
      console.log(`   🔍 Debug: http://localhost:${PORT}/debug`);
      console.log(`   🏓 Test: http://localhost:${PORT}/test`);
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