const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');
const {
  createPost,
  getPosts,
  getPersonalizedPosts,
  getPost,
  toggleLike,
  deletePost,
  getPostHapBilgi,
  searchPosts,
  getPopularTags,
  searchTags
} = require('../controllers/postController');

// POST /api/posts - Yeni post oluştur (görsel opsiyonel)
router.post('/', protect, uploadImage, createPost);

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

// 1. SPESİFİK ROUTE'LAR (önce bunlar)
// GET /api/posts/latest - En son post ID'sini ve yeni post durumunu kontrol et
router.get('/latest', async (req, res) => {
  try {
    console.log('🔍 GET /api/posts/latest çağrıldı:', req.query);
    
    const { lastSeenPostId } = req.query;
    const Post = require('../models/Post');
    
    // En son moderasyonu geçmiş postu bul
    const latestPost = await Post.findOne({ isModerated: true })
      .sort({ createdAt: -1 })
      .select('_id createdAt')
      .lean();
    
    if (!latestPost) {
      return res.json({
        success: true,
        data: {
          latestPostId: null,
          hasNewPosts: false
        }
      });
    }
    
    const latestPostId = latestPost._id.toString();
    let hasNewPosts = false;
    
    // Eğer lastSeenPostId verilmişse, karşılaştır
    if (lastSeenPostId) {
      // Son görülen post'tan daha yeni post var mı kontrol et
      const newerPostsCount = await Post.countDocuments({
        _id: { $gt: lastSeenPostId },
        isModerated: true
      });
      
      hasNewPosts = newerPostsCount > 0;
    } else {
      // lastSeenPostId verilmemişse, her zaman yeni post var kabul et
      hasNewPosts = true;
    }
    
    console.log('📊 Latest post check:', {
      latestPostId,
      lastSeenPostId,
      hasNewPosts,
      latestPostCreatedAt: latestPost.createdAt
    });
    
    res.json({
      success: true,
      data: {
        latestPostId,
        hasNewPosts
      }
    });
    
  } catch (error) {
    console.error('❌ Latest posts check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Yeni post kontrolü yapılırken hata oluştu' 
    });
  }
});

// GET /api/posts/personalized - Kişiselleştirilmiş feed
router.get('/personalized', protect, getPersonalizedPosts);

// GET /api/posts/popular-tags - Popüler etiketleri getir
router.get('/popular-tags', async (req, res) => {
  try {
    const result = await getPopularTags(req, res);
  } catch (error) {
    console.error('Popular tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Popüler etiketler yüklenirken hata oluştu'
    });
  }
});

// SEARCH ENDPOINT'LERİ - Yeni eklenen

// GET /api/search/posts - Post arama
router.get('/search', async (req, res) => {
  try {
    await searchPosts(req, res);
  } catch (error) {
    console.error('Post search error:', error);
    res.status(500).json({
      success: false,
      error: 'Post arama sırasında hata oluştu'
    });
  }
});

// GET /api/search/tags - Etiket arama
router.get('/search-tags', async (req, res) => {
  try {
    await searchTags(req, res);
  } catch (error) {
    console.error('Tag search error:', error);
    res.status(500).json({
      success: false,
      error: 'Etiket arama sırasında hata oluştu'
    });
  }
});

// 2. PARAMETRELI ROUTE'LAR (sonra bunlar)
// GET /api/posts/:id/hap-bilgi - Post için hap bilgi önerileri
router.get('/:id/hap-bilgi', getPostHapBilgi);

// PUT /api/posts/:id/like - Post beğen/beğenme
router.put('/:id/like', protect, toggleLike);

// DELETE /api/posts/:id - Post sil
router.delete('/:id', protect, deletePost);

// GET /api/posts/:id - Tek post getir (en son gelmeli)
router.get('/:id', getPost);

module.exports = router; 