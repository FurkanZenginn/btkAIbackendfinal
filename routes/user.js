const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const User = require('../models/User');
const {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getUserProfile,
  getFollowingPosts,
  getUserPosts,
  getUserFollowers,
  getUserFollowing,
  searchUsers,
  testFollowSystem
} = require('../controllers/userController');

// ÖNEMLİ: Spesifik route'ları en üste koy (parametreli route'lardan önce)

// GET /api/user/search - Kullanıcı arama
router.get('/search', protect, searchUsers);

// GET /api/user/profile - Kendi profilini getir
router.get('/profile', protect, getProfile);

// GET /api/user/following/posts - Takip edilen kullanıcıların postları
router.get('/following/posts', protect, getFollowingPosts);

// GET /api/user/test-follow/:userId - Follow sistemi test etmek için
router.get('/test-follow/:userId', protect, testFollowSystem);

// PUT /api/user/profile - Profil güncelle (FormData ile avatar yükleme)
router.put('/profile', protect, upload, updateProfile);

// PUT /api/user/profile-json - Sadece JSON için (avatar URL güncelleme)
router.put('/profile-json', protect, updateProfile);

// POST /api/user/follow/:userId - Kullanıcı takip et/bırak (toggle)
router.post('/follow/:userId', protect, followUser);

// DELETE /api/user/follow/:userId - Kullanıcı takibi bırak (alternatif)
router.delete('/follow/:userId', protect, unfollowUser);

// Parametreli route'lar (en sona)

// GET /api/user/:userId/profile - Başka kullanıcının profilini görüntüle
router.get('/:userId/profile', protect, getUserProfile);

// GET /api/user/:userId/posts - Kullanıcının tüm postları
router.get('/:userId/posts', protect, getUserPosts);

// GET /api/user/:userId/followers - Kullanıcının takipçilerini getir
router.get('/:userId/followers', protect, getUserFollowers);

// GET /api/user/:userId/following - Kullanıcının takip ettiklerini getir
router.get('/:userId/following', protect, getUserFollowing);

// Admin route'ları (en sona)

// GET /api/user/:id - Admin için kullanıcı getir
router.get('/:id', protect, isAdmin, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (user) res.json(user);
  else res.status(404).json({ error: 'Kullanıcı bulunamadı' });
});

// DELETE /api/user/:id - Admin için kullanıcı sil
router.delete('/:id', protect, isAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    await user.deleteOne();
    res.json({ message: 'Kullanıcı silindi' });
  } else {
    res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
});

module.exports = router;
