import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import rutasAutenticacion from './rutas/rutasAutenticacion.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS para todo
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

// Logging simple
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ============ RUTAS ============

// Test directo
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'rumbo-api'
  });
});

// Montar rutas de autenticación
app.use('/api/auth', rutasAutenticacion);

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.url,
    available: ['/health', '/test', '/api/auth/ping', '/api/auth/status']
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`📡 Test: http://localhost:${PORT}/test`);
  console.log(`📡 Auth Ping: http://localhost:${PORT}/api/auth/ping`);
  console.log('='.repeat(50));
});

export default app;