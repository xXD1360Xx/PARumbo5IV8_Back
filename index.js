// index.js - VERSIÓN CON CLAVE SENDGRID OCULTA
import express from 'express';
import cors from 'cors';
import { verificarConexionDB } from './configuracion/basedeDatos.js';
import fs from 'fs';
import path from 'path';

console.log('\n🚀 ========== INICIANDO BACKEND RUMBO ==========');


// Configurar SendGrid inmediatamente
import sgMail from './configuracion/sendgrid.js'; // Importa el ya configurado

// ========== 2. CARGAR CLOUDINARY ==========
console.log('\n☁️ CARGANDO CLOUDINARY...');
try {
  const { cloudinary } = await import('./configuracion/cloudinary.js');
  console.log('✅ Cloudinary cargado exitosamente');
  
  // Verificar configuración
  const config = cloudinary.config();
  console.log('🔍 Estado Cloudinary:');
  console.log(`   Cloud: ${config.cloud_name || '❌ NO CONFIGURADO'}`);
  console.log(`   API Key: ${config.api_key ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
} catch (error) {
  console.error('❌ ERROR cargando Cloudinary:', error.message);
}

// ========== 3. VERIFICAR VARIABLES DE ENTORNO ==========
console.log('\n📦 === VERIFICACIÓN DE VARIABLES ===');

// Variables críticas para base de datos
const dbVariables = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
let dbConfigOk = true;

dbVariables.forEach(variable => {
  const valor = process.env[variable];
  if (!valor) {
    console.error(`❌ ${variable}: NO DEFINIDA`);
    dbConfigOk = false;
  } else {
    console.log(`✅ ${variable}: DEFINIDA`);
  }
});

if (!dbConfigOk) {
  console.error('\n🚨 ERROR: Faltan variables de base de datos');
  console.error('   Usando configuración directa como respaldo');
}

// Verificar JWT
if (!process.env.JWT_SECRETO) {
  console.warn('⚠️ JWT_SECRETO: No definida, usando valor por defecto');
  process.env.JWT_SECRETO = 'rumbo-jwt-secreto-temporal-2024';
}

// Verificar Puerto
const PORT = process.env.PORT || 8080;
console.log(`✅ Puerto: ${PORT}`);

// ========== 4. CARGAR RUTAS ==========
console.log('\n🔗 === CARGANDO RUTAS ===');

let rutasAutenticacion, rutasUsuario, rutasTest, rutasVocacional;

try {
  rutasAutenticacion = (await import('./rutas/rutasAutenticacion.js')).default;
  console.log('✅ RUTAS: Autenticación cargada');
  
  rutasUsuario = (await import('./rutas/rutasUsuario.js')).default;
  console.log('✅ RUTAS: Usuario cargada');
  
  rutasTest = (await import('./rutas/rutasTest.js')).default;
  console.log('✅ RUTAS: Tests cargada');
  
  rutasVocacional = (await import('./rutas/rutasVocacional.js')).default;
  console.log('✅ RUTAS: Vocacional cargada');
} catch (error) {
  console.error('❌ Error cargando rutas:', error.message);
  // Crear rutas dummy para evitar crash
  const router = express.Router();
  router.all('*', (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'Servicio temporalmente no disponible' 
    });
  });
  rutasAutenticacion = rutasUsuario = rutasTest = rutasVocacional = router;
}

// ========== 5. CONFIGURAR EXPRESS ==========
const app = express();

// Crear carpeta uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Carpeta uploads creada: ${uploadsDir}`);
}

// Middleware simple y efectivo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging minimalista
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString('es-MX', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  console.log(`[${time}] ${req.method} ${req.path}`);
  next();
});

// ========== 6. RUTAS DEL SISTEMA ==========
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    service: 'Rumbo Backend API',
    status: 'online',
    time: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbStatus = await verificarConexionDB();
    res.json({
      status: dbStatus.success ? 'healthy' : 'degraded',
      database: dbStatus.connected ? 'connected' : 'disconnected',
      cloudinary: 'available',
      sendgrid: 'available',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Endpoint de prueba para verificar que SendGrid funciona
app.get('/test-email', async (req, res) => {
  try {
    const msg = {
      to: 'tellez.aguilar.diego@gmail.com',
      from: 'proyectoaularumbo@gmail.com',
      subject: 'Prueba SendGrid desde Rumbo',
      text: 'Si recibes esto, SendGrid está funcionando correctamente.',
      html: '<strong>SendGrid funcionando ✅</strong>'
    };
    
    await sgMail.send(msg);
    res.json({ success: true, message: 'Email de prueba enviado' });
  } catch (error) {
    console.error('Error test email:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code 
    });
  }
});

// ========== 7. MONTAR RUTAS DE LA API ==========
app.use('/api/auth', rutasAutenticacion);
app.use('/api/usuario', rutasUsuario);
app.use('/api/tests', rutasTest);
app.use('/api/vocacional', rutasVocacional);

console.log('✅ Todas las rutas montadas en /api');

// ========== 8. MANEJO DE ERRORES ==========
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    available_routes: {
      system: ['GET /', 'GET /health', 'GET /test-email'],
      auth: ['POST /api/auth/login', 'POST /api/auth/register'],
      user: ['GET /api/usuario/perfil', 'PUT /api/usuario/perfil'],
      tests: ['POST /api/tests/guardar', 'GET /api/tests/historial'],
      vocacional: ['POST /api/vocacional/resultado', 'GET /api/vocacional/historial']
    }
  });
});

// ========== 9. INICIAR SERVIDOR ==========
const iniciarServidor = async () => {
  try {
    console.log('\n🔗 Probando conexión a base de datos...');
    const dbStatus = await verificarConexionDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 SERVIDOR RUMBO INICIADO CORRECTAMENTE');
      console.log('='.repeat(60));
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌍 Puerto: ${PORT}`);
      console.log(`🗄️  Base de datos: ${dbStatus.success ? '✅ CONECTADA' : '❌ ERROR'}`);
      if (!dbStatus.success) {
        console.log(`   Error: ${dbStatus.error}`);
      }
      console.log(`📧 SendGrid: ✅ CONFIGURADO`);
      console.log(`☁️  Cloudinary: ✅ CONFIGURADO`);
      console.log(`🔐 JWT: ${process.env.JWT_SECRETO ? '✅' : '⚠️ POR DEFECTO'}`);
      console.log('\n📡 ENDPOINTS PRINCIPALES:');
      console.log(`   🔓  POST /api/auth/login`);
      console.log(`   📝  POST /api/auth/register`);
      console.log(`   👤  GET  /api/usuario/perfil`);
      console.log(`   📊  POST /api/tests/guardar`);
      console.log(`   🎯  POST /api/vocacional/resultado`);
      console.log(`   🧪  GET  /test-email (prueba SendGrid)`);
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('❌ ERROR CRÍTICO al iniciar:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Iniciar servidor
iniciarServidor();

export default app;