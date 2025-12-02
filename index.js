// 📦 Cargar variables de entorno
import dotenv from "dotenv";
dotenv.config();

// 🚀 Importar dependencias principales
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sgMail from "@sendgrid/mail";

// 🧠 Importar todas las rutas
import rutasAutenticacion from "./rutas/rutasAutenticacion.js";
import rutasTest from "./rutas/rutasTest.js";
import rutasVocacional from "./rutas/rutasVocacional.js";
import rutasUsuario from "./rutas/rutasUsuario.js";

const app = express();

// 🔑 Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ⚙️ Middlewares
app.use(cors({
  origin: [
    // Patrones para Expo tunnels
    /https?:\/\/.*\.exp\.direct$/,
    /https?:\/\/.*\.exp\.host$/,
    /https?:\/\/.*\.expo\.dev$/,
    
    // Desarrollo local
    /https?:\/\/localhost:\d+$/,
    /https?:\/\/192\.168\.\d+\.\d+:\d+$/,
    
    // Web development
    'http://localhost:19006',
    'https://localhost:19006',
    
    // Tu dominio de producción (si lo tienes)
    process.env.ORIGEN_FRONTEND
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(bodyParser.json());
app.use(express.json());

// ✅ Usar todas las rutas
app.use("/api/autenticacion", rutasAutenticacion);
app.use("/api/tests", rutasTest);
app.use("/api/vocacional", rutasVocacional);
app.use("/api/usuario", rutasUsuario);

// 🔹 Endpoint de prueba
app.get("/ping", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "pong",
    timestamp: new Date().toISOString(),
    environment: process.env.ENTORNO || 'development'
  });
});

// 🔹 Endpoint para enviar correo
app.post("/enviarCorreo", async (req, res) => {
  const { correo, codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ 
      error: "Faltan datos (correo o código)" 
    });
  }

  const msg = {
    to: correo,
    from: "cdmxrumbo@gmail.com",
    subject: "Código de verificación Rumbo",
    text: `Tu código de verificación es: ${codigo}`,
    html: `<h1>Código de verificación</h1><p>Tu código es: <b>${codigo}</b></p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`Correo enviado a ${correo}`);
    res.json({ 
      success: true, 
      message: "Correo enviado correctamente" 
    });
  } catch (error) {
    console.error("Error al enviar correo:", error);
    res.status(500).json({ 
      error: "No se pudo enviar el correo" 
    });
  }
});

// 🔹 Health check más detallado
app.get("/health", async (req, res) => {
  try {
    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.ENTORNO || 'development',
      database: "connected",
      services: {
        sendgrid: process.env.SENDGRID_API_KEY ? "configured" : "not_configured",
        cloudinary: process.env.CLOUDINARY_CLAVE_API ? "configured" : "not_configured"
      }
    };
    res.json(healthData);
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy", 
      error: error.message 
    });
  }
});

// 🔹 Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    error: "Ruta no encontrada",
    path: req.path,
    method: req.method
  });
});

// 🔹 Manejo de errores global
app.use((error, req, res, next) => {
  console.error("Error global:", error);
  res.status(500).json({ 
    error: "Error interno del servidor",
    message: process.env.ENTORNO === 'desarrollo' ? error.message : undefined
  });
});

// 🖥️ Iniciar servidor
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
  console.log(`📍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
  console.log(`🌐 URL: http://localhost:${PUERTO}`);
  console.log(`🔗 Health check: http://localhost:${PUERTO}/health`);
  console.log(`🏓 Ping: http://localhost:${PUERTO}/ping`);
});