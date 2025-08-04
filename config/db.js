// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Eğer MONGO_URI yoksa local MongoDB kullan
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-mentor-backend';
    
    console.log('🔗 MongoDB bağlantısı deneniyor...');
    console.log('📍 URI:', mongoUri);
    
    // Performans optimizasyonu için connection options
    const options = {
      maxPoolSize: 10, // Maksimum bağlantı sayısı
      minPoolSize: 2,  // Minimum bağlantı sayısı
      maxIdleTimeMS: 30000, // 30 saniye idle
      serverSelectionTimeoutMS: 10000, // 10 saniye timeout
      socketTimeoutMS: 45000, // 45 saniye socket timeout
      bufferCommands: false, // Buffer komutlarını kapat
      retryWrites: true,
      w: 'majority'
    };
    
    // Önceki bağlantıyı kapat
    if (mongoose.connection.readyState !== 0) {
      console.log('🔄 Önceki bağlantı kapatılıyor...');
      await mongoose.disconnect();
    }
    
    await mongoose.connect(mongoUri, options);
    console.log('✅ MongoDB bağlantısı başarılı!');
    
    // Bağlantı durumunu kontrol et
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB bağlantı hatası:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB bağlantısı kesildi');
    });
    
    return true;
  } catch (err) {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    console.log('⚠️  MongoDB bağlantısı olmadan devam ediliyor...');
    return false;
  }
};

module.exports = connectDB;
