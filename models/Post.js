const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Post türü (soru veya danışma) - Frontend uyumluluğu için
  postType: {
    type: String,
    enum: ['soru', 'danışma', 'question', 'consultation'],
    required: true
  },
  // Görsel artık opsiyonel
  imageURL: {
    type: String,
    default: null
  },
  // Ana metin (soru veya danışma metni)
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  // Eski caption alanı (geriye uyumluluk için)
  caption: {
    type: String,
    maxlength: 1000
  },
  topicTags: [{
    type: String,
    trim: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  commentCount: {
    type: Number,
    default: 0
  },
  isModerated: {
    type: Boolean,
    default: false
  },
  moderationResult: {
    approved: {
      type: Boolean,
      default: null
    },
    safetyLevel: {
      type: String,
      enum: ['düşük', 'orta', 'yüksek'],
      default: null
    },
    reason: {
      type: String,
      default: null
    }
  },
  flaggedReason: {
    type: String,
    default: null
  },
  flaggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  flaggedAt: {
    type: Date
  },
  flagDetails: {
    type: String
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  aiResponse: {
    type: String,
    default: null
  },
  difficulty: {
    type: String,
    enum: ['kolay', 'orta', 'zor'],
    default: 'orta'
  },
  // Hap bilgi analizi alanları
  hapBilgiAnalysis: {
    detectedTopic: {
      type: String,
      default: null
    },
    detectedCategory: {
      type: String,
      enum: ['matematik', 'fizik', 'kimya', 'biyoloji', 'tarih', 'coğrafya', 'edebiyat', 'dil', 'genel'],
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    relatedHapBilgiler: [{
      hapBilgiId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HapBilgi'
      },
      relevance: {
        type: Number,
        min: 0,
        max: 1
      },
      topic: String
    }],
    analyzedAt: {
      type: Date,
      default: null
    }
  },
  
  // KULLANICI BAZLI VERİ İZOLASYONU - Yeni alanlar
  userAccess: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accessedAt: {
      type: Date,
      default: Date.now
    },
    accessType: {
      type: String,
      enum: ['view', 'like', 'comment', 'share', 'ai_use'],
      default: 'view'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  
  // Kullanıcı bazlı istatistikler
  userStats: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewCount: {
      type: Number,
      default: 0
    },
    lastViewed: {
      type: Date,
      default: Date.now
    },
    isBookmarked: {
      type: Boolean,
      default: false
    },
    personalRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    notes: String
  }],
  
  // Kullanıcı bazlı AI etkileşimleri
  aiInteractions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    interactionType: {
      type: String,
      enum: ['question', 'analysis', 'explanation', 'suggestion'],
      default: 'question'
    },
    prompt: String,
    response: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokensUsed: Number,
    responseTime: Number
  }]
}, { 
  timestamps: true 
});

// Index'ler - Performans optimizasyonu (Optimized)
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ topicTags: 1 });
postSchema.index({ isModerated: 1, createdAt: -1 }); // Compound index - daha hızlı
postSchema.index({ postType: 1, createdAt: -1 });
postSchema.index({ 'hapBilgiAnalysis.detectedTopic': 1 });
postSchema.index({ 'hapBilgiAnalysis.detectedCategory': 1 });
postSchema.index({ createdAt: -1 }); // Feed sıralaması için
postSchema.index({ likes: -1, createdAt: -1 }); // Compound index - popülerlik + tarih
postSchema.index({ commentCount: -1, createdAt: -1 }); // Compound index - yorum sayısı + tarih
postSchema.index({ _id: 1, isModerated: 1 }); // Latest post kontrolü için optimize

// Search için gerekli index'ler
postSchema.index({ content: 'text', caption: 'text' }); // Text search için
postSchema.index({ topicTags: 1, isModerated: 1 }); // Tag search için
postSchema.index({ difficulty: 1, isModerated: 1 }); // Difficulty filter için
postSchema.index({ 'hapBilgiAnalysis.detectedCategory': 1, isModerated: 1 }); // Category filter için

// KULLANICI BAZLI VERİ İZOLASYONU - Yeni index'ler
postSchema.index({ 'userAccess.userId': 1, 'userAccess.accessedAt': -1 }); // Kullanıcı erişim geçmişi
postSchema.index({ 'userStats.userId': 1, 'userStats.lastViewed': -1 }); // Kullanıcı istatistikleri
postSchema.index({ 'aiInteractions.userId': 1, 'aiInteractions.timestamp': -1 }); // AI etkileşimleri
postSchema.index({ userId: 1, 'userAccess.accessedAt': -1 }); // Kullanıcı post'ları ve erişimleri
postSchema.index({ 'userStats.userId': 1, 'userStats.isBookmarked': 1 }); // Bookmark'lar
postSchema.index({ 'aiInteractions.userId': 1, 'aiInteractions.interactionType': 1 }); // AI etkileşim türleri

module.exports = mongoose.model('Post', postSchema); 