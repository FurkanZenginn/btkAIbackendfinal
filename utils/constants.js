// utils/constants.js - Magic numbers ve strings'leri temizle

// Gamification Constants
const GAMIFICATION = {
  POINTS: {
    POST_CREATED: 50,
    COMMENT_ADDED: 10,
    POST_LIKED: 2,
    COMMENT_LIKED: 1,
    AI_USED: 5,
    HELPFUL_ANSWER: 25,
    DAILY_STREAK: 10,
    LEARNING_PROGRESS: 15,
    ASSESSMENT_COMPLETED: 30,
    FOLLOW_USER: 5
  },
  LEVELS: {
    XP_PER_LEVEL: 100,
    MAX_LEVEL: 100
  },
  BADGES: {
    FIRST_POST: {
      name: 'İlk Adım',
      description: 'İlk postunu oluşturdun!',
      icon: '🎯',
      condition: (stats) => stats.postsCreated >= 1
    },
    HELPFUL_MENTOR: {
      name: 'Yardımsever Mentor',
      description: '10 faydalı yanıt verdin!',
      icon: '🤝',
      condition: (stats) => stats.helpfulAnswers >= 10
    },
    AI_EXPLORER: {
      name: 'AI Kaşifi',
      description: 'AI ile 50 kez etkileşim kurdu!',
      icon: '🤖',
      condition: (stats) => stats.aiInteractions >= 50
    },
    STREAK_MASTER: {
      name: 'Seri Ustası',
      description: '7 gün üst üste aktif oldun!',
      icon: '🔥',
      condition: (streak) => streak.current >= 7
    },
    COMMENT_KING: {
      name: 'Yorum Kralı',
      description: '100 yorum ekledin!',
      icon: '💬',
      condition: (stats) => stats.commentsAdded >= 100
    },
    LIKE_COLLECTOR: {
      name: 'Beğeni Toplayıcısı',
      description: '1000 beğeni topladın!',
      icon: '❤️',
      condition: (stats) => (stats.postsLiked + stats.commentsLiked) >= 1000
    }
  }
};

// Post Types - Frontend uyumluluğu için
const POST_TYPES = {
  SORU: 'soru',
  DANISMA: 'danışma',
  QUESTION: 'question',
  CONSULTATION: 'consultation'
};

// Post Type Labels (Frontend için)
const POST_TYPE_LABELS = {
  [POST_TYPES.SORU]: 'Soru',
  [POST_TYPES.DANISMA]: 'Danışma',
  [POST_TYPES.QUESTION]: 'Soru',
  [POST_TYPES.CONSULTATION]: 'Danışma'
};

// Post Type Icons (Frontend için)
const POST_TYPE_ICONS = {
  [POST_TYPES.SORU]: '❓',
  [POST_TYPES.DANISMA]: '💬',
  [POST_TYPES.QUESTION]: '❓',
  [POST_TYPES.CONSULTATION]: '💬'
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// Cache Keys
const CACHE_KEYS = {
  POSTS: 'posts',
  USER_PROFILE: 'user_profile',
  LEADERBOARD: 'leaderboard'
};

// Pagination
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50
};

// File Upload
const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  MAX_FILES: 1
};

// Validation
const VALIDATION = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128
  },
  CONTENT: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 5000
  }
};

module.exports = {
  GAMIFICATION,
  POST_TYPES,
  POST_TYPE_LABELS,
  POST_TYPE_ICONS,
  USER_ROLES,
  CACHE_KEYS,
  PAGINATION,
  FILE_UPLOAD,
  VALIDATION
}; 