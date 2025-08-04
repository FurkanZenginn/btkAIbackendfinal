const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['post_created', 'comment_added', 'post_liked', 'comment_liked', 'ai_used', 'helpful_answer', 'follow_user', 'daily_login', 'streak_milestone'],
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: true
  },
  relatedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  relatedComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

// Index'ler
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ type: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema); 