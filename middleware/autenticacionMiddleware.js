import jwt from 'jsonwebtoken';

export const autenticarUsuario = (req, res, next) => {
  try {
    // Buscar token en cookies o headers
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        exito: false, 
        error: 'Acceso denegado. Token requerido.' 
      });
    }

    // Verificar token JWT
    const decodificado = jwt.verify(token, process.env.JWT_SECRETO);
    
    // Adjuntar información del usuario a la request
    req.usuario = {
      id: decodificado.id,
      rol: decodificado.rol
    };
    
    next();
    
  } catch (error) {
    console.error('Error en autenticación:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        exito: false, 
        error: 'Token inválido' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        exito: false, 
        error: 'Token expirado' 
      });
    }
    
    return res.status(500).json({ 
      exito: false, 
      error: 'Error en la autenticación' 
    });
  }
};