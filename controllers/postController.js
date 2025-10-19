const Post = require('../models/Post');
const User = require('../models/User');
const { uploadToCloudinary } = require('../middleware/uploadMiddleware');

const { addPoints } = require('../services/gamificationService');
const { analyzePostAndMatchHapBilgi } = require('../services/hapBilgiService');
const { getCachedPosts, createCacheKey, deleteCached, getCached, setCached } = require('../services/cacheService');
const { asyncHandler, sendSuccess } = require('../middleware/errorHandler');
const { NotFoundError, ForbiddenError } = require('../utils/AppError');

// POST /api/posts - Yeni post oluştur
const createPost = async (req, res) => {
  try {
    // Environment variables kontrolü
    console.log('Environment Variables Check:', {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
    });

    console.log('Post oluşturma başladı:', {
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: !!req.file.buffer
      } : 'No file'
    });

    // FormData debug - Frontend'den gelen verileri kontrol et
    console.log('📁 FormData Debug:');
    console.log('  - postType:', req.body.postType);
    console.log('  - content:', req.body.content);
    console.log('  - caption:', req.body.caption);
    console.log('  - topicTags:', req.body.topicTags);

    const { postType, content, caption, topicTags } = req.body;
    // userId'yi req.user'dan al (authentication token'dan)
    const finalUserId = req.user._id || req.user.id;
    
    // Debug: userId değerlerini kontrol et
    console.log('🔍 userId Debug:');
    console.log('  - req.body.userId:', req.body.userId);
    console.log('  - req.user:', req.user);
    console.log('  - req.user._id:', req.user?._id);
    console.log('  - req.user.id:', req.user?.id);
    console.log('  - finalUserId:', finalUserId);

    // Post türü kontrolü - Frontend uyumluluğu için
    const validPostTypes = ['soru', 'danışma', 'question', 'consultation'];
    if (!postType || !validPostTypes.includes(postType)) {
      return res.status(400).json({ error: 'Post türü belirtilmelidir (soru, danışma, question, consultation)' });
    }

    // İçerik kontrolü - caption veya content'ten birini kabul et
    const postContent = content || caption;
    if (!postContent || postContent.trim().length === 0) {
      return res.status(400).json({ error: 'İçerik metni zorunludur (content veya caption)' });
    }

    // Görsel artık opsiyonel
    let imageURL = null;
    if (req.file) {

      // Cloudinary config kontrolü
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.error('Cloudinary config eksik!');
        return res.status(500).json({ error: 'Cloudinary konfigürasyonu eksik' });
      }

      console.log('Cloudinary yükleme başlıyor...');
      
      // Cloudinary'ye yükle - Buffer handling düzeltildi
      console.log('📁 File object debug:', {
        hasFile: !!req.file,
        fileType: typeof req.file,
        hasBuffer: !!req.file?.buffer,
        bufferType: typeof req.file?.buffer,
        isBuffer: Buffer.isBuffer(req.file?.buffer),
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size
      });
      
      // Güvenli buffer handling
      if (req.file && req.file.buffer && Buffer.isBuffer(req.file.buffer)) {
        imageURL = await uploadToCloudinary(req.file.buffer, {
          folder: 'posts',
          public_id: `post_${Date.now()}`
        });
      } else {
        console.error('❌ Invalid file format:', req.file);
        return res.status(400).json({ error: 'Geçersiz dosya formatı' });
      }
      
      console.log('Cloudinary yükleme tamamlandı:', imageURL);

      if (!imageURL) {
        console.error('ImageURL oluşturulamadı!');
        return res.status(500).json({ error: 'Görsel yüklenemedi' });
      }
    }

    // Post oluştur - Frontend uyumluluğu için
    const post = new Post({
      userId: finalUserId, // Düzeltildi: finalUserId kullan
      postType,
      content: postContent, // content veya caption'dan gelen değer
      imageURL,
      caption: caption || postContent.substring(0, 100) + '...', // Geriye uyumluluk için
      topicTags: topicTags ? topicTags.split(',').map(tag => tag.trim()) : [],
      isModerated: true // Moderation geçici olarak kaldırıldı - direkt onaylı
    });

    console.log('Post kaydediliyor:', {
      userId: finalUserId, // Düzeltildi: finalUserId göster
      imageURL: post.imageURL,
      caption: post.caption,
      topicTags: post.topicTags,
      isModerated: post.isModerated
    });

    await post.save();
    console.log('Post kaydedildi:', post._id);

    // Hap bilgi analizi yap (tamamen asenkron - kullanıcıyı bekletmez)
    setImmediate(async () => {
      try {
        console.log('Hap bilgi analizi başlıyor (asenkron)...');
        const hapBilgiAnalysis = await analyzePostAndMatchHapBilgi(content, imageURL);
        
        if (hapBilgiAnalysis) {
          await Post.findByIdAndUpdate(post._id, {
            hapBilgiAnalysis: hapBilgiAnalysis
          });
          console.log('Hap bilgi analizi tamamlandı (asenkron):', hapBilgiAnalysis.detectedTopic);
          

        }
      } catch (analysisError) {
        console.error('Hap bilgi analizi hatası (asenkron):', analysisError);
      }
    });

    // Gamification - puan ekle
    const gamificationResult = await addPoints(
      finalUserId,
      'post_created',
      'Yeni post oluşturdun!',
      { postId: post._id }
    );
    
    if (gamificationResult) {
      console.log('✅ Gamification puanı eklendi:', gamificationResult);
    } else {
      console.log('⚠️ Gamification puanı eklenemedi (kullanıcı bulunamadı)');
    }

    // Cache'i temizle (sadece gerekli olanları)
    try {
      const { flushCache } = require('../services/cacheService');
      // Sadece post listesi cache'ini temizle, diğerlerini bırak
      console.log('Post listesi cache temizleniyor...');
    } catch (cacheError) {
      console.error('Cache temizleme hatası:', cacheError);
    }

    // User bilgileriyle birlikte döndür
    const populatedPost = await Post.findById(post._id).populate('userId', 'name avatar');

    console.log('Post oluşturma başarılı:', populatedPost._id);

    res.status(201).json({
      success: true,
      message: 'Post başarıyla oluşturuldu',
      data: {
        post: populatedPost,
        gamification: gamificationResult
      }
    });

  } catch (error) {
    console.error('Post oluşturma hatası detayı:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'Post oluşturulurken hata oluştu: ' + error.message });
  }
};

