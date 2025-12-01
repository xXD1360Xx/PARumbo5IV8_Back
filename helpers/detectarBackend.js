import { Platform } from 'react-native';

// URLs posibles
export const URL_LOCALHOST = 'http://localhost:3000';
export const URL_LAN = 'http://192.168.100.20:3000'; // Cambia a tu IP local
export const URL_TUNNEL = 'https://supergeneric-lylah-interfenestral.ngrok-free.dev';

// Función para probar un servidor
const probarServidor = async (url) => {
  try {
    const res = await fetch(`${url}/ping`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
};

export const detectarBackend = async () => {
  if (Platform.OS === 'web') {
    const okLocal = await probarServidor(URL_LOCALHOST);
    if (okLocal) return URL_LOCALHOST;
    console.warn('⚠️ No se detectó servidor local, entrando en modo demo.');
    return null; // modo demo
  }

  const okLAN = await probarServidor(URL_LAN);
  if (okLAN) return URL_LAN;

  const okTunnel = await probarServidor(URL_TUNNEL);
  if (okTunnel) return URL_TUNNEL;

  console.warn('⚠️ No se detectó ningún backend, entrando en modo demo.');
  return null; // modo demo
};
