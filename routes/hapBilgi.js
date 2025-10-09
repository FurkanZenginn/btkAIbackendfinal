const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { asyncHandler, sendSuccess, sendError } = require('../middleware/errorHandler');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const {
  analyzePostAndCreateHapBilgi,
  createHapBilgiFromQuestion, // Yeni import
  findAndLinkRelatedHapBilgiler, // İlişkili hap bilgileri bağlama için
  getRecommendedHapBilgiler,
  findSimilarQuestions,
  searchHapBilgiler,
  getHapBilgiStats,
  getUserSpecificHapBilgiler,
  getUserHapBilgiStats
} = require('../services/hapBilgiService');
const HapBilgi = require('../models/HapBilgi');

// GET /api/hap-bilgi - Tüm hap bilgileri
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, difficulty, sort = 'recent' } = req.query;
  const skip = (page - 1) * limit;
  
  let query = { isActive: true };
  if (category) query.category = category;
  if (difficulty) query.difficulty = difficulty;
  
  let sortOption = {};
  switch (sort) {
    case 'popular':
      sortOption = { usageCount: -1 };
      break;
    case 'confidence':
      sortOption = { 'aiAnalysis.confidence': -1 };
      break;
    case 'recent':
    default:
      sortOption = { createdAt: -1 };
  }
  
  const hapBilgiler = await HapBilgi.find(query)
    .populate('createdBy', 'name avatar')
    .sort(sortOption)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await HapBilgi.countDocuments(query);
  
  sendSuccess(res, {
    hapBilgiler,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    total
  });
}));

// GET /api/hap-bilgi/recommended - Önerilen hap bilgiler
router.get('/recommended', protect, asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const recommendations = await getRecommendedHapBilgiler(req.user._id, parseInt(limit));
  sendSuccess(res, recommendations);
}));

// GET /api/hap-bilgi/search - Hap bilgi arama
router.get('/search', asyncHandler(async (req, res) => {
  const { q, category, difficulty, limit = 20 } = req.query;
  
  if (!q) {
    throw new ValidationError('Arama terimi gerekli');
  }
  
  const results = await searchHapBilgiler(q, { category, difficulty, limit: parseInt(limit) });
  sendSuccess(res, results);
}));

// GET /api/hap-bilgi/:id - Tek hap bilgi
router.get('/:id', asyncHandler(async (req, res) => {
  const hapBilgi = await HapBilgi.findById(req.params.id)
    .populate('createdBy', 'name avatar')
    .populate('relatedHapBilgiler.hapBilgiId', 'title topic category difficulty')
    .populate('relatedPosts.postId', 'content userId');
  
  if (!hapBilgi) {
    throw new NotFoundError('Hap bilgi');
  }
  
  // Görüntülenme sayısını artır
  hapBilgi.viewCount += 1;
  await hapBilgi.save();
  
  sendSuccess(res, hapBilgi);
}));

// GET /api/hap-bilgi/:id/similar-questions - Benzer sorular
router.get('/:id/similar-questions', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const similarQuestions = await findSimilarQuestions(req.params.id, parseInt(limit));
  sendSuccess(res, similarQuestions);
}));

// POST /api/hap-bilgi/create-from-post - Post'tan hap bilgi oluştur
router.post('/create-from-post', protect, asyncHandler(async (req, res) => {
  const { postId } = req.body;
  
  if (!postId) {
    throw new ValidationError('Post ID gerekli');
  }
  
  const hapBilgi = await analyzePostAndCreateHapBilgi(postId, req.user._id);
  sendSuccess(res, hapBilgi, 'Hap bilgi başarıyla oluşturuldu');
}));

// POST /api/hap-bilgi/create-from-question - Soru ve AI yanıtından hap bilgi oluştur
router.post('/create-from-question', protect, asyncHandler(async (req, res) => {
  const { question, aiResponse } = req.body;
  
  if (!question || !aiResponse) {
    throw new ValidationError('Soru ve AI yanıtı gerekli');
  }
  
  const hapBilgi = await createHapBilgiFromQuestion(question, aiResponse, req.user._id);
  sendSuccess(res, hapBilgi, 'Hap bilgi başarıyla oluşturuldu');
}));

// POST /api/hap-bilgi/create - Yeni hap bilgi oluştur (Görsellerde belirtilen endpoint)
router.post('/create', protect, asyncHandler(async (req, res) => {
  const {
    title,
    content,
    category,
    difficulty,
    keywords,
    tags,
    originalQuestion,
    originalAIResponse
  } = req.body;
  
  // Validation
  if (!title || !content || !category || !difficulty) {
    throw new ValidationError('Title, content, category ve difficulty alanları zorunludur');
  }
  
  // Hap bilgi oluştur
  const hapBilgi = new HapBilgi({
    topic: title, // title'ı topic olarak kullan
    title,
    content,
    category,
    difficulty,
    tags: tags || [],
    aiAnalysis: {
      confidence: 0.8,
      keywords: keywords || [],
      summary: content.substring(0, 200), // İlk 200 karakteri özet olarak kullan
      relatedConcepts: keywords || [],
      learningObjectives: keywords || []
    },
    sourceType: 'ai_generated',
    createdBy: req.user._id
  });
  
  // Eğer originalQuestion ve originalAIResponse varsa kaydet
  if (originalQuestion && originalAIResponse) {
    hapBilgi.aiAnalysis.sourceQuestion = originalQuestion;
    hapBilgi.aiAnalysis.sourceAIResponse = originalAIResponse;
  }
  
  await hapBilgi.save();
  
  // İlişkili hap bilgileri bul ve bağla
  try {
    await findAndLinkRelatedHapBilgiler(hapBilgi);
  } catch (error) {
    console.error('İlişkili hap bilgi bağlama hatası:', error);
  }
  
  sendSuccess(res, hapBilgi, 'Hap bilgi başarıyla oluşturuldu');
}));

