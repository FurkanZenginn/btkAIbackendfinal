const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları kabul edilir'));
    }
  }
});

// Google Cloud Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || 'google-credentials.json'
});

// OCR endpoint
router.post('/extract-text', upload.single('image'), async (req, res) => {
  try {
    console.log('🔍 OCR isteği alındı:', req.file.originalname);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Resim dosyası bulunamadı'
      });
    }

    // Google Cloud Vision ile OCR
    const [result] = await client.textDetection(req.file.path);

    if (!result.fullTextAnnotation) {
      // Geçici dosyayı sil
      fs.unlinkSync(req.file.path);
      
      return res.json({
        success: false,
        error: 'Resimden metin çıkarılamadı',
        text: ''
      });
    }

    const extractedText = result.fullTextAnnotation.text;
    console.log('✅ OCR sonucu:', extractedText.substring(0, 100) + '...');

    // Geçici dosyayı sil
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      text: extractedText,
      confidence: result.fullTextAnnotation.pages[0].confidence
    });

  } catch (error) {
    console.error('❌ OCR hatası:', error);
    
    // Geçici dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'OCR işlemi sırasında hata oluştu',
      details: error.message
    });
  }
});

module.exports = router;
