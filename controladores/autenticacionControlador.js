import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Login normal (usuario/contraseña)
export const iniciarSesion = async (identificador, contrasena) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Login manual para:", identificador);
    console.log("📊 Entorno:", process.env.ENTORNO || 'desarrollo');
    console.log("🔑 JWT_SECRETO:", process.env.JWT_SECRETO ? "✓ CONFIGURADO" : "✗ NO CONFIGURADO");
    
    // Validación de entrada
    if (!identificador || !contrasena) {
      console.error("❌ Credenciales incompletas");
      return { 
        exito: false, 
        error: 'Credenciales incompletas',
        codigo: 'CREDENCIALES_INCOMPLETAS'
      };
    }
    
    // Obtener conexión del pool
    console.log("🔗 Conectando a base de datos...");
    client = await pool.connect();
    console.log("✅ Conexión a DB establecida");
    
    // CORREGIDO: Usar _users con columnas correctas
    const query = `
      SELECT id, full_name as nombre, email, username as nombre_usuario, 
             role as rol, password as contrasena_hash, 
             created_at as fecha_creacion, avatar_url as foto_perfil 
      FROM _users 
      WHERE email = $1 OR username = $1
    `;
    
    const result = await client.query(query, [identificador]);
    
    if (result.rows.length === 0) {
      console.log("❌ Usuario no encontrado:", identificador);
      return { 
        exito: false, 
        error: 'Usuario no encontrado',
        codigo: 'USUARIO_NO_ENCONTRADO'
      };
    }
    
    const usuario = result.rows[0];
    console.log("✅ Usuario encontrado ID:", usuario.id);
    
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    
    if (!contrasenaValida) {
      console.log("❌ Contraseña incorrecta para:", identificador);
      return { 
        exito: false, 
        error: 'Contraseña incorrecta',
        codigo: 'CONTRASENA_INCORRECTA'
      };
    }
    
    // Remover contraseña del objeto usuario
    const { contrasena_hash, ...usuarioSinPassword } = usuario;
    
    // Generar token
    const JWT_SECRETO = process.env.JWT_SECRETO;
    if (!JWT_SECRETO) {
      console.error("❌ JWT_SECRETO no configurado en variables de entorno");
      return { 
        exito: false, 
        error: 'Error de configuración del servidor',
        codigo: 'JWT_NO_CONFIGURADO'
      };
    }
    
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol || 'user'
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Login manual exitoso para:", usuario.email);
    console.log("🔑 Token generado (primeros 20):", token.substring(0, 20) + '...');
    
    return { 
      exito: true, 
      usuario: usuarioSinPassword,
      token: token
    };
    
  } catch (error) {
    console.error('❌ Error en iniciarSesion:', error.message);
    console.error('🔧 Stack:', error.stack);
    
    // Manejo específico de errores de conexión
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      return { 
        exito: false, 
        error: 'Error de conexión a la base de datos',
        codigo: 'ERROR_CONEXION_DB',
        detalle: 'No se puede conectar al servidor de base de datos'
      };
    }
    
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      return { 
        exito: false, 
        error: 'Tiempo de espera agotado',
        codigo: 'TIMEOUT_DB',
        detalle: 'La base de datos no responde'
      };
    }
    
    return { 
      exito: false, 
      error: 'Error del servidor al iniciar sesión',
      codigo: 'ERROR_SERVIDOR'
    };
  } finally {
    // Liberar cliente si existe
    if (client) {
      client.release();
      console.log("🔗 Conexión a DB liberada");
    }
  }
};

