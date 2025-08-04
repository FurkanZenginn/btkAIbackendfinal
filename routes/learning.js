const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getLearningProgress,
  startLearningSession,
  updateLearningProgress,
  saveAssessmentResult,
  getAvailableTopics
} = require('../controllers/learningController');

// GET /api/learning/progress - Kullanıcının öğrenme ilerlemesi
router.get('/progress', protect, getLearningProgress);

// GET /api/learning/topics - Mevcut konular
router.get('/topics', getAvailableTopics);

// POST /api/learning/start - Yeni öğrenme oturumu başlat
router.post('/start', protect, startLearningSession);

// PUT /api/learning/:id/progress - İlerleme güncelle
router.put('/:id/progress', protect, updateLearningProgress);

// POST /api/learning/:id/assessment - Değerlendirme sonucu kaydet
router.post('/:id/assessment', protect, saveAssessmentResult);

module.exports = router; 