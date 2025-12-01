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
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// ✅ Usar todas las rutas
app.use("/api/autenticacion", rutasAutenticacion);
app.use("/api/tests", rutasTest);
app.use("/api/vocacional", rutasVocacional);
app.use("/api/usuario", rutasUsuario);

// 🔹 Endpoint de prueba
app.get("/ping", (req, res) => {
  res.send("pong");
});

// 🔹 Endpoint para enviar correo
app.post("/enviarCorreo", async (req, res) => {
  const { correo, codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: "Faltan datos (correo o código)" });
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
    res.json({ success: true, message: "Correo enviado correctamente" });
  } catch (error) {
    console.error("Error al enviar correo:", error);
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// 🔹 Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// 🔹 Manejo de errores global
app.use((error, req, res, next) => {
  console.error("Error global:", error);
  res.status(500).json({ error: "Error interno del servidor" });
});

// 🖥️ Iniciar servidor
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
  console.log(`📍 Entorno: ${process.env.ENTORNO || 'desarrollo'}`);
});