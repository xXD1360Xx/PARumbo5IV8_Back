// En configuracion/cloudinary.js - REEMPLAZA LA IMPORTACIÓN

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import multer from 'multer';
// Cambia esta importación:
import MulterStorageCloudinary from 'multer-storage-cloudinary';

dotenv.config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Configurar almacenamiento en Cloudinary
const storage = new MulterStorageCloudinary.CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determinar carpeta según tipo de imagen
    let folder;
    if (file.fieldname === 'imagen') {
      folder = 'perfiles/general';
    } else if (file.fieldname === 'avatar') {
      folder = 'perfiles/avatars';
    } else if (file.fieldname === 'banner') {
      folder = 'perfiles/banners';
    } else {
      folder = 'perfiles/otros';
    }
    
    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ],
      public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`
    };
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

export { cloudinary, upload };