// GET /api/hap-bilgi/test-create - Test endpoint (geliştirme için)
router.get('/test-create', protect, asyncHandler(async (req, res) => {
  const testQuestion = "İntegral nasıl hesaplanır?";
  const testAIResponse = "İntegral hesaplamak için önce fonksiyonun türevini alırız. Sonra ters işlem yaparız. Örnek: ∫x²dx = x³/3 + C";
  
  const hapBilgi = await createHapBilgiFromQuestion(testQuestion, testAIResponse, req.user._id);
  sendSuccess(res, hapBilgi, 'Test hap bilgi oluşturuldu');
}));

// POST /api/hap-bilgi/:id/like - Hap bilgi beğen
router.post('/:id/like', protect, asyncHandler(async (req, res) => {
  const hapBilgi = await HapBilgi.findById(req.params.id);
  
  if (!hapBilgi) {
    throw new NotFoundError('Hap bilgi');
  }
  
  const likeIndex = hapBilgi.likedBy.indexOf(req.user._id);
  
  if (likeIndex > -1) {
    // Beğeniyi kaldır
    hapBilgi.likedBy.splice(likeIndex, 1);
    hapBilgi.likeCount -= 1;
  } else {
    // Beğen
    hapBilgi.likedBy.push(req.user._id);
    hapBilgi.likeCount += 1;
  }
  
  await hapBilgi.save();
  
  sendSuccess(res, {
    liked: likeIndex === -1,
    likeCount: hapBilgi.likeCount
  });
}));

// POST /api/hap-bilgi/:id/save - Hap bilgi kaydet
router.post('/:id/save', protect, asyncHandler(async (req, res) => {
  const hapBilgi = await HapBilgi.findById(req.params.id);
  
  if (!hapBilgi) {
    throw new NotFoundError('Hap bilgi');
  }
  
  const saveIndex = hapBilgi.savedBy.indexOf(req.user._id);
  
  if (saveIndex > -1) {
    // Kaydetmeyi kaldır
    hapBilgi.savedBy.splice(saveIndex, 1);
  } else {
    // Kaydet
    hapBilgi.savedBy.push(req.user._id);
  }
  
  await hapBilgi.save();
  
  sendSuccess(res, {
    saved: saveIndex === -1
  });
}));

// POST /api/hap-bilgi/:id/use - Hap bilgi kullan
router.post('/:id/use', protect, asyncHandler(async (req, res) => {
  const hapBilgi = await HapBilgi.findById(req.params.id);
  
  if (!hapBilgi) {
    throw new NotFoundError('Hap bilgi');
  }
  
  hapBilgi.usageCount += 1;
  await hapBilgi.save();
  
  sendSuccess(res, {
    usageCount: hapBilgi.usageCount
  });
}));

// GET /api/hap-bilgi/stats - Hap bilgi istatistikleri
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const stats = await getHapBilgiStats();
  sendSuccess(res, stats);
}));

// GET /api/hap-bilgi/user/saved - Kullanıcının kaydettiği hap bilgiler
router.get('/user/saved', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const savedHapBilgiler = await HapBilgi.find({
    savedBy: req.user._id,
    isActive: true
  })
  .populate('createdBy', 'name avatar')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));
  
  const total = await HapBilgi.countDocuments({
    savedBy: req.user._id,
    isActive: true
  });
  
  sendSuccess(res, {
    hapBilgiler: savedHapBilgiler,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    total
  });
}));

// KULLANICI BAZLI VERİ FİLTRELEME - Yeni endpoint'ler

// GET /api/hap-bilgi/user/my-hap-bilgiler - Kullanıcının kendi hap bilgileri
router.get('/user/my-hap-bilgiler', protect, asyncHandler(async (req, res) => {
  const { category, difficulty, limit = 20, page = 1 } = req.query;
  
  const hapBilgiler = await getUserSpecificHapBilgiler(req.user._id, {
    category,
    difficulty,
    limit: parseInt(limit),
    page: parseInt(page)
  });
  
  sendSuccess(res, {
    hapBilgiler,
    filters: { category, difficulty },
    pagination: { page: parseInt(page), limit: parseInt(limit) },
    userId: req.user._id
  });
}));

// GET /api/hap-bilgi/user/stats - Kullanıcının hap bilgi istatistikleri
router.get('/user/stats', protect, asyncHandler(async (req, res) => {
  const stats = await getUserHapBilgiStats(req.user._id);
  
  sendSuccess(res, {
    stats,
    userId: req.user._id,
    timestamp: new Date()
  });
}));

module.exports = router; 