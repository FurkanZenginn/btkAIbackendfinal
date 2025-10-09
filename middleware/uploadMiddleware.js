const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const axios = require('axios');
const fs = require('fs');

// Geçici dosya storage - OPTİMİZE EDİLDİ
const storage = multer.memoryStorage();

// Multer konfigürasyonu - Avatar için - OPTİMİZE EDİLDİ
const uploadAvatar = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Sadece 1 dosya
    fieldSize: 1024 * 1024 // 1MB field limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 AVATAR UPLOAD DEBUG:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldname: file.fieldname
    });
    
    // Sadece resim dosyaları
    if (file.mimetype.startsWith('image/')) {
      console.log('✅ Avatar file type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ Avatar file type rejected:', file.mimetype);
      cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
  }
}).single('avatar'); // Avatar field name

// Multer konfigürasyonu - Post için - OPTİMİZE EDİLDİ
const uploadImage = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Sadece 1 dosya
    fieldSize: 1024 * 1024 // 1MB field limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 POST IMAGE UPLOAD DEBUG:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldname: file.fieldname
    });
    
    // Sadece resim dosyaları
    if (file.mimetype.startsWith('image/')) {
      console.log('✅ Post image file type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ Post image file type rejected:', file.mimetype);
      cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
  }
}).single('image'); // Image field name

// Geriye uyumluluk için eski upload fonksiyonu
const upload = uploadAvatar;

// Buffer'dan Cloudinary'ye yükleme - Geliştirilmiş versiyon
const uploadToCloudinary = async (buffer, options = {}) => {
  try {
    // ✅ DETAYLI DEBUG LOG'LARI EKLENDİ
    console.log('🔍 CLOUDINARY UPLOAD DEBUG:', {
      bufferSize: buffer?.length || 'undefined',
      bufferType: typeof buffer,
      isBuffer: Buffer.isBuffer(buffer),
      hasBufferProperty: buffer && buffer.buffer ? 'yes' : 'no',
      bufferKeys: buffer ? Object.keys(buffer) : 'no buffer',
      options: options,
      timestamp: new Date().toISOString()
    });

    // Upload options
    const uploadOptions = {
      folder: options.folder || 'general', // ✅ Default folder düzeltildi
      public_id: options.public_id || `file_${Date.now()}`,
      resource_type: 'auto',
      transformation: [
        { width: 400, height: 400, crop: 'fill' },
        { quality: 'auto' }
      ]
    };

    console.log('📁 Upload options:', uploadOptions);

    // Cloudinary'ye yükle - Promise tabanlı
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            console.log('Cloudinary upload successful:', {
              url: result.secure_url,
              public_id: result.public_id,
              size: result.bytes
            });
            resolve(result.secure_url);
          }
        }
      );
      
      // ✅ STREAM HANDLING OPTİMİZE EDİLDİ - Chunk hatası önlendi
      try {
        if (Buffer.isBuffer(buffer)) {
          // Direkt buffer
          console.log('✅ Using direct buffer, size:', buffer.length);
          uploadStream.end(buffer);
        } else if (buffer && buffer.buffer && Buffer.isBuffer(buffer.buffer)) {
          // Multer'in buffer'ı (req.file.buffer)
          console.log('✅ Using Multer buffer (buffer.buffer), size:', buffer.buffer.length);
          uploadStream.end(buffer.buffer);
        } else if (buffer && buffer.data) {
          // Base64 data
          console.log('✅ Using base64 data, length:', buffer.data.length);
          const imageBuffer = Buffer.from(buffer.data, 'base64');
          uploadStream.end(imageBuffer);
        } else {
          // Geçersiz buffer format
          console.error('❌ Invalid buffer format:', {
            buffer: buffer,
            type: typeof buffer,
            hasBuffer: !!buffer,
            bufferKeys: buffer ? Object.keys(buffer) : 'no keys'
          });
          reject(new Error('Invalid buffer format - Buffer, Multer file, or base64 data required'));
        }
      } catch (bufferError) {
        console.error('❌ Buffer processing error:', bufferError);
        console.error('❌ Buffer error details:', {
          message: bufferError.message,
          stack: bufferError.stack,
          buffer: buffer
        });
        reject(new Error(`Buffer processing failed: ${bufferError.message}`));
      }
    });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`File upload error: ${error.message}`);
  }
};

// Base64'ten Cloudinary'ye yükleme (React Native için)
const uploadBase64ToCloudinary = async (base64Data, options = {}) => {
  try {
    console.log('Base64 to Cloudinary upload started');
    
    // Base64 prefix'ini kaldır
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Buffer'a çevir
    const buffer = Buffer.from(base64Image, 'base64');
    
    console.log('Buffer created, size:', buffer.length);
    
    // Cloudinary'ye yükle
    return await uploadToCloudinary(buffer, options);
    
  } catch (error) {
    console.error('Base64 upload error:', error);
    throw new Error(`Base64 upload failed: ${error.message}`);
  }
};

module.exports = { 
  upload, 
  uploadAvatar, 
  uploadImage, 
  uploadToCloudinary, 
  uploadBase64ToCloudinary 
}; 