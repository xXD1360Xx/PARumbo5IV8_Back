import jwt from 'jsonwebtoken';

export const autenticarUsuario = (req, res, next) => {
  try {
    console.log('🔐 Middleware de autenticación ejecutándose...');
    
    // 1. PRIMERO buscar en headers (para React Native/Expo)
    let token = req.header('Authorization');
    
    // 2. Si viene con "Bearer ", limpiarlo
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }
    
    // 3. Si no está en headers, buscar en cookies (para web)
    if (!token && req.cookies) {
      token = req.cookies.token;
    }
    
    // 4. También buscar en query string (opcional, para debugging)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    console.log('🔍 Token encontrado:', token ? '✓' : '✗');
    if (token) {
      console.log('📏 Longitud del token:', token.length);
      console.log('🔑 Token (primeros 20 chars):', token.substring(0, 20) + '...');
    }
    
    if (!token) {
      console.error('❌ No se encontró token de autenticación');
      console.log('📋 Headers recibidos:', req.headers);
      return res.status(401).json({ 
        exito: false, 
        error: 'Acceso denegado. Token requerido.',
        sugerencia: 'En React Native/Expo, envía: Authorization: Bearer <tu_token>'
      });
    }

    // Verificar token JWT
    if (!process.env.JWT_SECRETO) {
      console.error('❌ JWT_SECRETO no está configurado en variables de entorno');
      return res.status(500).json({ 
        exito: false, 
        error: 'Error de configuración del servidor' 
      });
    }
    
    const decodificado = jwt.verify(token, process.env.JWT_SECRETO);
    console.log('✅ Token válido para usuario ID:', decodificado.id);
    
    // Adjuntar información del usuario a la request
    req.usuario = {
      id: decodificado.id,
      email: decodificado.email,
      rol: decodificado.rol || 'usuario',
      nombre: decodificado.nombre,
      expiracion: new Date(decodificado.exp * 1000).toISOString()
    };
    
    console.log('👤 Usuario autenticado:', { 
      id: req.usuario.id, 
      email: req.usuario.email,
      rol: req.usuario.rol 
    });
    
    next();
    
  } catch (error) {
    console.error('🔥 Error en autenticación:', error.name, error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        exito: false, 
        error: 'Token inválido o mal formado',
        codigo: 'TOKEN_INVALIDO'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        exito: false, 
        error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        codigo: 'TOKEN_EXPIRADO'
      });
    }
    
    return res.status(500).json({ 
      exito: false, 
      error: 'Error en la autenticación',
      codigo: 'ERROR_AUTENTICACION'
    });
  }
};

// Middleware opcional para logging de todas las requests autenticadas
export const logAutenticado = (req, res, next) => {
  if (req.usuario) {
    console.log(`👤 [${new Date().toISOString()}] Usuario ${req.usuario.id} accediendo a ${req.method} ${req.path}`);
  }
  next();
};