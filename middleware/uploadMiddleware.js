const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const axios = require('axios');
const fs = require('fs');

// Geçici dosya storage
const storage = multer.memoryStorage();

// Multer konfigürasyonu - Avatar için optimize edildi
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 File upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Sadece resim dosyaları
    if (file.mimetype.startsWith('image/')) {
      console.log('✅ File type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File type rejected:', file.mimetype);
      cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
  }
}).single('avatar'); // Avatar field name kullanıyoruz

// Buffer'dan Cloudinary'ye yükleme - Geliştirilmiş versiyon
const uploadToCloudinary = async (buffer, options = {}) => {
  try {
    console.log('☁️ Cloudinary upload başladı:', {
      bufferSize: buffer.length,
      options: options
    });

    // Upload options
    const uploadOptions = {
      folder: options.folder || 'avatars',
      public_id: options.public_id || `avatar_${Date.now()}`,
      resource_type: 'auto',
      transformation: [
        { width: 400, height: 400, crop: 'fill' },
        { quality: 'auto' }
      ]
    };

    console.log('📤 Upload options:', uploadOptions);

    // Cloudinary'ye yükle - Promise tabanlı
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload başarılı:', {
              url: result.secure_url,
              public_id: result.public_id,
              size: result.bytes
            });
            resolve(result.secure_url);
          }
        }
      );
      
      // Buffer'ı stream'e yaz ve kapat
      uploadStream.end(buffer);
    });

  } catch (error) {
    console.error('❌ Cloudinary upload hatası:', error);
    throw new Error(`Dosya yükleme hatası: ${error.message}`);
  }
};

// Base64'ten Cloudinary'ye yükleme (React Native için)
const uploadBase64ToCloudinary = async (base64Data, options = {}) => {
  try {
    console.log('📤 Base64 to Cloudinary upload başladı');
    
    // Base64 prefix'ini kaldır
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Buffer'a çevir
    const buffer = Buffer.from(base64Image, 'base64');
    
    console.log('📊 Buffer created, size:', buffer.length);
    
    // Cloudinary'ye yükle
    return await uploadToCloudinary(buffer, options);
    
  } catch (error) {
    console.error('❌ Base64 upload hatası:', error);
    throw new Error(`Base64 upload failed: ${error.message}`);
  }
};

module.exports = { upload, uploadToCloudinary, uploadBase64ToCloudinary }; 