// Registro manual - VERSIÓN CORREGIDA CON LA ESTRUCTURA REAL
export const registrarUsuario = async (datosUsuario) => {
  let client;
  
  try {
    const { nombre, email, contrasena, nombreUsuario, rol } = datosUsuario;
    console.log("🔍 [CONTROLADOR] Registro manual para:", email);
    
    // Validación de entrada
    if (!nombre || !email || !contrasena || !nombreUsuario) {
      console.error("❌ Datos incompletos para registro");
      return { 
        exito: false, 
        error: 'Todos los campos son requeridos',
        codigo: 'DATOS_INCOMPLETOS'
      };
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { 
        exito: false, 
        error: 'Formato de email inválido',
        codigo: 'EMAIL_INVALIDO'
      };
    }
    
    // Validar contraseña
    if (contrasena.length < 6) {
      return { 
        exito: false, 
        error: 'La contraseña debe tener al menos 6 caracteres',
        codigo: 'CONTRASENA_CORTA'
      };
    }
    
    // Validar username
    if (nombreUsuario.length < 3) {
      return { 
        exito: false, 
        error: 'El nombre de usuario debe tener al menos 3 caracteres',
        codigo: 'USERNAME_CORTO'
      };
    }
    
    // Obtener conexión del pool
    client = await pool.connect();
    
    // Verificar si el usuario ya existe (usando _users con columnas correctas)
    const usuarioExistente = await client.query(
      'SELECT id FROM _users WHERE email = $1 OR username = $2',
      [email, nombreUsuario]
    );
    
    if (usuarioExistente.rows.length > 0) {
      console.log("❌ Usuario ya existe:", email);
      return { 
        exito: false, 
        error: 'El usuario ya existe',
        codigo: 'USUARIO_EXISTENTE'
      };
    }
    
    // Hash de la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(contrasena, saltRounds);
    
    // Generar ID único (UUID)
    const userId = uuidv4();
    
    // Insertar nuevo usuario en _users (con las columnas correctas)
    const result = await client.query(
      `INSERT INTO _users (id, username, full_name, email, password, role, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [userId, nombreUsuario, nombre, email, passwordHash, rol] 
    );
    
    // Generar token para el nuevo usuario
    const JWT_SECRETO = process.env.JWT_SECRETO;
    if (!JWT_SECRETO) {
      console.error("❌ JWT_SECRETO no configurado");
      return { 
        exito: false, 
        error: 'Error de configuración del servidor',
        codigo: 'JWT_NO_CONFIGURADO'
      };
    }
    
    const nuevoUsuario = result.rows[0];
    const token = jwt.sign(
      { 
        id: nuevoUsuario.id, 
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre,
        rol: nuevoUsuario.rol 
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Registro exitoso para:", email);
    console.log("🔑 Token generado (primeros 20):", token.substring(0, 20) + '...');
    console.log("📋 Usuario creado:", {
      id: nuevoUsuario.id,
      username: nuevoUsuario.nombre_usuario,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol
    });
    
    return { 
      exito: true, 
      usuario: nuevoUsuario,
      token: token
    };
    
  } catch (error) {
    console.error('❌ Error en registrarUsuario:', error.message);
    console.error('🔧 Stack:', error.stack);
    
    // Error específico de tabla no existe
    if (error.message.includes('_users') && error.message.includes('does not exist')) {
      return { 
        exito: false, 
        error: 'Error de configuración de base de datos: tabla _users no existe',
        codigo: 'TABLA_NO_EXISTE'
      };
    }
    
    // Manejo específico de errores de conexión
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      return { 
        exito: false, 
        error: 'Error de conexión a la base de datos',
        codigo: 'ERROR_CONEXION_DB'
      };
    }
    
    // Error de duplicado
    if (error.message.includes('duplicate key') || error.code === '23505') {
      return { 
        exito: false, 
        error: 'El usuario ya existe',
        codigo: 'USUARIO_DUPLICADO'
      };
    }
    
    return { 
      exito: false, 
      error: 'Error del servidor en registro: ' + error.message,
      codigo: 'ERROR_SERVIDOR'
    };
  } finally {
    // Liberar cliente si existe
    if (client) {
      client.release();
    }
  }
};

// Login con Google - VERSIÓN CORREGIDA
export const loginConGoogle = async (accessToken) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Token Google recibido:", accessToken?.substring(0, 30) + '...');
    
    if (!accessToken || accessToken.trim() === '') {
      console.error("❌ Token vacío o inválido");
      return { 
        exito: false, 
        error: 'Token inválido',
        codigo: 'TOKEN_INVALIDO'
      };
    }
    
    console.log("🔍 Llamando a Google API...");
    
    // Validar token con Google
    const respuesta = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`,
      {
        timeout: 10000,  // 10 segundos máximo
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log("✅ Respuesta de Google recibida:", {
      email: respuesta.data.email,
      name: respuesta.data.name?.substring(0, 20) + '...',
      id: respuesta.data.id
    });

    // CONEXIÓN A DB
    try {
      client = await pool.connect();
      console.log("✅ Conexión a DB exitosa");
    } catch (dbError) {
      console.error("❌ Error conectando a DB:", dbError.message);
      
      if (dbError.message.includes('ENOTFOUND') || dbError.message.includes('getaddrinfo')) {
        console.error("🚨 ERROR DNS - No se puede resolver hostname de DB");
        return { 
          exito: false, 
          error: 'Error de conexión a la base de datos',
          codigo: 'DNS_ERROR'
        };
      }
      
      return { 
        exito: false, 
        error: 'Error de conexión a base de datos',
        codigo: 'ERROR_CONEXION_DB'
      };
    }

    try {
      // Buscar usuario por email (usando _users)
      console.log("🔍 Buscando usuario con email:", respuesta.data.email);
      const query = `
        SELECT id, full_name as nombre, email, username as nombre_usuario, 
               role as rol, avatar_url as foto_perfil, created_at as fecha_creacion 
        FROM _users WHERE email = $1
      `;
      const result = await client.query(query, [respuesta.data.email]);
      
      let usuario;
      
      if (result.rows.length > 0) {
        console.log("✅ Usuario encontrado en DB, ID:", result.rows[0].id);
        usuario = result.rows[0];
      } else {
        console.log("🆕 Creando nuevo usuario...");
        // Generar ID único
        const userId = uuidv4();
        
        // Crear username basado en el nombre
        const nombreUsuarioBase = respuesta.data.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'usuario';
        const randomNum = Math.floor(Math.random() * 10000);
        const username = `${nombreUsuarioBase}_${randomNum}`;
        
        const insertQuery = `
          INSERT INTO _users (id, username, full_name, email, role, avatar_url, created_at, updated_at) 
          VALUES ($1, $2, $3, $4, 'user', $5, NOW(), NOW()) 
          RETURNING id, username as nombre_usuario, full_name as nombre, email, role as rol, avatar_url as foto_perfil, created_at as fecha_creacion
        `;
        
        const nuevoUsuario = await client.query(insertQuery, [
          userId,
          username,
          respuesta.data.name || respuesta.data.email.split('@')[0],
          respuesta.data.email,
          respuesta.data.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png'
        ]);
        
        usuario = nuevoUsuario.rows[0];
        console.log("✅ Nuevo usuario creado con ID:", usuario.id);
      }
      
      // Generar token JWT
      const JWT_SECRETO = process.env.JWT_SECRETO;
      if (!JWT_SECRETO) {
        console.error("❌ JWT_SECRETO no configurado");
        return { 
          exito: false, 
          error: 'Error de configuración del servidor',
          codigo: 'JWT_NO_CONFIGURADO'
        };
      }
      
      const token = jwt.sign(
        { 
          id: usuario.id, 
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol 
        },
        JWT_SECRETO,
        { expiresIn: '7d' }
      );
      
      console.log("✅ Token JWT generado (primeros 20):", token.substring(0, 20) + '...');
      
      return {
        exito: true, 
        usuario: usuario,
        token: token
      };
      
    } catch (queryError) {
      console.error("❌ Error en consulta SQL:", queryError.message);
      console.error("🔧 Stack:", queryError.stack);
      return { 
        exito: false, 
        error: 'Error al procesar usuario en la base de datos',
        codigo: 'QUERY_ERROR'
      };
    } finally {
      // SIEMPRE liberar el cliente
      if (client) {
        client.release();
        console.log("🔗 Conexión a DB liberada");
      }
    }
    
  } catch (error) {
    console.error('❌ Error en loginConGoogle:', error.message);
    console.error('🔧 Stack:', error.stack);
    
    // Manejo específico para errores de Google API
    if (error.response?.status === 401) {
      return { 
        exito: false, 
        error: 'Token de Google inválido o expirado',
        codigo: 'GOOGLE_TOKEN_INVALIDO'
      };
    }
    
    if (error.code === 'ECONNABORTED') {
      return { 
        exito: false, 
        error: 'Tiempo de espera agotado al conectar con Google',
        codigo: 'GOOGLE_TIMEOUT'
      };
    }
    
    if (error.response?.status === 400) {
      return { 
        exito: false, 
        error: 'Token de Google mal formado',
        codigo: 'GOOGLE_TOKEN_MALFORMADO'
      };
    }
    
    return { 
      exito: false, 
      error: 'Error autenticando con Google',
      codigo: 'ERROR_GOOGLE'
    };
  }
};

// Cambiar contraseña - VERSIÓN CORREGIDA
export const cambiarContrasena = async (usuarioId, contrasenaActual, nuevaContrasena) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Cambiar contraseña para usuario ID:", usuarioId);
    
    // Validar nueva contraseña
    if (nuevaContrasena.length < 6) {
      return { 
        exito: false, 
        error: 'La nueva contraseña debe tener al menos 6 caracteres',
        codigo: 'CONTRASENA_CORTA'
      };
    }
    
    client = await pool.connect();
    
    // Obtener usuario actual (usando _users)
    const query = 'SELECT password as contrasena_hash FROM _users WHERE id = $1';
    const result = await client.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return { 
        exito: false, 
        error: 'Usuario no encontrado',
        codigo: 'USUARIO_NO_ENCONTRADO'
      };
    }
    
    const usuario = result.rows[0];
    
    // Verificar contraseña actual
    const contrasenaActualValida = await bcrypt.compare(contrasenaActual, usuario.contrasena_hash);
    
    if (!contrasenaActualValida) {
      return { 
        exito: false, 
        error: 'Contraseña actual incorrecta',
        codigo: 'CONTRASENA_ACTUAL_INCORRECTA'
      };
    }
    
    // Hash de la nueva contraseña
    const saltRounds = 10;
    const nuevaPasswordHash = await bcrypt.hash(nuevaContrasena, saltRounds);
    
    // Actualizar en la base de datos (usando _users)
    const updateQuery = 'UPDATE _users SET password = $1, updated_at = NOW() WHERE id = $2';
    await client.query(updateQuery, [nuevaPasswordHash, usuarioId]);
    
    console.log("✅ Contraseña actualizada para usuario ID:", usuarioId);
    
    return { 
      exito: true,
      mensaje: 'Contraseña actualizada correctamente'
    };
    
  } catch (error) {
    console.error('❌ Error en cambiarContrasena:', error.message);
    console.error('🔧 Stack:', error.stack);
    return { 
      exito: false, 
      error: 'Error del servidor al cambiar contraseña',
      codigo: 'ERROR_SERVIDOR'
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Cerrar sesión
export const cerrarSesion = async (usuarioId) => {
  console.log("🔍 [CONTROLADOR] Cerrar sesión para usuario ID:", usuarioId);
  return { 
    exito: true,
    mensaje: 'Sesión cerrada correctamente'
  };
};

// Función para obtener estructura de _users (para debug)
export const obtenerEstructuraUsers = async () => {
  let client;
  try {
    client = await pool.connect();
    
    const columnas = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = '_users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Columnas de la tabla _users:');
    columnas.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) - Nulo: ${col.is_nullable === 'YES' ? '✅ SÍ' : '❌ NO'}`);
    });
    
    return columnas.rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo estructura:', error.message);
    return null;
  } finally {
    if (client) client.release();
  }
};