// GET /api/posts - Tüm postları getir (feed) - Cache ile optimize edilmiş
const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, topic, sort = 'recent', all } = req.query;
    
    console.log('🔍 GET /api/posts çağrıldı:', { page, limit, topic, sort });
    
    const skip = (page - 1) * limit;
    let query = { isModerated: true }; // Sadece moderasyonu onaylanmış postları getir
    
    // Konu filtresi
    if (topic) {
      query.topicTags = { $in: [topic] };
    }

    // Sıralama
    let sortOption = {};
    if (sort === 'recent') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'popular') {
      sortOption = { commentCount: -1, likes: -1 };
    }

    // Ultra optimize query - sadece gerekli alanlar
    const posts = await Post.find(query)
      .select('userId postType content imageURL caption topicTags likes commentCount createdAt')
      .populate('userId', 'name avatar')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Total count'u ayrı query ile
    const total = await Post.countDocuments(query);

    console.log('📊 Query sonucu:', { postsCount: posts.length, total, query });
    
    // Frontend'in beklediği format:
    res.json({
      success: true,
      data: {
        posts: posts || [], // Array olarak gönder (boş array fallback)
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
    });

  } catch (error) {
    console.error('Post getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Postlar getirilirken hata oluştu' 
    });
  }
};

// GET /api/posts/personalized - Kişiselleştirilmiş feed
const getPersonalizedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Kullanıcının ilgi alanlarını al (şimdilik boş, sonra AI ile doldurulacak)
    const user = await User.findById(userId).select('topics').lean();
    const userTopics = user?.topics || [];

    let query = { isModerated: true }; // Sadece onaylı postları göster
    
    // Kullanıcının ilgi alanlarına göre filtrele
    if (userTopics.length > 0) {
      query.topicTags = { $in: userTopics };
    }

    const posts = await Post.find(query)
      .select('userId postType content imageURL caption topicTags likes commentCount createdAt')
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Plain object - çok daha hızlı

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });

  } catch (error) {
    console.error('Kişiselleştirilmiş post getirme hatası:', error);
    res.status(500).json({ error: 'Kişiselleştirilmiş postlar getirilirken hata oluştu' });
  }
};

// GET /api/posts/:id - Tek post getir
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name avatar')
      .populate('hapBilgiAnalysis.relatedHapBilgiler.hapBilgiId', 'topic title content category difficulty tags tips examples');

    if (!post) {
      return res.status(404).json({ error: 'Post bulunamadı' });
    }

    res.json(post);

  } catch (error) {
    console.error('Post getirme hatası:', error);
    res.status(500).json({ error: 'Post getirilirken hata oluştu' });
  }
};

// PUT /api/posts/:id/like - Post beğen/beğenme
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user._id;

    if (!post) {
      return res.status(404).json({ error: 'Post bulunamadı' });
    }

    const likeIndex = post.likes.indexOf(userId);
    
    if (likeIndex > -1) {
      // Beğeniyi kaldır
      post.likes.splice(likeIndex, 1);
    } else {
      // Beğen
      post.likes.push(userId);
    }

    await post.save();



    res.json({ 
      message: likeIndex > -1 ? 'Beğeni kaldırıldı' : 'Beğenildi',
      likes: post.likes.length
    });

  } catch (error) {
    console.error('Beğeni hatası:', error);
    res.status(500).json({ error: 'Beğeni işlemi sırasında hata oluştu' });
  }
};

// DELETE /api/posts/:id - Post sil
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new NotFoundError('Post');
  }

  // Sadece post sahibi veya admin silebilir
  if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ForbiddenError('Bu postu silmek için yetkiniz yok');
  }

  await post.deleteOne();

  // Cache'i temizle
  await deleteCached(`post_${req.params.id}`);
  await deleteCached('posts');

  sendSuccess(res, null, 'Post başarıyla silindi');
});

