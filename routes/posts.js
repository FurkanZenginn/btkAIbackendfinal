const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const {
  createPost,
  getPosts,
  getPersonalizedPosts,
  getPost,
  toggleLike,
  deletePost,
  getPostHapBilgi
} = require('../controllers/postController');

// POST /api/posts - Yeni post oluştur (görsel opsiyonel)
router.post('/', protect, upload, createPost);

// GET /api/posts - Tüm postları getir (feed)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/posts çağrıldı:', req.query);
    
    const { page = 1, limit = 10 } = req.query;
    const Post = require('../models/Post');
    
    const posts = await Post.find({ isModerated: true })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Post.countDocuments({ isModerated: true });
    
    // Frontend'in beklediği format: { success: true, data: { posts: [], totalPages, currentPage } }
    res.json({
      success: true,
      data: {
        posts: posts,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
    });
    
  } catch (error) {
    console.error('❌ Get posts error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Postlar yüklenirken hata oluştu' 
    });
  }
});

// GET /api/posts/simple-test - Basit test endpoint
router.get('/simple-test', (req, res) => {
  res.json({
    success: true,
    message: 'Posts route çalışıyor!',
    timestamp: new Date()
  });
});

// GET /api/posts/test - Test endpoint
router.get('/test', async (req, res) => {
  try {
    const Post = require('../models/Post');
    const totalPosts = await Post.countDocuments({});
    const samplePosts = await Post.find({}).limit(5).lean();
    
    res.json({
      success: true,
      message: 'Posts route çalışıyor',
      totalPosts,
      samplePosts: samplePosts.length,
      hasPosts: samplePosts.length > 0
    });
  } catch (error) {
    console.error('Test endpoint hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/posts/personalized - Kişiselleştirilmiş feed
router.get('/personalized', protect, getPersonalizedPosts);

// GET /api/posts/:id/hap-bilgi - Post için hap bilgi önerileri (önce gelmeli)
router.get('/:id/hap-bilgi', getPostHapBilgi);

// PUT /api/posts/:id/like - Post beğen/beğenme
router.put('/:id/like', protect, toggleLike);

// DELETE /api/posts/:id - Post sil
router.delete('/:id', protect, deletePost);

// GET /api/posts/:id - Tek post getir (en son gelmeli)
router.get('/:id', getPost);

module.exports = router; 