const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  askAI,
  askAIWithOptions,
  analyzePost,
  getHapBilgi,
  analyzeUserInterests,
  analyzeImageOnly
} = require('../controllers/aiController');
const { improvePromptFrontend, PROMPT_IMPROVEMENT_RULES } = require('../services/geminiService');

// POST /api/ai/question - AI ile soru sor (eski versiyon - yavaş)
router.post('/question', protect, askAI);

// POST /api/ai/ask-with-options - AI ile soru sor (yeni versiyon - hızlı)
router.post('/ask-with-options', protect, askAIWithOptions);

// POST /api/ai/improve-prompt - Frontend için prompt iyileştirme
router.post('/improve-prompt', (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt boş olamaz.' });
    }

    const improvedPrompt = improvePromptFrontend(prompt);
    
    res.json({
      originalPrompt: prompt,
      improvedPrompt: improvedPrompt,
      rules: PROMPT_IMPROVEMENT_RULES
    });
  } catch (error) {
    console.error('Prompt iyileştirme hatası:', error);
    res.status(500).json({ error: 'Prompt iyileştirme sırasında hata oluştu.' });
  }
});

// POST /api/ai/analyze-image - Sadece görsel analizi
router.post('/analyze-image', protect, analyzeImageOnly);

// POST /api/ai/analyze-post/:postId - Post analizi
router.post('/analyze-post/:postId', protect, analyzePost);

// POST /api/ai/hap-bilgi - Hap bilgi önerisi
router.post('/hap-bilgi', protect, getHapBilgi);

// POST /api/ai/user-analysis - Kullanıcı analizi
router.post('/user-analysis', protect, analyzeUserInterests);

// GET /api/ai/test - AI test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'AI routes çalışıyor!',
    endpoints: [
      'POST /api/ai/question',
      'POST /api/ai/ask-with-options',
      'POST /api/ai/improve-prompt'
    ],
    timestamp: new Date()
  });
});

module.exports = router;
