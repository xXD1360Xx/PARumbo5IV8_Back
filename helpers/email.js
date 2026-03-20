import sgMail from '../configuracion/sendgrid.js';

/**
 * Envía un correo electrónico usando SendGrid
 * @param {Object} options - Opciones del correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.html - Contenido HTML
 * @param {string} options.text - Contenido texto plano (opcional)
 */
export const sendEmail = async ({ to, subject, html, text = '' }) => {
  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'proyectoaularumbo@gmail.com',
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Si no hay texto, convertir HTML a texto
      html
    };

    await sgMail.send(msg);
    console.log(`✅ Correo enviado a ${to}: ${subject}`);
    return { exito: true };
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return { exito: false, error: error.message };
  }
};

// Mantener compatibilidad con el código existente
export const enviarCodigoCorreo = async ({ correo, codigo }) => {
  try {
    const html = `
      <h2>Código de verificación</h2>
      <p>Tu código es: <strong>${codigo}</strong></p>
      <p>Este código expirará en 10 minutos.</p>
    `;
    
    return await sendEmail({
      to: correo,
      subject: 'Código de verificación - Rumbo',
      html
    });
  } catch (error) {
    console.error('❌ Error en enviarCodigoCorreo:', error);
    return { exito: false };
  }
};