// GET /api/posts/:id/hap-bilgi - Post için hap bilgi önerileri
const getPostHapBilgi = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post bulunamadı' });
    }

    // Eğer analiz yoksa yeni analiz yap
    if (!post.hapBilgiAnalysis || !post.hapBilgiAnalysis.detectedTopic) {
      const hapBilgiAnalysis = await analyzePostAndMatchHapBilgi(post.caption, post.imageURL);
      
      if (hapBilgiAnalysis) {
        post.hapBilgiAnalysis = hapBilgiAnalysis;
        await post.save();
      }
    }

    // Hap bilgi analizini populate et
    const populatedPost = await Post.findById(req.params.id)
      .populate('hapBilgiAnalysis.relatedHapBilgiler.hapBilgiId', 'topic title content category difficulty tags tips examples');

    res.json({
      success: true,
      data: {
        postId: post._id,
        analysis: populatedPost.hapBilgiAnalysis,
        relatedHapBilgiler: populatedPost.hapBilgiAnalysis?.relatedHapBilgiler || []
      }
    });

  } catch (error) {
    console.error('Post hap bilgi getirme hatası:', error);
    res.status(500).json({ error: 'Hap bilgi önerileri alınırken hata oluştu' });
  }
};

// GET /api/posts/search - Post arama
const searchPosts = async (req, res) => {
  try {
    const { q, type, category, difficulty, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi gerekli'
      });
    }

    const searchQuery = q.trim();
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Arama sorgusu oluştur
    let query = {
      $or: [
        { content: { $regex: searchQuery, $options: 'i' } },
        { caption: { $regex: searchQuery, $options: 'i' } },
        { topicTags: { $in: [new RegExp(searchQuery, 'i')] } }
      ],
      isModerated: true // Sadece moderasyonu geçmiş post'lar
    };

    // Post türü filtresi
    if (type && ['soru', 'danışma', 'question', 'consultation'].includes(type)) {
      query.postType = type;
    }

    // Kategori filtresi (hap bilgi analizi varsa)
    if (category) {
      query['hapBilgiAnalysis.detectedCategory'] = category;
    }

    // Zorluk seviyesi filtresi
    if (difficulty && ['kolay', 'orta', 'zor'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    // Post'ları bul
    const posts = await Post.find(query)
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    // Toplam sayıyı al
    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalPosts: total,
          hasNextPage: skip + limitNumber < total,
          hasPrevPage: pageNumber > 1
        },
        filters: {
          query: searchQuery,
          type,
          category,
          difficulty
        }
      }
    });

  } catch (error) {
    console.error('Post arama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Post arama sırasında hata oluştu'
    });
  }
};

// GET /api/posts/popular-tags - Popüler etiketleri getir
const getPopularTags = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log('🏷️ Get popular tags:', { limit });
    
    // Popüler etiketleri getir
    const popularTags = await Post.aggregate([
      { $match: { isModerated: true } },
      { $unwind: '$topicTags' },
      { $group: { _id: '$topicTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    // Kategorileri de getir
    const categories = await Post.aggregate([
      { $match: { isModerated: true, 'hapBilgiAnalysis.detectedCategory': { $exists: true } } },
      { $group: { _id: '$hapBilgiAnalysis.detectedCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        tags: popularTags.map(tag => ({ name: tag._id, count: tag.count })),
        categories: categories.map(cat => ({ name: cat._id, count: cat.count }))
      }
    });
    
  } catch (error) {
    console.error('❌ Get popular tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Etiketler yüklenirken hata oluştu'
    });
  }
};

// GET /api/search/tags - Etiket arama
const searchTags = async (req, res) => {
  try {
    const { q, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi gerekli'
      });
    }

    const searchQuery = q.trim();
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Etiket arama sorgusu
    const tags = await Post.aggregate([
      { $match: { isModerated: true } },
      { $unwind: '$topicTags' },
      { $match: { topicTags: { $regex: searchQuery, $options: 'i' } } },
      { $group: { _id: '$topicTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $skip: skip },
      { $limit: limitNumber }
    ]);

    // Toplam etiket sayısını al
    const totalTags = await Post.aggregate([
      { $match: { isModerated: true } },
      { $unwind: '$topicTags' },
      { $match: { topicTags: { $regex: searchQuery, $options: 'i' } } },
      { $group: { _id: '$topicTags' } },
      { $count: 'total' }
    ]);

    const total = totalTags[0]?.total || 0;

    res.json({
      success: true,
      data: {
        tags: tags.map(tag => ({ name: tag._id, count: tag.count })),
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalTags: total,
          hasNextPage: skip + limitNumber < total,
          hasPrevPage: pageNumber > 1
        },
        filters: {
          query: searchQuery
        }
      }
    });

  } catch (error) {
    console.error('Etiket arama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Etiket arama sırasında hata oluştu'
    });
  }
};

module.exports = {
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
}; 