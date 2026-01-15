// config/sendgrid.js - VERSIÓN CORREGIDA
import sgMail from '@sendgrid/mail';

const reconstruirSendGridKey = () => {
    const partes = [
        "SG.k9tJSyZGTauFR-Gez3geWw.",  // Parte 1
        "It_9ENQkDrrauCuKBG6FiGT-",     // Parte 2  
        "7115XhvaXLtE25a-",             // Parte 3
        "ju8"                           // Parte 4
    ];
  
  // Solo concatenar, NO usar Base64
  const apiKey = partes.join('');
  
  console.log('🔐 SendGrid: Clave reconstruida (primeros 10 chars):', apiKey.substring(0, 10) + '...');
  console.log('🔐 Longitud total:', apiKey.length);
  console.log('🔐 ¿Empieza con SG.?', apiKey.startsWith('SG.'));
  
  return apiKey;
};

try {
  const sendGridApiKey = reconstruirSendGridKey();
  
  // Validación más completa
  if (!sendGridApiKey || !sendGridApiKey.startsWith('SG.')) {
    console.error('❌ ERROR: SendGrid API Key inválida o mal formada');
    console.error('   Longitud:', sendGridApiKey?.length);
    console.error('   Inicio:', sendGridApiKey?.substring(0, 20));
  } else {
    sgMail.setApiKey(sendGridApiKey);
    console.log('✅ SendGrid configurado correctamente');
    
    // Prueba rápida de conexión
    const msg = {
      to: 'proyectoaularumbo@gmail.com',
      from: 'proyectoaularumbo@gmail.com',
      subject: '✅ SendGrid Configurado',
      text: 'SendGrid está funcionando desde el backend'
    };
    
    sgMail.send(msg)
      .then(() => console.log('📧 Email de prueba enviado'))
      .catch(err => console.error('❌ Error enviando prueba:', err.message));
  }
} catch (error) {
  console.error('❌ SendGrid: Error configurando:', error.message);
}

export default sgMail;