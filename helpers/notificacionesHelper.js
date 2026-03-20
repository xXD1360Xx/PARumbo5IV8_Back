import { obtenerSeguidores, obtenerUsuarioPorId } from '../modelos/usuarioModelo.js';
import { crearNotificacionesMasivas, crearNotificacion } from '../modelos/notificacionModelo.js';
import { sendEmail } from './email.js';

// Plantillas para títulos y cuerpos
// Mapeo de nuestros tipos internos a los valores del enum de Supabase
const plantillas = {
  nuevo_post: {
    dbType: 'NEW_POST_FOLLOWED',
    title: (remitente) => `${remitente} publicó algo nuevo`,
    body: (remitente) => `${remitente} ha creado una nueva publicación.`,
    esParaSeguidores: true
  },
  nuevo_comentario: {
    dbType: 'POST_COMMENT',
    title: (remitente) => `Nuevo comentario de ${remitente}`,
    body: (remitente) => `${remitente} comentó en una publicación.`,
    esParaSeguidores: true
  },
  nuevo_seguidor: {
    dbType: 'NEW_FOLLOWER',  // <-- DEBE EXISTIR EN SUPABASE (si no, pedir agregarlo)
    title: (remitente) => `¡Tienes un nuevo seguidor!`,
    body: (remitente) => `${remitente} ahora te sigue.`,
    esParaSeguidores: true
  },
  forum_aprobado: {
    dbType: 'FORUM_REQUEST',
    title: () => 'Foro aprobado',
    body: (nombreForo) => `Tu solicitud para crear "${nombreForo}" fue aprobada`,
    esParaSeguidores: false
  },
  forum_rechazado: {
    dbType: 'FORUM_REQUEST',
    title: () => 'Foro rechazado',
    body: (nombreForo) => `Tu solicitud para crear "${nombreForo}" fue rechazada`,
    esParaSeguidores: false
  },
  respuesta_comentario: {
    dbType: 'COMMENT_REPLY',
    title: (remitente) => `${remitente} respondió a tu comentario`,
    body: (remitente) => `${remitente} ha respondido a tu comentario.`,
    esParaSeguidores: false
  },
  publicacion_ocultada: {
    dbType: 'POST_HIDDEN',
    title: () => 'Publicación ocultada',
    body: () => 'Tu publicación ha infringido las normas de convivencia y ha sido ocultada',
    esParaSeguidores: false
  },
  cuenta_desactivada: {
    dbType: 'ACCOUNT_DEACTIVATED',
    title: () => 'Cuenta desactivada',
    body: () => 'Tu cuenta ha sido desactivada. Contacta con soporte para más información.',
    esParaSeguidores: false
  }
};

/**
 * Notifica a todos los seguidores de un usuario sobre una acción
 * @param {string} usuarioId - ID del usuario que realiza la acción
 * @param {string} tipo - Tipo de notificación (debe existir en plantillas)
 * @param {Object} opciones - { referenciaId, tipoReferencia, link, excluirIds }
 */
