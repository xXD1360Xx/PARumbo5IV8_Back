import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

const unlinkAsync = promisify(fs.unlink);

dotenv.config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Configuración de Multer para almacenamiento temporal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Crear directorio si no existe
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
    fileSize: 5 * 1024 * 1024 // 5MB límite
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

// Función para subir a Cloudinary
const subirACloudinary = async (filePath, tipo = 'general') => {
  try {
    console.log(`☁️ Subiendo a Cloudinary: ${filePath}`);
    
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
    
    const resultado = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      transformation: transformation,
      resource_type: 'image'
    });
    
    console.log(`✅ Subido a Cloudinary: ${resultado.secure_url}`);
    
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
    // Intentar eliminar archivo temporal en caso de error
    try {
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    } catch (unlinkError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', unlinkError.message);
    }
    
    console.error('❌ Error en subirACloudinary:', error);
    throw error;
  }
};

// Función para eliminar de Cloudinary
const eliminarDeCloudinary = async (publicId) => {
  try {
    console.log(`🗑️ Eliminando de Cloudinary: ${publicId}`);
    const resultado = await cloudinary.uploader.destroy(publicId);
    return resultado.result === 'ok';
  } catch (error) {
    console.error('❌ Error en eliminarDeCloudinary:', error);
    return false;
  }
};

// Función para extraer public_id de URL de Cloudinary
const extraerPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }
  
  try {
    // Extraer la parte después de "/upload/"
    const partes = url.split('/upload/');
    if (partes.length < 2) return null;
    
    const pathConExtension = partes[1];
    // Quitar extensión y parámetros
    const pathSinExtension = pathConExtension.split('.')[0];
    const partesPath = pathSinExtension.split('/');
    
    // Remover la versión (v123456...)
    const sinVersion = partesPath.filter(part => !part.startsWith('v'));
    
    return sinVersion.join('/');
  } catch (error) {
    console.error('❌ Error extrayendo public_id:', error);
    return null;
  }
};

export { cloudinary, upload, subirACloudinary, eliminarDeCloudinary, extraerPublicId };