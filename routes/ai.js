const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  askAI,
  askAIWithOptions,
  analyzePost,
  getHapBilgi,
  analyzeUserInterests,
  analyzeImageOnly,
  testSystemStatus,
  createAIComment
} = require('../controllers/aiController');
const { improvePromptFrontend, PROMPT_IMPROVEMENT_RULES } = require('../services/geminiService');

router.post('/question', protect, askAI);

router.post('/ask-with-options', protect, askAIWithOptions);

router.post('/comment', protect, createAIComment);

router.post('/improve-prompt', (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt cannot be empty.' });
    }

    const improvedPrompt = improvePromptFrontend(prompt);
    
    res.json({
      originalPrompt: prompt,
      improvedPrompt: improvedPrompt,
      rules: PROMPT_IMPROVEMENT_RULES
    });
  } catch (error) {
    console.error('Prompt improvement error:', error);
    res.status(500).json({ error: 'Error occurred during prompt improvement.' });
  }
});

router.post('/analyze-image', protect, analyzeImageOnly);

router.post('/analyze-post/:postId', protect, analyzePost);

router.post('/hap-bilgi', protect, getHapBilgi);

router.post('/user-analysis', protect, analyzeUserInterests);

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'AI routes are working!',
    endpoints: [
      'POST /api/ai/question',
      'POST /api/ai/ask-with-options',
      'POST /api/ai/improve-prompt'
    ],
    timestamp: new Date()
  });
});

router.get('/system-status', testSystemStatus);

module.exports = router;
