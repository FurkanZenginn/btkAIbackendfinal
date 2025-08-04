const { getUserStats, getLeaderboard } = require('../services/gamificationService');
const User = require('../models/User');

// GET /api/gamification/profile - Kullanıcı profil ve istatistikleri
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Kullanıcı bilgilerini getir
    const user = await User.findById(userId)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Gamification stats'ı getir
    const stats = await getUserStats(userId);

    // Frontend'in beklediği format: { user: {...}, stats: {...} }
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          points: user.xp, // Frontend points bekliyor
          level: user.level,
          createdAt: user.createdAt
        },
        stats: {
          postsCreated: user.stats?.postsCreated || 0,
          commentsAdded: user.stats?.commentsAdded || 0,
          aiInteractions: user.stats?.aiInteractions || 0,
          points: user.xp, // Stats içinde de points
          level: user.level, // Stats içinde de level
          followersCount: user.followers?.length || 0,
          followingCount: user.following?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Profil getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Profil bilgileri alınırken hata oluştu' 
    });
  }
};

// GET /api/gamification/leaderboard - Liderlik tablosu
const getLeaderboardData = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await getLeaderboard(parseInt(limit));

    res.json({
      success: true,
      data: leaderboard
    });

  } catch (error) {
    console.error('Liderlik tablosu hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Liderlik tablosu alınırken hata oluştu' 
    });
  }
};

// GET /api/gamification/achievements - Başarılar ve rozetler
const getAchievements = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await getUserStats(userId);

    // Tüm rozetleri kontrol et
    const allBadges = [
      {
        name: 'İlk Adım',
        description: 'İlk postunu oluşturdun!',
        icon: '🎯',
        earned: stats.user.badges.some(b => b.name === 'İlk Adım'),
        progress: Math.min(stats.user.stats.postsCreated, 1),
        required: 1
      },
      {
        name: 'Yardımsever Mentor',
        description: '10 faydalı yanıt verdin!',
        icon: '🤝',
        earned: stats.user.badges.some(b => b.name === 'Yardımsever Mentor'),
        progress: Math.min(stats.user.stats.helpfulAnswers, 10),
        required: 10
      },
      {
        name: 'AI Kaşifi',
        description: 'AI ile 50 kez etkileşim kurdu!',
        icon: '🤖',
        earned: stats.user.badges.some(b => b.name === 'AI Kaşifi'),
        progress: Math.min(stats.user.stats.aiInteractions, 50),
        required: 50
      },
      {
        name: 'Seri Ustası',
        description: '7 gün üst üste aktif oldun!',
        icon: '🔥',
        earned: stats.user.badges.some(b => b.name === 'Seri Ustası'),
        progress: Math.min(stats.user.streak.current, 7),
        required: 7
      },
      {
        name: 'Yorum Kralı',
        description: '100 yorum ekledin!',
        icon: '💬',
        earned: stats.user.badges.some(b => b.name === 'Yorum Kralı'),
        progress: Math.min(stats.user.stats.commentsAdded, 100),
        required: 100
      },
      {
        name: 'Beğeni Toplayıcısı',
        description: '1000 beğeni topladın!',
        icon: '❤️',
        earned: stats.user.badges.some(b => b.name === 'Beğeni Toplayıcısı'),
        progress: Math.min(stats.user.stats.postsLiked + stats.user.stats.commentsLiked, 1000),
        required: 1000
      }
    ];

    res.json({
      success: true,
      data: {
        badges: allBadges,
        totalBadges: stats.user.badges.length,
        totalPossibleBadges: allBadges.length
      }
    });

  } catch (error) {
    console.error('Başarılar getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Başarılar alınırken hata oluştu' 
    });
  }
};

// GET /api/gamification/activity - Son aktiviteler
const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await getUserStats(userId);

    res.json({
      success: true,
      data: {
        recentActivity: stats.recentActivity,
        totalActivities: stats.recentActivity.length
      }
    });

  } catch (error) {
    console.error('Aktivite getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Aktiviteler alınırken hata oluştu' 
    });
  }
};

module.exports = {
  getUserProfile,
  getLeaderboardData,
  getAchievements,
  getRecentActivity
}; 