const mongoose = require('mongoose');

// Database bağlantı optimizasyonu
const optimizeDatabase = () => {
  // Mongoose bağlantı ayarları
  mongoose.set('debug', process.env.NODE_ENV === 'development');
  
  // Connection pool ayarları - Ultra Optimized
  const connectionOptions = {
    maxPoolSize: 50, // Çok daha fazla bağlantı
    minPoolSize: 10, // Minimum bağlantı sayısı
    serverSelectionTimeoutMS: 2000, // Çok daha hızlı timeout
    socketTimeoutMS: 20000, // Çok daha hızlı socket timeout
    bufferCommands: true, // Buffer aktif - performans için
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxIdleTimeMS: 30000, // Boşta kalma süresi
    waitQueueTimeoutMS: 5000 // Bekleme süresi
  };

  return connectionOptions;
};

// Index optimizasyonu
const createIndexes = async () => {
  try {
    // User indexes
    await mongoose.model('User').createIndexes();
    
    // Post indexes
    await mongoose.model('Post').createIndexes();
    
    // Comment indexes
    await mongoose.model('Comment').createIndexes();
    
    // Notification indexes
    await mongoose.model('Notification').createIndexes();
    
    // HapBilgi indexes
    await mongoose.model('HapBilgi').createIndexes();
    
    // Feedback indexes
    await mongoose.model('Feedback').createIndexes();
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Database index creation failed:', error);
  }
};

// Query optimizasyonu
const optimizeQueries = {
  // Post queries
  getPostsOptimized: (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return {
      pipeline: [
        { $match: { isModerated: true } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            caption: 1,
            imageURL: 1,
            topicTags: 1,
            likes: 1,
            commentCount: 1,
            createdAt: 1,
            'user.name': 1,
            'user.avatar': 1
          }
        }
      ]
    };
  },

  // User profile queries
  getUserProfileOptimized: (userId) => {
    return {
      pipeline: [
        { $match: { _id: mongoose.Types.ObjectId(userId) } },
        {
          $lookup: {
            from: 'posts',
            localField: '_id',
            foreignField: 'userId',
            as: 'posts'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'userId',
            as: 'comments'
          }
        },
        {
          $project: {
            _id: 1,
            email: 1,
            name: 1,
            avatar: 1,
            xp: 1,
            level: 1,
            badges: 1,
            stats: 1,
            streak: 1,
            postCount: { $size: '$posts' },
            commentCount: { $size: '$comments' }
          }
        }
      ]
    };
  }
};

// Performance monitoring
const performanceMonitor = {
  queryTimes: new Map(),
  
  startTimer: (queryName) => {
    performanceMonitor.queryTimes.set(queryName, Date.now());
  },
  
  endTimer: (queryName) => {
    const startTime = performanceMonitor.queryTimes.get(queryName);
    if (startTime) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ Query '${queryName}' took ${duration}ms`);
      performanceMonitor.queryTimes.delete(queryName);
      return duration;
    }
    return 0;
  }
};

module.exports = {
  optimizeDatabase,
  createIndexes,
  optimizeQueries,
  performanceMonitor
}; 