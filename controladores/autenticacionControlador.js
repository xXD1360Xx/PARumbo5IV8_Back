import axios from "axios";

export const loginConGoogle = async (req, res) => {
  try {
    const { access_token } = req.body;

    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`
    );
    const datosUsuario = respuesta.data;

    console.log("Usuario autenticado con Google:", datosUsuario);

    res.status(200).json({ mensaje: "Autenticación con Google exitosa", usuario: datosUsuario });
  } catch (error) {
    console.error(error);
    res.status(400).json({ mensaje: "Error autenticando con Google" });
  }
};

export const loginConFacebook = async (req, res) => {
  try {
    const { access_token } = req.body;

    // Validar token con Facebook
    const respuesta = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${access_token}`
    );
    const datosUsuario = respuesta.data;

    console.log("Usuario autenticado con Facebook:", datosUsuario);

    res.status(200).json({ mensaje: "Autenticación con Facebook exitosa", usuario: datosUsuario });
  } catch (error) {
    console.error(error);
    res.status(400).json({ mensaje: "Error autenticando con Facebook" });
  }
};
