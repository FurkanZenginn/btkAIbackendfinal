const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  checkTextModeration,
  checkImageModeration,
  checkSpamContent,
  flagContent
} = require('../controllers/moderationController');

// POST /api/moderation/check-text - Metin moderasyonu
router.post('/check-text', protect, checkTextModeration);

// POST /api/moderation/check-image - Görsel moderasyonu
router.post('/check-image', protect, checkImageModeration);

// POST /api/moderation/check-spam - Spam kontrolü
router.post('/check-spam', protect, checkSpamContent);

// PUT /api/moderation/flag-content/:type/:id - İçerik işaretle
router.put('/flag-content/:type/:id', protect, flagContent);

module.exports = router; 