const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  topics: [{ type: String }], // İlgi alanları
  xp: { type: Number, default: 0 }, // Deneyim puanı (points olarak da kullanılır)
  level: { type: Number, default: 1 }, // Seviye
  badges: [{
    name: { type: String, required: true },
    description: { type: String },
    earnedAt: { type: Date, default: Date.now },
    icon: { type: String }
  }],
  stats: {
    postsCreated: { type: Number, default: 0 },
    commentsAdded: { type: Number, default: 0 },
    postsLiked: { type: Number, default: 0 },
    commentsLiked: { type: Number, default: 0 },
    aiInteractions: { type: Number, default: 0 },
    helpfulAnswers: { type: Number, default: 0 }
  },
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActivity: { type: Date }
  },
  // Takip sistemi
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 }
}, { timestamps: true });

// Virtual field - Frontend için points (xp ile aynı)
userSchema.virtual('points').get(function() {
  return this.xp;
});

// Virtual field - Frontend için followersCount
userSchema.virtual('followersCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

// Virtual field - Frontend için followingCount
userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// JSON serialization için virtual'ları dahil et
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
