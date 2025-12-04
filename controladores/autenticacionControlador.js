import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login normal (usuario/contraseña)
export const iniciarSesion = async (identificador, contrasena) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Login manual para:", identificador);
    
    // Obtener conexión del pool
    client = await pool.connect();
    
    const query = `
      SELECT * FROM usuarios 
      WHERE email = $1 OR nombre_usuario = $1
    `;
    const result = await client.query(query, [identificador]);
    
    if (result.rows.length === 0) {
      console.log("❌ Usuario no encontrado:", identificador);
      return { exito: false, error: 'Usuario no encontrado' };
    }
    
    const usuario = result.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    
    if (!contrasenaValida) {
      console.log("❌ Contraseña incorrecta para:", identificador);
      return { exito: false, error: 'Contraseña incorrecta' };
    }
    
    const { contrasena_hash, ...usuarioSinPassword } = usuario;
    
    // Generar token
    const JWT_SECRETO = process.env.JWT_SECRETO;
    if (!JWT_SECRETO) {
      console.error("❌ JWT_SECRETO no configurado en variables de entorno");
      return { exito: false, error: 'Error de configuración del servidor' };
    }
    
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email,
        rol: usuario.rol 
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Login manual exitoso para:", usuario.email);
    console.log("🔑 Token generado:", token.substring(0, 20) + '...');
    
    return { 
      exito: true, 
      usuario: usuarioSinPassword,
      token: token
    };
    
  } catch (error) {
    console.error('❌ Error en iniciarSesion:', error.message);
    
    // Manejo específico de errores de conexión
    if (error.message.includes('ENOTFOUND')) {
      return { 
        exito: false, 
        error: 'Error de conexión a la base de datos',
        detalle: 'Problema de red o DNS'
      };
    }
    
    return { exito: false, error: 'Error del servidor' };
  } finally {
    // Liberar cliente si existe
    if (client) {
      client.release();
    }
  }
};

