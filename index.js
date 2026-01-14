// index.js - VERSIÓN PARA NORTHFLANK (SIN dotenv)
import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';

// ========== 1. VERIFICAR VARIABLES NORTHFLANK ==========
console.log('\n🚀 ========== INICIANDO BACKEND EN NORTHFLANK ==========');
console.log('📦 Variables de entorno disponibles:');

// Verificar variables críticas
const variablesCriticas = [
  'JWT_SECRETO',
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SENDGRID_API_KEY'
];

variablesCriticas.forEach(variable => {
  const valor = process.env[variable];
  if (valor) {
    if (variable.includes('SECRET') || variable.includes('KEY')) {
      console.log(`✅ ${variable}: ***PRESENTE*** (${valor.length} chars)`);
    } else {
      console.log(`✅ ${variable}: ${valor}`);
    }
  } else {
    console.error(`❌ ${variable}: NO ENCONTRADA en Northflank`);
  }
});

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('process.env.SENDGRID_API_KEY');
  console.log('✅ SendGrid configurado');

// ========== 2. CARGAR CLOUDINARY DE FORMA SÍNCRONA ==========
console.log('\n☁️ CARGANDO CLOUDINARY...');
try {
  // Usar import dinámico para forzar ejecución
  const cloudinaryModule = await import('./configuracion/cloudinary.js');
  console.log('✅ Cloudinary cargado exitosamente');
  
  // Verificar configuración después de cargar
  const cloudinary = cloudinaryModule.cloudinary;
  const config = cloudinary.config();
  
  console.log('🔍 Verificando configuración Cloudinary:');
  console.log(`   Cloud name: ${config.cloud_name || '❌ NO CONFIGURADO'}`);
  console.log(`   API Key: ${config.api_key ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
  console.log(`   API Secret: ${config.api_secret ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
  
  if (!config.api_key) {
    console.error('❌ ERROR CRÍTICO: Cloudinary no tiene API Key configurada');
    console.error('   Verifica en Northflank: Variables → CLOUDINARY_API_KEY');
  }
  
} catch (error) {
  console.error('❌ ERROR cargando Cloudinary:', error.message);
}

// ========== 3. IMPORTAR RUTAS ==========
console.log('\n🔗 IMPORTANDO RUTAS...');

// Importar todas las rutas
import rutasAutenticacion from './rutas/rutasAutenticacion.js';
import rutasUsuario from './rutas/rutasUsuario.js';
import rutasTest from './rutas/rutasTest.js';
import rutasVocacional from './rutas/rutasVocacional.js';

console.log('✅ Todas las rutas importadas');

// ========== 4. CONFIGURAR EXPRESS ==========
const app = express();
const PORT = process.env.PORT || 3000;

// Crear carpeta uploads si no existe
import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Carpeta uploads creada:', uploadsDir);
} else {
  console.log('📁 Carpeta uploads ya existe:', uploadsDir);
}

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ========== 5. RUTAS BÁSICAS ==========
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Rumbo funcionando',
    timestamp: new Date().toISOString(),
    environment: 'Northflank'
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbStatus = await verificarConexionDB(3);
    
    res.json({
      status: 'healthy',
      service: 'rumbo-api',
      timestamp: new Date().toISOString(),
      environment: 'Northflank',
      database: dbStatus.connected ? 'connected' : 'disconnected',
      cloudinary: process.env.CLOUDINARY_API_KEY ? 'configured' : 'not_configured'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 6. RUTA ESPECÍFICA PARA DEBUG CLOUDINARY ==========
app.get('/debug-cloudinary', async (req, res) => {
  console.log('🔍 Endpoint debug-cloudinary accedido');
  
  try {
    // Forzar recarga del módulo para ver estado actual
    const cloudinaryModule = await import('./configuracion/cloudinary.js');
    const cloudinary = cloudinaryModule.cloudinary;
    const config = cloudinary.config();
    
    // Intentar ping a Cloudinary
    let pingResult = 'not_tested';
    try {
      const ping = await cloudinary.api.ping();
      pingResult = 'success';
    } catch (pingError) {
      pingResult = `failed: ${pingError.message}`;
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cloudinary_status: {
        configured: !!(config.cloud_name && config.api_key && config.api_secret),
        cloud_name: config.cloud_name,
        api_key_present: !!config.api_key,
        api_secret_present: !!config.api_secret,
        ping_test: pingResult
      },
      northflank_variables: {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '***PRESENT***' : 'MISSING',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '***PRESENT***' : 'MISSING'
      }
    });
    
  } catch (error) {
    console.error('Error en debug-cloudinary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== 7. MONTAR RUTAS PRINCIPALES ==========
console.log('\n🔧 Montando rutas de la API...');

app.use('/api/auth', rutasAutenticacion);
console.log('✅ Rutas montadas en /api/auth');

app.use('/api/usuario', rutasUsuario);
console.log('✅ Rutas montadas en /api/usuario');

app.use('/api/tests', rutasTest);
console.log('✅ Rutas montadas en /api/tests');

app.use('/api/vocacional', rutasVocacional);
console.log('✅ Rutas montadas en /api/vocacional');

// ========== 8. RUTAS DE FALLBACK ==========
app.use('*', (req, res) => {
  console.log(`❌ 404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    suggestion: 'Verifica la URL o prueba /test, /health, /debug-cloudinary'
  });
});

// ========== 9. INICIAR SERVIDOR ==========
const iniciarServidor = async () => {
  try {
    console.log('\n🔗 Verificando conexión a base de datos...');
    const dbStatus = await verificarConexionDB(3);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SERVIDOR INICIADO EN NORTHFLANK');
      console.log('='.repeat(60));
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`🌍 Entorno: Northflank`);
      console.log(`🗄️  Base de datos: ${dbStatus.connected ? '✅ Conectada' : '❌ Desconectada'}`);
      console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_API_KEY ? '✅ Configurado' : '❌ No configurado'}`);
      
      console.log('\n📡 ENDPOINTS DE DIAGNÓSTICO:');
      console.log(`   🏓  GET /test`);
      console.log(`   🩺  GET /health`);
      console.log(`   🔍  GET /debug-cloudinary`);
      console.log(`   🔐  POST /api/auth/login`);
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('❌ ERROR al iniciar servidor:', error.message);
    process.exit(1);
  }
};

// Iniciar servidor
iniciarServidor();

export default app;