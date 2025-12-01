// 📦 Cargar variables de entorno
import dotenv from "dotenv";
dotenv.config();

// 🚀 Importar dependencias principales
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sgMail from "@sendgrid/mail";

// 🧠 Importar las rutas de autenticación
import rutasAutenticacion from "./rutas/rutasAutenticacion.js";

const app = express();

// 🔑 Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ⚙️ Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// ✅ Usar las rutas de autenticación
app.use("/api/autenticacion", rutasAutenticacion);

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
    from: "cdmxrumbo@gmail.com", // ✅ debe estar verificado en SendGrid
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

// 🖥️ Iniciar servidor
app.listen(3000, "0.0.0.0", () => {
  console.log("✅ Servidor corriendo en http://0.0.0.0:3000");
});
