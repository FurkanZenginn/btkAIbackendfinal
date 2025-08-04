const mongoose = require('mongoose');

const learningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['matematik', 'fizik', 'kimya', 'biyoloji', 'tarih', 'coğrafya', 'edebiyat', 'dil'],
    required: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  difficulty: {
    type: String,
    enum: ['kolay', 'orta', 'zor'],
    default: 'orta'
  },
  timeSpent: {
    type: Number, // Dakika cinsinden
    default: 0
  },
  completedLessons: [{
    lessonId: String,
    completedAt: Date,
    score: Number
  }],
  assessments: [{
    assessmentId: String,
    score: Number,
    completedAt: Date,
    questions: [{
      questionId: String,
      userAnswer: String,
      isCorrect: Boolean
    }]
  }],
  lastStudied: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Index'ler
learningSchema.index({ userId: 1, topic: 1 });
learningSchema.index({ userId: 1, category: 1 });
learningSchema.index({ userId: 1, lastStudied: -1 });

module.exports = mongoose.model('Learning', learningSchema); 