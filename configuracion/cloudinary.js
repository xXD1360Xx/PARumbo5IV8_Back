import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

// ========== CONFIGURACIÓN CLOUDINARY ==========
console.log('⚡ CLOUDINARY.JS: Inicializando...');

// Obtener variables de Northflank
const cloudName = du8hxf6x2;
const apiKey = 257271384387732;
const apiSecret = -noe5puA9PnU_faxE2ZMbG2annA;

console.log('🔍 Variables de entorno:');
console.log(`- CLOUDINARY_CLOUD_NAME: ${cloudName ? '✅ PRESENTE' : '❌ NO ENCONTRADO'}`);
console.log(`- CLOUDINARY_API_KEY: ${apiKey ? '✅ PRESENTE' : '❌ NO ENCONTRADO'}`);
console.log(`- CLOUDINARY_API_SECRET: ${apiSecret ? '✅ PRESENTE' : '❌ NO ENCONTRADO'}`);

// Configurar solo si tenemos las 3 variables
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  console.log('✅ Cloudinary configurado correctamente');
} else {
  console.error('❌ ERROR: Faltan variables de Cloudinary');
}

const unlinkAsync = promisify(fs.unlink);

// ========== CONFIGURACIÓN MULTER ==========
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// ========== FUNCIÓN PARA SUBIR A CLOUDINARY ==========
const subirACloudinary = async (filePath, tipo = 'avatar') => {
  try {
    console.log(`📤 Subiendo ${tipo}: ${filePath}`);
    
    // Verificar archivo
    if (!fs.existsSync(filePath)) {
      throw new Error('Archivo no encontrado');
    }
    
    // Configuración según tipo
    const folder = tipo === 'avatar' ? 'perfiles/avatars' : 'perfiles/banners';
    const transformation = tipo === 'avatar' 
      ? [{ width: 500, height: 500, crop: 'fill' }]
      : [{ width: 1200, height: 400, crop: 'fill' }];
    
    // Subir a Cloudinary
    const resultado = await cloudinary.uploader.upload(filePath, {
      folder,
      transformation,
      resource_type: 'image'
    });
    
    console.log(`✅ Subido exitosamente: ${resultado.secure_url}`);
    
    // Eliminar archivo temporal
    try {
      await unlinkAsync(filePath);
    } catch (error) {
      console.warn('⚠️ No se pudo eliminar archivo temporal');
    }
    
    return {
      exito: true,
      url: resultado.secure_url,
      public_id: resultado.public_id,
      width: resultado.width,
      height: resultado.height
    };
    
  } catch (error) {
    console.error(`❌ Error subiendo ${tipo}:`, error.message);
    
    // Intentar limpiar archivo temporal
    try {
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    } catch (cleanupError) {
      // Ignorar error de limpieza
    }
    
    throw error;
  }
};

// ========== FUNCIÓN PARA ELIMINAR DE CLOUDINARY ==========
const eliminarDeCloudinary = async (publicId) => {
  try {
    const resultado = await cloudinary.uploader.destroy(publicId);
    return resultado.result === 'ok';
  } catch (error) {
    console.error('❌ Error eliminando:', error.message);
    return false;
  }
};

// ========== FUNCIÓN PARA EXTRAER PUBLIC_ID ==========
const extraerPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    const partes = url.split('/upload/');
    if (partes.length < 2) return null;
    
    const pathConExtension = partes[1];
    const pathSinExtension = pathConExtension.split('.')[0];
    const partesPath = pathSinExtension.split('/');
    
    // Remover versión (v123456...)
    return partesPath.filter(part => !part.startsWith('v')).join('/');
  } catch (error) {
    return null;
  }
};

// ========== EXPORTAR ==========
export { 
  cloudinary, 
  upload, 
  subirACloudinary, 
  eliminarDeCloudinary, 
  extraerPublicId 
};