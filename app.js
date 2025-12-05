import dotenv from 'dotenv';
dotenv.config(); 

import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware CORS mejorado
app.use(cors({
  origin: function(origin, callback) {
    // Permitir todos en desarrollo, específicos en producción
    if (!origin && process.env.ENTORNO === 'desarrollo') {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:8081',
      'http://localhost:19006',
      'exp://192.168.*:*',  // Para Expo
      'https://tu-frontend-en-render.com',  // Tu frontend en producción
    ];
    
    if (!origin || allowedOrigins.some(allowed => origin.match(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check mejorado
app.get('/health', async (req, res) => {
  const dbStatus = await verificarConexionDB(1); // Solo 1 intento rápido
  
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

// app.js - Agrega esto:
console.log('🔄 Montando rutas de autenticación...');
console.log('📁 Ruta base:', '/api/auth');

// Importar rutas
import rutasAutenticacion from './rutas/rutasAutenticacion.js';
console.log('✅ Rutas importadas correctamente');

// Usar rutas
app.use('/api/auth', rutasAutenticacion);
console.log('✅ Rutas montadas en /api/auth');

// Ruta de prueba simple sin DB
app.get('/api/test', (req, res) => {
  res.json({ 
    mensaje: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada'
  });
});

// Middleware de errores global
app.use((err, req, res, next) => {
  console.error('🔥 Error global:', err);
  res.status(500).json({
    exito: false,
    error: 'Error interno del servidor',
    detalle: process.env.ENTORNO === 'desarrollo' ? err.message : undefined
  });
});

// Iniciar servidor solo si DB está disponible
const iniciarServidor = async () => {
  try {
    const dbStatus = await verificarConexionDB(3);
    
    if (!dbStatus.connected) {
      console.error('🚨 NO se pudo conectar a PostgreSQL. Servidor iniciará pero auth fallará.');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
      console.log(`📊 Estado DB: ${dbStatus.connected ? '✅ Conectado' : '❌ Desconectado'}`);
    });
  } catch (error) {
    console.error('❌ Error crítico al iniciar servidor:', error);
    process.exit(1);
  }
};

iniciarServidor();

export default app;