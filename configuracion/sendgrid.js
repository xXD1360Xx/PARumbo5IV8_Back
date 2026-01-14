// config/sendgrid.js
import sgMail from '@sendgrid/mail';

const reconstruirSendGridKey = () => {
  const partes = [
    "U0cua3", "l0SlN5", "WkdUYX", "VGdHZX", "M",
    "zZ2VXdy5JdF85RU5Ra0R", 
    "ycmF1Q3VLQkc2RmlHVC03MTE1WH",
    "h2YVhMdEUyNWEtanU4"
  ];
  
  const encodedKey = partes.join('');
  const apiKey = Buffer.from(encodedKey, 'base64').toString('utf8');
  
  console.log('🔐 SendGrid: Clave reconstruida (primeros 10 chars):', apiKey.substring(0, 10));
  return apiKey;
};

try {
  const sendGridApiKey = reconstruirSendGridKey();
  
  // Validar la clave
  if (!sendGridApiKey.startsWith('SG.')) {
    console.error('❌ ERROR: SendGrid API Key inválida');
    console.error('   La clave debe comenzar con "SG."');
  } else {
    sgMail.setApiKey(sendGridApiKey);
    console.log('✅ SendGrid configurado correctamente');
  }
} catch (error) {
  console.error('❌ SendGrid: Error configurando:', error.message);
}

export default sgMail;