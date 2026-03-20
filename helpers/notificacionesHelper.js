import { obtenerSeguidores, obtenerUsuarioPorId } from '../modelos/usuarioModelo.js';
import { crearNotificacionesMasivas } from '../modelos/notificacionModelo.js';
import { sendEmail } from './email.js';

// Plantillas para títulos y cuerpos
const plantillas = {
  nuevo_post: {
    title: (remitente) => `${remitente} publicó algo nuevo`,
    body: (remitente) => `${remitente} ha creado una nueva publicación. ¡Mírala ahora!`
  },
  nuevo_comentario: {
    title: (remitente) => `Nuevo comentario de ${remitente}`,
    body: (remitente) => `${remitente} comentó en una publicación.`
  },
  nuevo_seguidor: {
    title: (remitente) => `¡Tienes un nuevo seguidor!`,
    body: (remitente) => `${remitente} ahora te sigue.`
  }
};

/**
 * Notifica a todos los seguidores de un usuario sobre una acción
 * @param {string} usuarioId - ID del usuario que realiza la acción
 * @param {string} tipo - Tipo: 'nuevo_post', 'nuevo_comentario', 'nuevo_seguidor'
 * @param {Object} opciones - { referenciaId, tipoReferencia, link, excluirIds }
 */
export async function notificarASeguidores(usuarioId, tipo, opciones = {}) {
  try {
    // 1. Obtener datos del remitente
    const remitente = await obtenerUsuarioPorId(usuarioId);
    if (!remitente) return;

    // 2. Obtener seguidores
    const seguidores = await obtenerSeguidores(usuarioId);
    if (!seguidores.length) return;

    // 3. Verificar que el tipo tenga plantilla
    const plantilla = plantillas[tipo];
    if (!plantilla) {
      console.warn(`Tipo de notificación "${tipo}" no tiene plantilla definida`);
      return;
    }

    const notificaciones = [];
    const emailsPromises = [];

    for (const seguidor of seguidores) {
      // Excluir si está en la lista
      if (opciones.excluirIds?.includes(seguidor.id)) continue;

      const settings = seguidor.notificationSettings || {};
      const campoEmail = `email_${tipo}`;
      const campoPush = `push_${tipo}`;

      // Generar título y cuerpo
      const title = plantilla.title(remitente.nombre);
      const body = plantilla.body(remitente.nombre);
      
      // Generar link (puede venir en opciones o construirse)
      let link = opciones.link;
      if (!link && opciones.referenciaId && opciones.tipoReferencia) {
        link = `/${opciones.tipoReferencia}/${opciones.referenciaId}`;
      }

      // Notificación en BD (push)
      if (settings[campoPush] !== false) {
        notificaciones.push({
          userId: seguidor.id,
          type: tipo,
          title: title,
          body: body,
          link: link
        });
      }

      // Correo electrónico
      if (settings[campoEmail] !== false && seguidor.email) {
        emailsPromises.push(enviarCorreoNotificacion(
          seguidor.email,
          seguidor.nombre,
          tipo,
          remitente.nombre,
          link
        ));
      }
    }

    // Insertar notificaciones en lote
    if (notificaciones.length) {
      await crearNotificacionesMasivas(notificaciones);
    }

    // Enviar correos en segundo plano (no esperamos)
    Promise.allSettled(emailsPromises).catch(err => 
      console.error('Error enviando correos:', err)
    );

  } catch (error) {
    console.error('Error en notificarASeguidores:', error);
  }
}

// Función auxiliar para enviar correos
async function enviarCorreoNotificacion(emailDestino, nombreDestino, tipo, remitenteNombre, link) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  let asunto, html;

  switch (tipo) {
    case 'nuevo_post':
      asunto = `${remitenteNombre} ha creado un nuevo post`;
      html = `
        <h2>¡Nueva publicación!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> acaba de publicar algo nuevo.</p>
        <p><a href="${frontendUrl}${link || ''}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver publicación</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'nuevo_comentario':
      asunto = `${remitenteNombre} comentó en una publicación`;
      html = `
        <h2>¡Nuevo comentario!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> ha comentado en una publicación.</p>
        <p><a href="${frontendUrl}${link || ''}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver comentario</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'nuevo_seguidor':
      asunto = `¡Tienes un nuevo seguidor!`;
      html = `
        <h2>¡Nuevo seguidor!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> ahora te sigue en Rumbo.</p>
        <p><a href="${frontendUrl}/perfil/${remitenteNombre}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver perfil</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    default:
      return;
  }

  await sendEmail({ to: emailDestino, subject: asunto, html });
}