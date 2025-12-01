// helpers/google.js
import axios from 'axios';
import { detectarBackend } from './detectarBackend';

// 🔹 Función para autenticar con Google
export const autenticarConGoogle = async (tokenAcceso) => {
  try {
    const BACKEND_URL = await detectarBackend();
    const respuesta = await axios.post(`${BACKEND_URL}/api/auth/google`, {
      access_token: tokenAcceso,
    });

    console.log('✅ Respuesta del backend (Google):', respuesta.data);
    return respuesta.data;
  } catch (error) {
    console.error('❌ Error autenticando con Google:', error.message);
    throw error;
  }
};