// Registro manual
export const registrarUsuario = async (datosUsuario) => {
  let client;
  
  try {
    const { nombre, email, contrasena, nombreUsuario } = datosUsuario;
    console.log("🔍 [CONTROLADOR] Registro manual para:", email);
    
    // Obtener conexión del pool
    client = await pool.connect();
    
    // Verificar si el usuario ya existe
    const usuarioExistente = await client.query(
      'SELECT id FROM usuarios WHERE email = $1 OR nombre_usuario = $2',
      [email, nombreUsuario]
    );
    
    if (usuarioExistente.rows.length > 0) {
      console.log("❌ Usuario ya existe:", email);
      return { exito: false, error: 'El usuario ya existe' };
    }
    
    // Hash de la contraseña
    const saltRounds = 10;
    const contrasenaHash = await bcrypt.hash(contrasena, saltRounds);
    
    // Insertar nuevo usuario
    const result = await client.query(
      `INSERT INTO usuarios (nombre, email, contrasena_hash, nombre_usuario, rol) 
       VALUES ($1, $2, $3, $4, 'usuario') 
       RETURNING id, nombre, email, nombre_usuario, rol, fecha_creacion`,
      [nombre, email, contrasenaHash, nombreUsuario]
    );
    
    // Generar token para el nuevo usuario
    const JWT_SECRETO = process.env.JWT_SECRETO;
    if (!JWT_SECRETO) {
      console.error("❌ JWT_SECRETO no configurado");
      return { exito: false, error: 'Error de configuración del servidor' };
    }
    
    const token = jwt.sign(
      { 
        id: result.rows[0].id, 
        email: result.rows[0].email,
        rol: result.rows[0].rol 
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Registro exitoso para:", email);
    console.log("🔑 Token generado:", token.substring(0, 20) + '...');
    
    return { 
      exito: true, 
      usuario: result.rows[0],
      token: token  // IMPORTANTE: Devuelve token también en registro
    };
    
  } catch (error) {
    console.error('❌ Error en registrarUsuario:', error.message);
    
    // Manejo específico de errores de conexión
    if (error.message.includes('ENOTFOUND')) {
      return { 
        exito: false, 
        error: 'Error de conexión a la base de datos',
        detalle: 'Problema de red o DNS'
      };
    }
    
    return { exito: false, error: 'Error del servidor' };
  } finally {
    // Liberar cliente si existe
    if (client) {
      client.release();
    }
  }
};

// Login con Google - VERSIÓN OPTIMIZADA
export const loginConGoogle = async (accessToken) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Token Google recibido:", accessToken?.substring(0, 30) + '...');
    
    if (!accessToken || accessToken.trim() === '') {
      console.error("❌ Token vacío o inválido");
      return { exito: false, error: 'Token inválido' };
    }
    
    console.log("🔍 Llamando a Google API...");
    
    // Validar token con Google con timeout más corto
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`,
      {
        timeout: 8000,  // 8 segundos máximo
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log("✅ Respuesta de Google recibida:", {
      email: respuesta.data.email,
      name: respuesta.data.name.substring(0, 20) + '...'
    });

    // CONEXIÓN A DB
    try {
      client = await pool.connect();
      console.log("✅ Conexión a DB exitosa");
    } catch (dbError) {
      console.error("❌ Error conectando a DB:", dbError.message);
      
      // Información detallada del error
      if (dbError.message.includes('ENOTFOUND')) {
        console.error("🚨 ERROR DNS - No se puede resolver hostname de DB");
        return { 
          exito: false, 
          error: 'Error de conexión: No se puede conectar a la base de datos',
          codigo: 'DNS_ERROR'
        };
      }
      
      return { 
        exito: false, 
        error: 'Error de conexión a base de datos'
      };
    }

    try {
      // Buscar usuario por email
      console.log("🔍 Buscando usuario con email:", respuesta.data.email);
      const query = 'SELECT * FROM usuarios WHERE email = $1';
      const result = await client.query(query, [respuesta.data.email]);
      
      let usuario;
      
      if (result.rows.length > 0) {
        console.log("✅ Usuario encontrado en DB");
        // Usuario existe
        usuario = result.rows[0];
        // Remover contraseña hash si existe
        if (usuario.contrasena_hash) {
          const { contrasena_hash, ...usuarioSinPassword } = usuario;
          usuario = usuarioSinPassword;
        }
      } else {
        console.log("🆕 Creando nuevo usuario...");
        // Crear nuevo usuario
        const nombreUsuarioBase = respuesta.data.name.toLowerCase().replace(/\s+/g, '_');
        const randomNum = Math.floor(Math.random() * 10000);
        const nombreUsuario = `${nombreUsuarioBase}_${randomNum}`;
        
        const insertQuery = `
          INSERT INTO usuarios (nombre, email, nombre_usuario, rol, foto_perfil) 
          VALUES ($1, $2, $3, 'usuario', $4) 
          RETURNING id, nombre, email, nombre_usuario, rol, foto_perfil
        `;
        
        const nuevoUsuario = await client.query(insertQuery, [
          respuesta.data.name,
          respuesta.data.email,
          nombreUsuario,
          respuesta.data.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png'
        ]);
        
        usuario = nuevoUsuario.rows[0];
        console.log("✅ Nuevo usuario creado con ID:", usuario.id);
      }
      
      // Generar token JWT
      const JWT_SECRETO = process.env.JWT_SECRETO;
      if (!JWT_SECRETO) {
        console.error("❌ JWT_SECRETO no configurado");
        return { exito: false, error: 'Error de configuración del servidor' };
      }
      
      const token = jwt.sign(
        { 
          id: usuario.id, 
          email: usuario.email,
          rol: usuario.rol 
        },
        JWT_SECRETO,
        { expiresIn: '7d' }
      );
      
      console.log("✅ Token JWT generado:", token.substring(0, 20) + '...');
      
      return {
        exito: true, 
        usuario: usuario,
        token: token
      };
      
    } catch (queryError) {
      console.error("❌ Error en consulta SQL:", queryError.message);
      return { 
        exito: false, 
        error: 'Error al procesar usuario en la base de datos',
        codigo: 'QUERY_ERROR'
      };
    } finally {
      // SIEMPRE liberar el cliente
      if (client) {
        client.release();
      }
    }
    
  } catch (error) {
    console.error('❌ Error en loginConGoogle:', error.message);
    
    // Manejo específico para errores de Google API
    if (error.response?.status === 401) {
      return { exito: false, error: 'Token de Google inválido o expirado' };
    }
    
    if (error.code === 'ECONNABORTED') {
      return { exito: false, error: 'Tiempo de espera agotado al conectar con Google' };
    }
    
    return { 
      exito: false, 
      error: 'Error autenticando con Google'
    };
  }
};

// Cambiar contraseña
export const cambiarContrasena = async (usuarioId, contrasenaActual, nuevaContrasena) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Obtener usuario actual
    const query = 'SELECT contrasena_hash FROM usuarios WHERE id = $1';
    const result = await client.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return { exito: false, error: 'Usuario no encontrado' };
    }
    
    const usuario = result.rows[0];
    
    // Verificar contraseña actual
    const contrasenaActualValida = await bcrypt.compare(contrasenaActual, usuario.contrasena_hash);
    
    if (!contrasenaActualValida) {
      return { exito: false, error: 'Contraseña actual incorrecta' };
    }
    
    // Hash de la nueva contraseña
    const saltRounds = 10;
    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, saltRounds);
    
    // Actualizar en la base de datos
    const updateQuery = 'UPDATE usuarios SET contrasena_hash = $1, updated_at = NOW() WHERE id = $2';
    await client.query(updateQuery, [nuevaContrasenaHash, usuarioId]);
    
    return { exito: true };
    
  } catch (error) {
    console.error('Error en cambiarContrasena:', error);
    return { exito: false, error: 'Error del servidor' };
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Cerrar sesión
export const cerrarSesion = async (usuarioId) => {
  return { exito: true };
};