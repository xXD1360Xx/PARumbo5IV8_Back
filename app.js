import dotenv from 'dotenv';
dotenv.config(); 

import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';
import rutasAutenticacion from './rutas/rutasAutenticacion.js'; // ← IMPORTAR AL INICIO

const app = express();
const PORT = process.env.PORT || 10000;

// === 1. MIDDLEWARE BÁSICOS PRIMERO ===
app.use(cors({
  origin: '*', // ← TEMPORALMENTE PERMITIR TODO para debugging
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === 2. LOGGING MEJORADO ===
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log(`   Headers:`, req.headers['content-type']);
  next(); // ← ¡IMPORTANTE: llamar next()!
});

// === 3. RUTA TEST SIMPLE AL PRINCIPIO ===
app.get('/api/test', (req, res) => {
  console.log('✅ Ruta /api/test accedida');
  res.json({ 
    mensaje: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

// === 4. RUTAS DE AUTENTICACIÓN ===
console.log('🔄 Montando rutas de autenticación en /api/auth...');
app.use('/api/auth', rutasAutenticacion);
console.log('✅ Rutas montadas');

// === 5. HEALTH CHECK ===
app.get('/health', async (req, res) => {
  console.log('🩺 Health check accedido');
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
});

// === 6. RUTA DEBUG ===
app.get('/debug', (req, res) => {
  console.log('🔍 Debug route accedida');
  res.json({
    message: 'Debug funcionando',
    routes: ['/health', '/api/test', '/api/auth/*'],
    timestamp: new Date().toISOString()
  });
});

// === 7. MIDDLEWARE 404 (AL FINAL) ===
app.use('*', (req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    available_routes: ['/health', '/api/test', '/debug', '/api/auth/*']
  });
});

// === 8. ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error('🔥 Error global:', err);
  res.status(500).json({
    exito: false,
    error: 'Error interno del servidor',
    detalle: process.env.ENTORNO === 'desarrollo' ? err.message : undefined
  });
});

// === 9. INICIAR SERVIDOR ===
const iniciarServidor = async () => {
  try {
    const dbStatus = await verificarConexionDB(3);
    
    app.listen(PORT, '0.0.0.0', () => {  // ← Agrega '0.0.0.0'
      console.log(`🚀 Servidor ejecutándose en http://0.0.0.0:${PORT}`);
      console.log(`🌍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
      console.log(`📊 Estado DB: ${dbStatus.connected ? '✅ Conectado' : '❌ Desconectado'}`);
      console.log(`📡 Rutas disponibles:`);
      console.log(`   - GET  /health`);
      console.log(`   - GET  /api/test`);
      console.log(`   - GET  /debug`);
      console.log(`   - POST /api/auth/enviarCorreo`);
      console.log(`   - POST /api/auth/login`);
      console.log(`   - POST /api/auth/registro`);
    });
  } catch (error) {
    console.error('❌ Error crítico al iniciar servidor:', error);
    process.exit(1);
  }
};

iniciarServidor();

export default app;