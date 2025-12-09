import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

const unlinkAsync = promisify(fs.unlink);

// ==================== VERIFICACIÓN DE VARIABLES RAILWAY ====================
console.log('🚂 ========== RAILWAY CLOUDINARY CHECK ==========');
console.log('🔧 Verificando variables de entorno...');

// Verificar CLOUDINARY_CLOUD_NAME
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error('❌ ERROR CRÍTICO: CLOUDINARY_CLOUD_NAME no está definido en Railway');
  console.error('   Ve a Railway → tu app → Variables → Agregar CLOUDINARY_CLOUD_NAME');
} else {
  console.log(`✅ CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME}`);
}

// Verificar CLOUDINARY_API_KEY
if (!process.env.CLOUDINARY_API_KEY) {
  console.error('❌ ERROR CRÍTICO: CLOUDINARY_API_KEY no está definido en Railway');
  console.error('   Ve a Railway → tu app → Variables → Agregar CLOUDINARY_API_KEY');
} else {
  console.log(`✅ CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY.substring(0, 6)}... (${process.env.CLOUDINARY_API_KEY.length} chars)`);
}

// Verificar CLOUDINARY_API_SECRET
if (!process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ ERROR CRÍTICO: CLOUDINARY_API_SECRET no está definido en Railway');
  console.error('   Ve a Railway → tu app → Variables → Agregar CLOUDINARY_API_SECRET');
} else {
  console.log(`✅ CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET.substring(0, 6)}... (${process.env.CLOUDINARY_API_SECRET.length} chars)`);
}
console.log('==============================================');

// ==================== CONFIGURAR CLOUDINARY CON VARIABLES DE RAILWAY ====================
console.log('☁️ Configurando Cloudinary con variables de Railway...');

// Configurar directamente con las variables de Railway - SIN valores por defecto
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // De Railway: "du8hxf6x2"
  api_key: process.env.CLOUDINARY_API_KEY,        // De Railway: "257271384387732"
  api_secret: process.env.CLOUDINARY_API_SECRET,  // De Railway (la que está oculta)
  secure: true
});

// Verificar que la configuración se aplicó
const config = cloudinary.config();
console.log('✅ Cloudinary configurado con:');
console.log(`   Cloud name: ${config.cloud_name || 'No configurado'}`);
console.log(`   API Key: ${config.api_key ? '✅ Presente' : '❌ Ausente'}`);
console.log(`   API Secret: ${config.api_secret ? '✅ Presente' : '❌ Ausente'}`);

// ==================== CONFIGURACIÓN MULTER ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten JPEG, JPG, PNG y WebP'));
    }
  }
});

// ==================== FUNCIÓN PARA SUBIR A CLOUDINARY ====================
const subirACloudinary = async (filePath, tipo = 'general') => {
  try {
    console.log(`📤 [CLOUDINARY] Subiendo archivo: ${filePath}`);
    console.log(`📂 Tipo: ${tipo}`);
    
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }
    
    // Obtener estadísticas del archivo
    const stats = fs.statSync(filePath);
    console.log(`📏 Tamaño del archivo: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Configuración según tipo
    let folder = 'perfiles/general';
    let transformation = [];
    
    if (tipo === 'avatar') {
      folder = 'perfiles/avatars';
      transformation = [
        { width: 500, height: 500, crop: 'fill' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ];
    } else if (tipo === 'banner') {
      folder = 'perfiles/banners';
      transformation = [
        { width: 1200, height: 400, crop: 'fill' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ];
    }
    
    console.log(`📁 Carpeta destino en Cloudinary: ${folder}`);
    
    // Opciones de upload
    const uploadOptions = {
      folder: folder,
      transformation: transformation,
      resource_type: 'image',
      timeout: 60000 // 60 segundos timeout
    };
    
    console.log('🔄 Iniciando upload a Cloudinary...');
    
    // Subir a Cloudinary
    const resultado = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    console.log(`✅ UPLOAD EXITOSO A CLOUDINARY:`);
    console.log(`   URL: ${resultado.secure_url}`);
    console.log(`   Public ID: ${resultado.public_id}`);
    console.log(`   Formato: ${resultado.format}`);
    console.log(`   Dimensiones: ${resultado.width}x${resultado.height}`);
    console.log(`   Tamaño: ${(resultado.bytes / 1024).toFixed(2)} KB`);
    
    // Eliminar archivo temporal
    try {
      await unlinkAsync(filePath);
      console.log(`🗑️ Archivo temporal eliminado: ${filePath}`);
    } catch (error) {
      console.warn(`⚠️ No se pudo eliminar archivo temporal: ${error.message}`);
    }
    
    return {
      exito: true,
      url: resultado.secure_url,
      public_id: resultado.public_id,
      format: resultado.format,
      width: resultado.width,
      height: resultado.height,
      bytes: resultado.bytes
    };

  } catch (error) {
    console.error(`❌ ERROR en subirACloudinary:`);
    console.error(`   Error: ${error.name}`);
    console.error(`   Mensaje: ${error.message}`);
    
    // Detalles específicos de Cloudinary
    if (error.http_code) {
      console.error(`   Código HTTP: ${error.http_code}`);
    }
    if (error.message.includes('api_key')) {
      console.error('   ⚠️ PROBLEMA CON LA API KEY DE CLOUDINARY');
      console.error('   Verifica que las variables en Railway sean correctas:');
      console.error('   - CLOUDINARY_CLOUD_NAME: debe ser "du8hxf6x2"');
      console.error('   - CLOUDINARY_API_KEY: debe ser "257271384387732"');
      console.error('   - CLOUDINARY_API_SECRET: debe ser tu API secret real');
    }
    
    // Intentar eliminar archivo temporal
    try {
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
        console.log(`🗑️ Archivo temporal eliminado después de error: ${filePath}`);
      }
    } catch (unlinkError) {
      console.warn('⚠️ Error eliminando archivo temporal:', unlinkError.message);
    }
    
    throw error;
  }
};

// ==================== FUNCIÓN PARA ELIMINAR DE CLOUDINARY ====================
const eliminarDeCloudinary = async (publicId) => {
  try {
    console.log(`🗑️ [CLOUDINARY] Eliminando: ${publicId}`);
    
    const resultado = await cloudinary.uploader.destroy(publicId);
    
    console.log(`✅ Eliminación resultado: ${resultado.result}`);
    return resultado.result === 'ok';
    
  } catch (error) {
    console.error('❌ Error en eliminarDeCloudinary:', error.message);
    return false;
  }
};

// ==================== FUNCIÓN PARA EXTRAER PUBLIC_ID ====================
const extraerPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }
  
  try {
    const partes = url.split('/upload/');
    if (partes.length < 2) return null;
    
    const pathConExtension = partes[1];
    const pathSinExtension = pathConExtension.split('.')[0];
    const partesPath = pathSinExtension.split('/');
    
    // Remover la versión (v123456...)
    const sinVersion = partesPath.filter(part => !part.startsWith('v'));
    
    return sinVersion.join('/');
  } catch (error) {
    console.error('❌ Error extrayendo public_id:', error.message);
    return null;
  }
};

// ==================== EXPORTAR ====================
export { 
  cloudinary, 
  upload, 
  subirACloudinary, 
  eliminarDeCloudinary, 
  extraerPublicId 
};