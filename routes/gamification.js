const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserProfile,
  getLeaderboardData,
  getAchievements,
  getRecentActivity
} = require('../controllers/gamificationController');

// GET /api/gamification/profile - Kullanıcı profil ve istatistikleri
router.get('/profile', protect, getUserProfile);

// GET /api/gamification/leaderboard - Liderlik tablosu
router.get('/leaderboard', getLeaderboardData);

// GET /api/gamification/achievements - Başarılar ve rozetler
router.get('/achievements', protect, getAchievements);

// GET /api/gamification/activity - Son aktiviteler
router.get('/activity', protect, getRecentActivity);

module.exports = router; 