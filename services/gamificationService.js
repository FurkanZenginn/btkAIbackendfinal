const User = require('../models/User');
const Feedback = require('../models/Feedback');
const { GAMIFICATION } = require('../utils/constants');

// Puan sistemi kuralları - Constants'tan al
const POINT_RULES = {
  post_created: GAMIFICATION.POINTS.POST_CREATED,
  comment_added: GAMIFICATION.POINTS.COMMENT_ADDED,
  post_liked: GAMIFICATION.POINTS.POST_LIKED,
  comment_liked: GAMIFICATION.POINTS.COMMENT_LIKED,
  ai_used: GAMIFICATION.POINTS.AI_USED,
  helpful_answer: GAMIFICATION.POINTS.HELPFUL_ANSWER,
  daily_streak: GAMIFICATION.POINTS.DAILY_STREAK,
  learning_progress: GAMIFICATION.POINTS.LEARNING_PROGRESS,
  assessment_completed: GAMIFICATION.POINTS.ASSESSMENT_COMPLETED,
  follow_user: GAMIFICATION.POINTS.FOLLOW_USER,
  unfollow_user: 0 // Unfollow için puan yok
};

// Geçerli feedback tipleri
const validTypes = [
  'post_created',
  'comment_added', 
  'post_liked',
  'comment_liked',
  'ai_used',
  'helpful_answer',
  'follow_user',
  'unfollow_user',
  'daily_login',
  'streak_milestone'
];

// Rozet sistemi
const BADGES = {
  first_post: {
    name: 'İlk Adım',
    description: 'İlk postunu oluşturdun!',
    icon: '🎯',
    condition: (stats) => stats.postsCreated >= 1
  },
  helpful_mentor: {
    name: 'Yardımsever Mentor',
    description: '10 faydalı yanıt verdin!',
    icon: '🤝',
    condition: (stats) => stats.helpfulAnswers >= 10
  },
  ai_explorer: {
    name: 'AI Kaşifi',
    description: 'AI ile 50 kez etkileşim kurdu!',
    icon: '🤖',
    condition: (stats) => stats.aiInteractions >= 50
  },
  streak_master: {
    name: 'Seri Ustası',
    description: '7 gün üst üste aktif oldun!',
    icon: '🔥',
    condition: (streak) => streak.current >= 7
  },
  comment_king: {
    name: 'Yorum Kralı',
    description: '100 yorum ekledin!',
    icon: '💬',
    condition: (stats) => stats.commentsAdded >= 100
  },
  like_collector: {
    name: 'Beğeni Toplayıcısı',
    description: '1000 beğeni topladın!',
    icon: '❤️',
    condition: (stats) => (stats.postsLiked + stats.commentsLiked) >= 1000
  }
};

// Seviye hesaplama - Constants kullan
const calculateLevel = (xp) => {
  return Math.floor(xp / GAMIFICATION.LEVELS.XP_PER_LEVEL) + 1;
};

// XP'den sonraki seviyeye kalan puan - Constants kullan
const xpToNextLevel = (xp) => {
  const currentLevel = calculateLevel(xp);
  const xpForCurrentLevel = (currentLevel - 1) * GAMIFICATION.LEVELS.XP_PER_LEVEL;
  return GAMIFICATION.LEVELS.XP_PER_LEVEL - (xp - xpForCurrentLevel);
};