export async function notificarASeguidores(usuarioId, tipo, opciones = {}) {
  try {
    const plantilla = plantillas[tipo];
    if (!plantilla) {
      console.warn(`Tipo de notificación "${tipo}" no tiene plantilla definida`);
      return;
    }

    // Solo notificaciones que van a seguidores
    if (!plantilla.esParaSeguidores) {
      console.warn(`El tipo "${tipo}" no está diseñado para notificar a seguidores`);
      return;
    }

    // 1. Obtener datos del remitente
    const remitente = await obtenerUsuarioPorId(usuarioId);
    if (!remitente) return;

    // 2. Obtener seguidores
    const seguidores = await obtenerSeguidores(usuarioId);
    if (!seguidores.length) return;

    const notificaciones = [];
    const emailsPromises = [];

    for (const seguidor of seguidores) {
      if (opciones.excluirIds?.includes(seguidor.id)) continue;

      const settings = seguidor.notificationSettings || {};
      const campoEmail = `email_${tipo}`;
      const campoPush = `push_${tipo}`;

      const title = plantilla.title(remitente.nombre);
      const body = plantilla.body(remitente.nombre);

      let link = opciones.link;
      if (!link && opciones.referenciaId && opciones.tipoReferencia) {
        link = `/${opciones.tipoReferencia}/${opciones.referenciaId}`;
      }

      // Notificación en BD (push)
      if (settings[campoPush] !== false) {
        notificaciones.push({
          userId: seguidor.id,
          type: plantilla.dbType,  // Usamos el valor correcto del enum
          title,
          body,
          link
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

    // Enviar correos en segundo plano
    Promise.allSettled(emailsPromises).catch(err => 
      console.error('Error enviando correos:', err)
    );

  } catch (error) {
    console.error('Error en notificarASeguidores:', error);
  }
}

/**
 * Notifica directamente a un usuario específico (no a sus seguidores)
 * Útil para foros, respuestas a comentarios, ocultación de posts, etc.
 * @param {string} destinatarioId - ID del usuario que recibirá la notificación
 * @param {string} tipo - Tipo de notificación (debe existir en plantillas)
 * @param {Object} opciones - { referenciaId, link, datosExtra (como nombreForo, remitenteId, etc.) }
 */
export async function notificarUsuarioDirecto(destinatarioId, tipo, opciones = {}) {
  try {
    const plantilla = plantillas[tipo];
    if (!plantilla) {
      console.warn(`Tipo de notificación "${tipo}" no tiene plantilla definida`);
      return;
    }

    // Obtener datos del remitente si se proporciona
    let remitente = null;
    if (opciones.remitenteId) {
      remitente = await obtenerUsuarioPorId(opciones.remitenteId);
    }

    // Obtener datos del destinatario (para configuraciones)
    const destinatario = await obtenerUsuarioPorId(destinatarioId);
    if (!destinatario) return;

    // Generar título y cuerpo según el tipo
    let title, body;
    if (tipo === 'forum_aprobado' || tipo === 'forum_rechazado') {
      title = plantilla.title();
      body = plantilla.body(opciones.nombreForo || 'el foro');
    } else if (tipo === 'respuesta_comentario' || tipo === 'nuevo_seguidor') {
      if (!remitente) {
        console.warn(`Tipo "${tipo}" requiere remitenteId en opciones`);
        return;
      }
      title = plantilla.title(remitente.nombre);
      body = plantilla.body(remitente.nombre);
    } else {
      title = plantilla.title();
      body = plantilla.body();
    }

    let link = opciones.link;
    if (!link && opciones.referenciaId && opciones.tipoReferencia) {
      link = `/${opciones.tipoReferencia}/${opciones.referenciaId}`;
    }

    // Verificar configuración del destinatario
    const settings = destinatario.notificationSettings || {};
    const campoPush = `push_${tipo}`;
    const campoEmail = `email_${tipo}`;

    // Crear notificación en BD si está activada
    if (settings[campoPush] !== false) {
      await crearNotificacion(
        destinatarioId,
        plantilla.dbType,
        title,
        body,
        link
      );
    }

    // Enviar correo si está activado
    if (settings[campoEmail] !== false && destinatario.email) {
      const remitenteNombre = remitente ? remitente.nombre : 'Sistema';
      await enviarCorreoNotificacion(
        destinatario.email,
        destinatario.nombre,
        tipo,
        remitenteNombre,
        link
      );
    }

  } catch (error) {
    console.error('Error en notificarUsuarioDirecto:', error);
  }
}

/**
 * Función auxiliar para enviar correos
 * @param {string} emailDestino - Correo del destinatario
 * @param {string} nombreDestino - Nombre del destinatario
 * @param {string} tipo - Tipo de notificación (para personalizar asunto)
 * @param {string} remitenteNombre - Nombre del remitente (puede ser 'Sistema')
 * @param {string} link - Enlace (opcional)
 */
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
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'nuevo_comentario':
      asunto = `${remitenteNombre} comentó en una publicación`;
      html = `
        <h2>¡Nuevo comentario!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> ha comentado en una publicación.</p>
        <p><a href="${frontendUrl}${link || ''}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver comentario</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'nuevo_seguidor':
      asunto = `¡Tienes un nuevo seguidor!`;
      html = `
        <h2>¡Nuevo seguidor!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> ahora te sigue en Rumbo.</p>
        <p><a href="${frontendUrl}/perfil/${remitenteNombre}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver perfil</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'forum_aprobado':
      asunto = `Solicitud de foro aprobada`;
      html = `
        <h2>¡Foro aprobado!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p>Tu solicitud para crear el foro ha sido aprobada.</p>
        <p><a href="${frontendUrl}${link || '/foros'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver foros</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'forum_rechazado':
      asunto = `Solicitud de foro rechazada`;
      html = `
        <h2>Foro rechazado</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p>Tu solicitud para crear el foro no ha sido aprobada.</p>
        <p><a href="${frontendUrl}${link || '/solicitudes'}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver detalles</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'respuesta_comentario':
      asunto = `${remitenteNombre} respondió a tu comentario`;
      html = `
        <h2>¡Nueva respuesta!</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p><strong>${remitenteNombre}</strong> ha respondido a tu comentario.</p>
        <p><a href="${frontendUrl}${link || ''}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver respuesta</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'publicacion_ocultada':
      asunto = `Tu publicación fue ocultada`;
      html = `
        <h2>Publicación ocultada</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p>Tu publicación ha sido ocultada por infringir las normas de convivencia.</p>
        <p><a href="${frontendUrl}/soporte" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Contactar soporte</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    case 'cuenta_desactivada':
      asunto = `Tu cuenta ha sido desactivada`;
      html = `
        <h2>Cuenta desactivada</h2>
        <p>Hola <strong>${nombreDestino}</strong>,</p>
        <p>Tu cuenta ha sido desactivada. Si crees que es un error, contacta con soporte.</p>
        <p><a href="${frontendUrl}/soporte" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Contactar soporte</a></p>
        <hr><p style="color: #666; font-size: 12px;">© 2024 Rumbo - Red social para estudiantes del IPN</p>
      `;
      break;
    default:
      return;
  }

  await sendEmail({ to: emailDestino, subject: asunto, html });
}