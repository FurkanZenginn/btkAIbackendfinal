const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createIndexes } = require('./utils/databaseOptimizer');
require('dotenv').config();

const app = express();

// Environment variables kontrolü
console.log('🔧 Environment Variables Check:');
console.log('  - MONGO_URI:', process.env.MONGO_URI ? 'SET' : 'NOT SET');
console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('  - GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');

// Kritik environment variables kontrolü
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ Cloudinary konfigürasyonu eksik! Lütfen .env dosyasını kontrol edin.');
}

app.use(cors({
  origin: ["http://localhost:8081", "http://localhost:3000", "http://10.0.2.2:8081"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB bağlantısı ve sonrası işlemler
const initializeApp = async () => {
  try {
    console.log('🚀 Uygulama başlatılıyor...');
    
    // MongoDB bağlantısını bekle
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('❌ MongoDB bağlantısı başarısız! Uygulama başlatılamıyor.');
      process.exit(1);
    }
    
    // Database optimizasyonları
    try {
      await createIndexes();
      console.log('✅ Database indexes created successfully');
    } catch (indexError) {
      console.error('❌ Database index creation failed:', indexError.message);
    }
    
    // Seed data (geliştirme ortamında)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { seedHapBilgiler } = require('./utils/seedHapBilgiler');
        await seedHapBilgiler();
      } catch (seedError) {
        console.error('Hap bilgi seed hatası:', seedError.message);
      }
    }
    
    console.log('✅ Uygulama başarıyla başlatıldı!');
  } catch (error) {
    console.error('❌ Uygulama başlatma hatası:', error.message);
    process.exit(1);
  }
};

// Uygulamayı başlat
initializeApp();

// Route'lar
const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const gamificationRoutes = require('./routes/gamification');
const notificationRoutes = require('./routes/notifications');
const hapBilgiRoutes = require('./routes/hapBilgi');
const moderationRoutes = require('./routes/moderation');
const learningRoutes = require('./routes/learning');

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/hap-bilgi', hapBilgiRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/learning', learningRoutes);

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Backend çalışıyor!',
    timestamp: new Date(),
    routes: ['/api/posts', '/api/auth', '/api/user', '/api/ai'],
    environment: {
      nodeEnv: process.env.NODE_ENV,
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
        apiKey: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
      }
    }
  });
});

// Avatar upload test endpoint
app.post('/api/test-avatar-upload', (req, res) => {
  const { upload } = require('./middleware/uploadMiddleware');
  
  upload(req, res, (err) => {
    if (err) {
      console.error('❌ Upload test error:', err);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    console.log('✅ Upload test successful:', {
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      } : 'NO FILE',
      body: req.body
    });
    
    res.json({
      success: true,
      message: 'Upload test başarılı',
      data: {
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null,
        body: req.body
      }
    });
  });
});

// Follow system test endpoint
app.get('/api/test-follow-system', (req, res) => {
  res.json({
    success: true,
    message: 'Follow sistemi test endpoint\'i',
    endpoints: {
      follow: 'POST /api/user/follow/:userId',
      unfollow: 'DELETE /api/user/follow/:userId',
      profile: 'GET /api/user/:userId/profile',
      followers: 'GET /api/user/:userId/followers',
      following: 'GET /api/user/:userId/following'
    },
    features: {
      toggleFollow: 'Aynı endpoint ile takip et/takibi bırak',
      gamification: 'Takip etme puanı: 5 XP',
      validation: 'Kendini takip etme engeli'
    }
  });
});

// Error handling middleware (en sonda olmalı)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ Environment check completed');
  console.log('🌐 Frontend URL: http://localhost:3000');
  console.log('⚡ Performance optimizations applied');
});

// Performance monitoring
let requestCount = 0;
let startTime = Date.now();

// Request timing middleware
app.use((req, res, next) => {
  requestCount++;
  const requestStart = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - requestStart;
    if (duration > 1000) { // 1 saniyeden uzun süren istekleri logla
      console.log(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});

// Performance stats (her 10 dakikada bir) - daha az sıklık
setInterval(() => {
  const uptime = Date.now() - startTime;
  console.log(`📊 Performance Stats: ${requestCount} requests in ${Math.round(uptime/1000)}s`);
}, 600000);



// Memory leak prevention
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
