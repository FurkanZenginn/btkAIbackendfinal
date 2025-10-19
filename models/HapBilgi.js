const mongoose = require('mongoose');

const hapBilgiSchema = new mongoose.Schema({
  // Temel bilgiler
  topic: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  
  // Kategori ve zorluk
  category: {
    type: String,
    enum: ['matematik', 'fizik', 'kimya', 'biyoloji', 'tarih', 'coğrafya', 'edebiyat', 'dil', 'genel'],
    default: 'genel'
  },
  difficulty: {
    type: String,
    enum: ['kolay', 'orta', 'zor'],
    default: 'orta'
  },
  
  // AI Analizi
  aiAnalysis: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    keywords: [{
      type: String,
      trim: true
    }],
    summary: {
      type: String,
      trim: true
    },
    relatedConcepts: [{
      type: String,
      trim: true
    }],
    learningObjectives: [{
      type: String,
      trim: true
    }],
    sourceQuestion: {
      type: String,
      trim: true
    },
    sourceAIResponse: {
      type: String
    }
  },
  
  // Sosyal özellikler
  tags: [{
    type: String,
    trim: true
  }],
  relatedTopics: [{
    type: String,
    trim: true
  }],
  
  // İçerik
  examples: [{
    question: String,
    solution: String,
    difficulty: {
      type: String,
      enum: ['kolay', 'orta', 'zor'],
      default: 'orta'
    }
  }],
  tips: [{
    type: String
  }],
  
  // İstatistikler
  usageCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  
  // İlişkiler
  relatedPosts: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    },
    relevance: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  relatedHapBilgiler: [{
    hapBilgiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HapBilgi'
    },
    relevance: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  
  // Kullanıcı etkileşimleri
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  savedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Durum
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Oluşturan
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // KULLANICI BAZLI VERİ İZOLASYONU - Yeni alanlar
  lastAccessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  accessHistory: [{
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
      enum: ['view', 'search', 'create', 'update'],
      default: 'view'
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
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  }],
  
  // Kullanıcı bazlı içerik
  userContent: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: String,
    questions: [String],
    difficulty: {
      type: String,
      enum: ['kolay', 'orta', 'zor'],
      default: 'orta'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Kaynak bilgileri
  sourcePost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  sourceType: {
    type: String,
    enum: ['post', 'question_ai_response', 'ai_generated'],
    default: 'post'
  },
  
  // Versiyon kontrolü
  version: {
    type: Number,
    default: 1
  },
  
  // Son güncelleme
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Index'ler - Performans optimizasyonu
hapBilgiSchema.index({ topic: 1 });
hapBilgiSchema.index({ category: 1 });
hapBilgiSchema.index({ tags: 1 });
hapBilgiSchema.index({ difficulty: 1 });
hapBilgiSchema.index({ isActive: 1 });
hapBilgiSchema.index({ 'aiAnalysis.keywords': 1 });
hapBilgiSchema.index({ 'aiAnalysis.confidence': -1 });
hapBilgiSchema.index({ usageCount: -1 });
hapBilgiSchema.index({ viewCount: -1 });
hapBilgiSchema.index({ createdAt: -1 });

// Virtual field - Toplam etkileşim
hapBilgiSchema.virtual('totalEngagement').get(function() {
  return this.usageCount + this.viewCount + this.likeCount + this.shareCount;
});

// Method - İlişkili hap bilgileri bul
hapBilgiSchema.methods.findRelatedHapBilgiler = async function(limit = 5) {
  const relatedKeywords = this.aiAnalysis.keywords || this.tags || [];
  
  if (relatedKeywords.length === 0) return [];
  
  const related = await this.constructor.find({
    _id: { $ne: this._id },
    isActive: true,
    $or: [
      { 'aiAnalysis.keywords': { $in: relatedKeywords } },
      { tags: { $in: relatedKeywords } },
      { category: this.category }
    ]
  })
  .sort({ 'aiAnalysis.confidence': -1, usageCount: -1 })
  .limit(limit)
  .select('title topic category difficulty usageCount');
  
  return related;
};

// Method - Benzerlik skoru hesapla
hapBilgiSchema.methods.calculateSimilarity = function(otherHapBilgi) {
  const thisKeywords = new Set([...(this.aiAnalysis.keywords || []), ...(this.tags || [])]);
  const otherKeywords = new Set([...(otherHapBilgi.aiAnalysis.keywords || []), ...(otherHapBilgi.tags || [])]);
  
  const intersection = new Set([...thisKeywords].filter(x => otherKeywords.has(x)));
  const union = new Set([...thisKeywords, ...otherKeywords]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
};

module.exports = mongoose.model('HapBilgi', hapBilgiSchema); 