// Puan ekle ve seviye kontrolü
const addPoints = async (userId, type, description, metadata = {}) => {
  try {
    // Description için fallback değerler
    const descriptions = {
      'follow_user': 'Kullanıcı takip etme',
      'unfollow_user': 'Kullanıcı takibi bırakma',
      'create_post': 'Gönderi oluşturma',
      'like_post': 'Gönderi beğenme',
      'comment_post': 'Yorum ekleme',
      'ai_interaction': 'AI ile etkileşim',
      'daily_login': 'Günlük giriş',
      'streak_milestone': 'Seri başarısı'
    };
    
    // Description yoksa fallback kullan
    const finalDescription = description || descriptions[type] || 'Genel aktivite';
    
    console.log('🎮 addPoints çağrıldı:', { userId, type, description: finalDescription });
    
    // Enum değerlerini kontrol et
    if (!validTypes.includes(type)) {
      console.error('❌ Invalid feedback type:', type);
      return false;
    }
    
    const points = POINT_RULES[type] || 0;
    
    // Kullanıcıyı güncelle
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ Kullanıcı bulunamadı, userId:', userId);
      // Hata fırlatmak yerine null döndür
      return null;
    }

    const oldLevel = user.level;
    user.xp += points;
    user.level = calculateLevel(user.xp);

    // İstatistikleri güncelle
    if (type === 'post_created') user.stats.postsCreated++;
    else if (type === 'comment_added') user.stats.commentsAdded++;
    else if (type === 'post_liked') user.stats.postsLiked++;
    else if (type === 'comment_liked') user.stats.commentsLiked++;
    else if (type === 'ai_used') user.stats.aiInteractions++;
    else if (type === 'helpful_answer') user.stats.helpfulAnswers++;
    else if (type === 'follow_user') {
      // Follow user için özel istatistik güncellemesi yok
      console.log('✅ Follow user puanı eklendi');
    }

    // Streak güncelle
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!user.streak.lastActivity || 
        new Date(user.streak.lastActivity).setHours(0, 0, 0, 0) < today.getTime()) {
      user.streak.current++;
      if (user.streak.current > user.streak.longest) {
        user.streak.longest = user.streak.current;
      }
    }
    user.streak.lastActivity = new Date();

    await user.save();

    // Feedback kaydı oluştur
    const feedback = new Feedback({
      userId,
      type,
      points,
      description: finalDescription,
      metadata
    });
    await feedback.save();

    // Rozet kontrolü
    const newBadges = await checkBadges(user);

    return {
      points,
      newLevel: user.level,
      levelUp: user.level > oldLevel,
      xpToNext: xpToNextLevel(user.xp),
      newBadges
    };

  } catch (error) {
    console.error('Puan ekleme hatası:', error);
    throw error;
  }
};

// Rozet kontrolü
const checkBadges = async (user) => {
  const newBadges = [];
  const existingBadgeNames = user.badges.map(b => b.name);

  for (const [key, badge] of Object.entries(BADGES)) {
    if (!existingBadgeNames.includes(badge.name) && badge.condition(user.stats, user.streak)) {
      user.badges.push({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: new Date()
      });
      newBadges.push(badge);
    }
  }

  if (newBadges.length > 0) {
    await user.save();
  }

  return newBadges;
};

// Kullanıcı istatistiklerini getir
const getUserStats = async (userId) => {
  try {
    console.log('🔍 getUserStats çağrıldı, userId:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ Kullanıcı bulunamadı, userId:', userId);
      // Hata fırlatmak yerine null döndür
      return null;
    }

    const feedback = await Feedback.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      user: {
        name: user.name,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        xpToNext: xpToNextLevel(user.xp),
        badges: user.badges,
        stats: user.stats,
        streak: user.streak
      },
      recentActivity: feedback
    };

  } catch (error) {
    console.error('İstatistik getirme hatası:', error);
    throw error;
  }
};

// Liderlik tablosu
const getLeaderboard = async (limit = 10) => {
  try {
    const users = await User.find({})
      .select('name avatar level xp stats streak')
      .sort({ xp: -1 })
      .limit(limit);

    return users.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      avatar: user.avatar,
      level: user.level,
      xp: user.xp,
      stats: user.stats,
      streak: user.streak
    }));

  } catch (error) {
    console.error('Liderlik tablosu hatası:', error);
    throw error;
  }
};

module.exports = {
  addPoints,
  getUserStats,
  getLeaderboard,
  checkBadges,
  POINT_RULES,
  BADGES
}; 