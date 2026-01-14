import axios from "axios";
import { pool } from '../configuracion/basedeDatos.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Login normal (usuario/contraseña) - VERSIÓN SHA256
export const iniciarSesion = async (identificador, contrasena) => {
  let client;
  
  try {
    console.log("🔍 [CONTROLADOR] Login manual para:", identificador);
    console.log("📊 Entorno:", process.env.ENTORNO || 'desarrollo');
    
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
    
    const query = `
      SELECT id, full_name, email, username, role, password, 
             created_at, avatar_url, banner_url, bio
      FROM _users 
      WHERE email = $1 OR username = $1
    `;
    
    console.log("🔍 Ejecutando query para:", identificador);
    const result = await client.query(query, [identificador.trim()]);
    
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
    console.log("📊 Datos del usuario:", {
      email: usuario.email,
      username: usuario.username,
      passwordLength: usuario.password ? usuario.password.length : 0,
      passwordType: typeof usuario.password,
      passwordPreview: usuario.password ? usuario.password.substring(0, 30) + '...' : 'null'
    });
    
    // VALIDAR QUE TENEMOS UN HASH VÁLIDO
    if (!usuario.password) {
      console.error("❌ ERROR: Campo 'password' está vacío o null en BD");
      return { 
        exito: false, 
        error: 'Error en datos del usuario',
        codigo: 'DATOS_USUARIO_INVALIDOS'
      };
    }
    
    if (typeof usuario.password !== 'string') {
      console.error("❌ ERROR: 'password' no es un string, es:", typeof usuario.password);
      return { 
        exito: false, 
        error: 'Error en datos del usuario',
        codigo: 'DATOS_USUARIO_INVALIDOS'
      };
    }
    
    const hash = usuario.password.trim();
    console.log("🔑 Comparando contraseña...");
    console.log("🔍 Contraseña recibida:", contrasena);
    console.log("🔍 Hash de BD (primeros 30):", hash.substring(0, 30) + '...');
    
    // DETECTAR TIPO DE HASH
    const esHashBcrypt = hash && hash.startsWith('$2');
    const esHashSHA256 = hash && hash.length === 64 && /^[a-f0-9]{64}$/i.test(hash);
    
    console.log("🔍 Tipo de hash detectado:", {
      esHashBcrypt,
      esHashSHA256,
      hashLongitud: hash?.length
    });
    
    let contrasenaValida = false;
    
    // VERIFICAR CONTRASEÑA SEGÚN TIPO DE HASH
    if (esHashBcrypt) {
      console.log("🔑 Verificando con bcrypt...");
      try {
        contrasenaValida = await bcrypt.compare(contrasena, hash);
        console.log("✅ Comparación bcrypt:", contrasenaValida);
        
        // Si es bcrypt pero la web usa SHA256, migrar a SHA256
        if (contrasenaValida) {
          console.log("🔄 Migrando bcrypt a SHA256 para compatibilidad con web...");
          const sha256Hash = crypto
            .createHash('sha256')
            .update(contrasena)
            .digest('hex')
            .toLowerCase();
          
          await client.query(
            'UPDATE _users SET password = $1 WHERE id = $2',
            [sha256Hash, usuario.id]
          );
          console.log("✅ Hash migrado a SHA256");
        }
      } catch (bcryptError) {
        console.error("❌ Error en bcrypt.compare:", bcryptError.message);
        return { 
          exito: false, 
          error: 'Error de autenticación',
          codigo: 'ERROR_AUTENTICACION'
        };
      }
    } 
    else if (esHashSHA256) {
      console.log("🔑 Verificando con SHA256...");
      // La web usa SHA256, replicar el mismo proceso
      const hashCalculado = crypto
        .createHash('sha256')
        .update(contrasena)
        .digest('hex')
        .toLowerCase();
      
      console.log("🔍 Hash calculado SHA256:", hashCalculado);
      console.log("🔍 Hash en BD:", hash.toLowerCase());
      
      contrasenaValida = hashCalculado === hash.toLowerCase();
      console.log("✅ Comparación SHA256:", contrasenaValida);
    }
    else {
      console.error("❌ Hash desconocido:", hash);
      return { 
        exito: false, 
        error: 'Error en datos de autenticación',
        codigo: 'HASH_DESCONOCIDO'
      };
    }
    
    if (!contrasenaValida) {
      console.log("❌ Contraseña incorrecta para:", identificador);
      return { 
        exito: false, 
        error: 'Contraseña incorrecta',
        codigo: 'CONTRASENA_INCORRECTA'
      };
    }
    
    console.log("✅ Contraseña válida");
    
    // Preparar datos del usuario para respuesta
    const usuarioRespuesta = {
      id: usuario.id,
      nombre: usuario.full_name,
      email: usuario.email,
      nombre_usuario: usuario.username,
      rol: usuario.role || 'user',
      foto_perfil: usuario.avatar_url,
      banner_url: usuario.banner_url,
      bio: usuario.bio,
      fecha_creacion: usuario.created_at
    };
    
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
        nombre: usuario.full_name,
        rol: usuario.role || 'user'
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Login manual exitoso para:", usuario.email);
    console.log("🔑 Token generado (primeros 20):", token.substring(0, 20) + '...');
    
    return { 
      exito: true, 
      usuario: usuarioRespuesta,
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
      error: 'Error del servidor al iniciar sesión: ' + error.message,
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

// Registro manual - AHORA USANDO SHA256 PARA COMPATIBILIDAD CON LA WEB
export const registrarUsuario = async (datosUsuario) => {
  console.log("🔍 [BACKEND] Datos recibidos COMPLETOS:", JSON.stringify(datosUsuario, null, 2));
  
  const { nombre, email, contrasena, nombreUsuario, rol } = datosUsuario;
  
  console.log("🔍 [BACKEND] Campos desestructurados:", {
    nombre: nombre?.length || 0,
    email: email?.length || 0,
    contrasena: contrasena ? "***" : "null",
    nombreUsuario: nombreUsuario?.length || 0,
    rol: rol
  });
  
  let client;
  
  try {
    // Validación de entrada
    if (!nombre || nombre.trim().length === 0) {
      console.error("❌ Nombre vacío o inválido:", nombre);
      return { 
        exito: false, 
        error: 'El nombre es requerido',
        codigo: 'NOMBRE_REQUERIDO'
      };
    }
    
    if (!email || email.trim().length === 0) {
      console.error("❌ Email vacío o inválido:", email);
      return { 
        exito: false, 
        error: 'El email es requerido',
        codigo: 'EMAIL_REQUERIDO'
      };
    }
    
    if (!contrasena || contrasena.trim().length === 0) {
      console.error("❌ Contraseña vacía o inválida");
      return { 
        exito: false, 
        error: 'La contraseña es requerida',
        codigo: 'CONTRASENA_REQUERIDA'
      };
    }
    
    if (!nombreUsuario || nombreUsuario.trim().length === 0) {
      console.error("❌ Nombre de usuario vacío o inválido:", nombreUsuario);
      return { 
        exito: false, 
        error: 'El nombre de usuario es requerido',
        codigo: 'USERNAME_REQUERIDO'
      };
    }
    
    if (!rol || rol.trim().length === 0) {
      console.error("❌ Rol vacío o inválido:", rol);
      return { 
        exito: false, 
        error: 'El rol es requerido',
        codigo: 'ROL_REQUERIDO'
      };
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("❌ Formato de email inválido:", email);
      return { 
        exito: false, 
        error: 'Formato de email inválido',
        codigo: 'EMAIL_INVALIDO'
      };
    }
    
    // Validar contraseña
    if (contrasena.length < 6) {
      console.error("❌ Contraseña demasiado corta:", contrasena.length);
      return { 
        exito: false, 
        error: 'La contraseña debe tener al menos 6 caracteres',
        codigo: 'CONTRASENA_CORTA'
      };
    }
    
    // Validar username
    if (nombreUsuario.length < 3) {
      console.error("❌ Username demasiado corto:", nombreUsuario.length);
      return { 
        exito: false, 
        error: 'El nombre de usuario debe tener al menos 3 caracteres',
        codigo: 'USERNAME_CORTO'
      };
    }
    
    console.log("✅ Validaciones pasadas. Conectando a DB...");
    
    // Obtener conexión del pool
    client = await pool.connect();
    console.log("✅ Conexión a DB establecida");
    
    // Verificar si el usuario ya existe
    console.log("🔍 Verificando si usuario ya existe...");
    const usuarioExistente = await client.query(
      'SELECT id, email, username FROM _users WHERE email = $1 OR username = $2',
      [email.trim().toLowerCase(), nombreUsuario.trim()]
    );
    
    if (usuarioExistente.rows.length > 0) {
      console.log("❌ Usuario ya existe en DB:", {
        encontrado: usuarioExistente.rows[0],
        emailBuscado: email,
        usernameBuscado: nombreUsuario
      });
      
      const usuarioExistenteData = usuarioExistente.rows[0];
      let mensajeError = 'El usuario ya existe';
      let codigoError = 'USUARIO_EXISTENTE';
      
      if (usuarioExistenteData.email.toLowerCase() === email.toLowerCase()) {
        mensajeError = 'Ya existe un usuario con este email';
        codigoError = 'EMAIL_EXISTENTE';
      } else if (usuarioExistenteData.username.toLowerCase() === nombreUsuario.toLowerCase()) {
        mensajeError = 'Ya existe un usuario con este nombre de usuario';
        codigoError = 'USERNAME_EXISTENTE';
      }
      
      return { 
        exito: false, 
        error: mensajeError,
        codigo: codigoError
      };
    }
    
    console.log("✅ Usuario no existe, procediendo a crear...");
    
    // 🔥 HASH SHA256 PARA COMPATIBILIDAD CON LA WEB
    console.log("🔑 Generando hash SHA256 de contraseña...");
    const passwordHash = crypto
      .createHash('sha256')
      .update(contrasena)
      .digest('hex')
      .toLowerCase();
    
    console.log("✅ Hash SHA256 generado:", passwordHash);
    
    // Generar ID único (UUID)
    const userId = uuidv4();
    console.log("📋 UUID generado:", userId);
    
    // INSERT en la tabla _users
    console.log("📝 Insertando usuario en tabla _users...");
    const insertQuery = `
      INSERT INTO _users (
        id, username, full_name, email, password, role, 
        created_at, updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, username, full_name, email, role, created_at
    `;
    
    console.log("🔍 Ejecutando INSERT con datos:", {
      id: userId,
      username: nombreUsuario.trim(),
      full_name: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: '[HASH SHA256]',
      role: rolNormalizado
    });
    
    const result = await client.query(insertQuery, [
      userId,
      nombreUsuario.trim(),
      nombre.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      rolNormalizado
    ]);
    
    console.log("✅ INSERT exitoso. Resultado:", result.rows[0]);
    
    const nuevoUsuario = result.rows[0];
    
    // Generar token JWT
    const JWT_SECRETO = process.env.JWT_SECRETO;
    if (!JWT_SECRETO) {
      console.error("❌ JWT_SECRETO no configurado en variables de entorno");
      return { 
        exito: false, 
        error: 'Error de configuración del servidor',
        codigo: 'JWT_NO_CONFIGURADO'
      };
    }
    
    console.log("🔑 Generando token JWT...");
    const token = jwt.sign(
      { 
        id: nuevoUsuario.id, 
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.full_name,
        rol: nuevoUsuario.role 
      },
      JWT_SECRETO,
      { expiresIn: '7d' }
    );
    
    console.log("✅ Token generado (primeros 20):", token.substring(0, 20) + '...');
    
    // Preparar respuesta
    const respuestaUsuario = {
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.full_name,
      email: nuevoUsuario.email,
      nombre_usuario: nuevoUsuario.username,
      rol: nuevoUsuario.role,
      fecha_creacion: nuevoUsuario.created_at
    };
    
    console.log("🎉 Registro exitoso para:", email);
    
    return { 
      exito: true, 
      usuario: respuestaUsuario,
      token: token
    };
    
  } catch (error) {
    console.error('❌ Error en registrarUsuario:', error.message);
    console.error('🔧 Stack:', error.stack);
    
    // Manejo específico de errores
    if (error.message.includes('role') && error.message.includes('does not exist')) {
      console.error("❌ ERROR: Columna 'role' no existe en tabla _users");
      console.error("❌ Las columnas de _users deben ser: role (no rol)");
      return { 
        exito: false, 
        error: 'Error de configuración de base de datos: columna incorrecta',
        codigo: 'COLUMNA_INCORRECTA',
        detalle: 'Verifica que la tabla _users tiene columna "role"'
      };
    }
    
    if (error.message.includes('_users') && error.message.includes('does not exist')) {
      return { 
        exito: false, 
        error: 'Error de configuración de base de datos: tabla _users no existe',
        codigo: 'TABLA_NO_EXISTE'
      };
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      return { 
        exito: false, 
        error: 'Error de conexión a la base de datos',
        codigo: 'ERROR_CONEXION_DB'
      };
    }
    
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
      codigo: 'ERROR_SERVIDOR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  } finally {
    // Liberar cliente si existe
    if (client) {
      client.release();
      console.log("🔗 Conexión a DB liberada");
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
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log("✅ Respuesta de Google recibida:", {
      email: respuesta.data.email,
      name: respuesta.data.name?.substring(0, 20) + '...',
      id: respuesta.data.id,
      picture: respuesta.data.picture ? "SI" : "NO"
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
      // Buscar usuario por email
      console.log("🔍 Buscando usuario con email:", respuesta.data.email);
      const query = `
        SELECT id, full_name as nombre, email, username as nombre_usuario, 
               role as rol, avatar_url as foto_perfil, created_at as fecha_creacion,
               password
        FROM _users WHERE email = $1
      `;
      const result = await client.query(query, [respuesta.data.email]);
      
      let usuario;
      
      if (result.rows.length > 0) {
        console.log("✅ Usuario encontrado en DB, ID:", result.rows[0].id);
        usuario = result.rows[0];
        
        // Si el usuario existe pero no tiene avatar de Google, actualizarlo
        if (respuesta.data.picture && !usuario.foto_perfil) {
          const updateAvatar = await client.query(
            'UPDATE _users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url',
            [respuesta.data.picture, usuario.id]
          );
          console.log("🔄 Avatar actualizado con foto de Google");
          usuario.foto_perfil = updateAvatar.rows[0].avatar_url;
        }
      } else {
        console.log("🆕 Creando nuevo usuario...");
        // Generar ID único
        const userId = uuidv4();
        
        // Crear username basado en el nombre
        const nombreUsuarioBase = respuesta.data.name 
          ? respuesta.data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)
          : 'usuario';
        
        const randomNum = Math.floor(Math.random() * 10000);
        const username = `${nombreUsuarioBase}_${randomNum}`;
        
        // Nombre completo
        const fullName = respuesta.data.name || respuesta.data.email.split('@')[0];
        
        // Avatar
        const avatar = respuesta.data.picture || 'https://res.cloudinary.com/de8qn7bm1/image/upload/v1762320292/Default_pfp.svg_j0obpx.png';
        
        const insertQuery = `
          INSERT INTO _users (
            id, username, full_name, email, role, avatar_url, 
            created_at, updated_at
          ) 
          VALUES ($1, $2, $3, $4, 'user', $5, NOW(), NOW()) 
          RETURNING id, username as nombre_usuario, full_name as nombre, 
                   email, role as rol, avatar_url as foto_perfil, 
                   created_at as fecha_creacion
        `;
        
        const nuevoUsuario = await client.query(insertQuery, [
          userId,
          username,
          fullName,
          respuesta.data.email,
          avatar
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
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          nombre_usuario: usuario.nombre_usuario,
          rol: usuario.rol,
          foto_perfil: usuario.foto_perfil,
          fecha_creacion: usuario.fecha_creacion
        },
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
    
    // Error de red
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { 
        exito: false, 
        error: 'Error de conexión a internet',
        codigo: 'ERROR_CONEXION'
      };
    }
    
    return { 
      exito: false, 
      error: 'Error autenticando con Google: ' + error.message,
      codigo: 'ERROR_GOOGLE'
    };
  } finally {
    // SIEMPRE liberar el cliente
    if (client) {
      client.release();
      console.log("🔗 Conexión a DB liberada");
    }
  }
};

// Cambiar contraseña - AHORA USANDO SHA256
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
    
    // Obtener usuario actual
    const query = 'SELECT password FROM _users WHERE id = $1';
    const result = await client.query(query, [usuarioId]);
    
    if (result.rows.length === 0) {
      return { 
        exito: false, 
        error: 'Usuario no encontrado',
        codigo: 'USUARIO_NO_ENCONTRADO'
      };
    }
    
    const usuario = result.rows[0];
    const hashActual = usuario.password;
    
    // Verificar contraseña actual
    let contrasenaActualValida = false;
    
    if (hashActual.startsWith('$2')) {
      // Hash bcrypt
      contrasenaActualValida = await bcrypt.compare(contrasenaActual, hashActual);
    } 
    else if (hashActual.length === 64 && /^[a-f0-9]{64}$/i.test(hashActual)) {
      // Hash SHA256
      const hashCalculado = crypto
        .createHash('sha256')
        .update(contrasenaActual)
        .digest('hex')
        .toLowerCase();
      
      contrasenaActualValida = hashCalculado === hashActual.toLowerCase();
    }
    
    if (!contrasenaActualValida) {
      return { 
        exito: false, 
        error: 'Contraseña actual incorrecta',
        codigo: 'CONTRASENA_ACTUAL_INCORRECTA'
      };
    }
    
    // 🔥 Hash de la nueva contraseña CON SHA256
    const nuevaPasswordHash = crypto
      .createHash('sha256')
      .update(nuevaContrasena)
      .digest('hex')
      .toLowerCase();
    
    // Actualizar en la base de datos
    const updateQuery = 'UPDATE _users SET password = $1, updated_at = NOW() WHERE id = $2';
    await client.query(updateQuery, [nuevaPasswordHash, usuarioId]);
    
    console.log("✅ Contraseña actualizada con SHA256 para usuario ID:", usuarioId);
    
    return { 
      exito: true,
      mensaje: 'Contraseña actualizada correctamente'
    };
    
  } catch (error) {
    console.error('❌ Error en cambiarContrasena:', error.message);
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