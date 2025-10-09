const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createIndexes } = require('./utils/databaseOptimizer');
require('dotenv').config();

const app = express();

// Environment variables check
console.log('Environment Variables Check:');
console.log('  - MONGO_URI:', process.env.MONGO_URI ? 'SET' : 'NOT SET');
console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('  - GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('  - CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary configuration missing! Please check .env file.');
}

app.use(cors({
  origin: ["http://localhost:8081", "http://localhost:3000", "http://10.0.2.2:8081"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const initializeApp = async () => {
  try {
    console.log('Starting application...');
    
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('MongoDB connection failed! Application cannot start.');
      process.exit(1);
    }
    
    try {
      await createIndexes();
      console.log('Database indexes created successfully');
    } catch (indexError) {
      console.error('Database index creation failed:', indexError.message);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { seedHapBilgiler } = require('./utils/seedHapBilgiler');
        await seedHapBilgiler();
      } catch (seedError) {
        console.error('Seed data error:', seedError.message);
      }
    }
    
    console.log('Application started successfully!');
  } catch (error) {
    console.error('Application startup error:', error.message);
    process.exit(1);
  }
};

initializeApp();

// Routes
const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const gamificationRoutes = require('./routes/gamification');
const notificationRoutes = require('./routes/notifications');
const hapBilgiRoutes = require('./routes/hapBilgi');
const moderationRoutes = require('./routes/moderation');
const learningRoutes = require('./routes/learning');
const ocrRoutes = require('./routes/ocr');

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/hap-bilgi', hapBilgiRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/ocr', ocrRoutes);

app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Backend is running!',
    timestamp: new Date(),
    routes: ['/api/posts', '/api/auth', '/api/user', '/api/ai'],
    environment: {
      nodeEnv: process.env.NODE_ENV,
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
        apiKey: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
      }
    }
  });
});

app.post('/api/test-avatar-upload', (req, res) => {
  const { uploadAvatar } = require('./middleware/uploadMiddleware');
  
  uploadAvatar(req, res, (err) => {
    if (err) {
      console.error('Upload test error:', err);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    console.log('Upload test successful:', {
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      } : 'NO FILE',
      body: req.body
    });
    
    res.json({
      success: true,
      message: 'Upload test successful',
      data: {
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null,
        body: req.body
      }
    });
  });
});

app.get('/api/test-follow-system', (req, res) => {
  res.json({
    success: true,
    message: 'Follow system test endpoint',
    endpoints: {
      follow: 'POST /api/user/follow/:userId',
      unfollow: 'DELETE /api/user/follow/:userId',
      profile: 'GET /api/user/:userId/profile',
      followers: 'GET /api/user/:userId/followers',
      following: 'GET /api/user/:userId/following'
    },
    features: {
      toggleFollow: 'Toggle follow with same endpoint',
      gamification: 'Follow points: 5 XP',
      validation: 'Self-follow prevention'
    }
  });
});

// AI Prompt Test Endpoint
app.post('/api/test-ai-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt gerekli'
      });
    }
    
    const { getFastAIResponse } = require('./services/geminiService');
    
    console.log('🧪 AI Prompt Test:');
    console.log('  - Original prompt:', prompt);
    
    const response = await getFastAIResponse(prompt);
    
    console.log('  - AI Response:', response);
    
    res.json({
      success: true,
      data: {
        originalPrompt: prompt,
        aiResponse: response,
        promptLength: prompt.length,
        isSimpleQuestion: prompt.length < 50
      }
    });
    
  } catch (error) {
    console.error('AI Prompt Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// YENİ: @GeminiHoca Test Endpoint'i
app.post('/api/test-gemini-hoca', async (req, res) => {
  try {
    const { userComment, postContent } = req.body;
    
    if (!userComment) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı yorumu gerekli'
      });
    }
    
    const { getFastAIResponse } = require('./services/geminiService');
    
    console.log('🤖 @GeminiHoca Test:');
    console.log('  - User Comment:', userComment);
    console.log('  - Post Content:', postContent || 'Görsel post');
    
    // Test prompt'u oluştur
    const testPrompt = `
    Öğrenci yorumu: "${userComment}"
    Post içeriği: "${postContent || 'Görsel post'}"
    
    Bu yoruma göre öğrenciye yardımcı ol. Kısa, net ve faydalı bir yanıt ver.
    Yanıtın maksimum 200 karakter olsun.
    `;
    
    const response = await getFastAIResponse(testPrompt);
    
    console.log('  - AI Response:', response);
    
    res.json({
      success: true,
      data: {
        userComment,
        postContent: postContent || 'Görsel post',
        aiResponse: response,
        promptLength: testPrompt.length,
        responseLength: response.length
      }
    });
    
  } catch (error) {
    console.error('@GeminiHoca Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// YENİ: Comment Test Endpoint'i - parentCommentId field'ını test etmek için
app.get('/api/test-comments/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const Comment = require('./models/Comment');
    
    // Yorumları getir ve parentCommentId field'ının döndüğünü kontrol et
    const comments = await Comment.find({ postId })
      .select('_id postId userId text parentCommentId isFromGemini likes createdAt updatedAt')
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log('🧪 Comment Test - parentCommentId field kontrolü:');
    comments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Comment ID: ${comment._id}`);
      console.log(`     Text: ${comment.text?.substring(0, 50)}...`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     isFromGemini: ${comment.isFromGemini}`);
      console.log('     ---');
    });
    
    res.json({
      success: true,
      message: 'Comment test başarılı - parentCommentId field kontrolü',
      data: {
        postId,
        totalComments: comments.length,
        comments: comments.map(comment => ({
          _id: comment._id,
          text: comment.text,
          userId: comment.userId,
          parentCommentId: comment.parentCommentId, // Bu field'ın döndüğünü kontrol et
          isFromGemini: comment.isFromGemini,
          createdAt: comment.createdAt
        })),
        fieldCheck: {
          hasParentCommentId: comments.every(c => c.parentCommentId !== undefined),
          hasIsFromGemini: comments.every(c => c.isFromGemini !== undefined),
          parentCommentIdValues: comments.map(c => c.parentCommentId)
        }
      }
    });
    
  } catch (error) {
    console.error('Comment Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// YENİ: ROOT CAUSE Test Endpoint'i - parentCommentId field'ının nerede kaybolduğunu bulmak için
app.get('/api/root-cause-test/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const Comment = require('./models/Comment');
    
    console.log('🔍 ROOT CAUSE TEST BAŞLADI - postId:', postId);
    
    // 1. Ham veri - select olmadan
    console.log('📊 1. Ham veri testi (select olmadan):');
    const rawComments = await Comment.find({ postId }).limit(3);
    rawComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Raw Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment.toObject()));
    });
    
    // 2. Select ile veri
    console.log('📊 2. Select ile veri testi:');
    const selectedComments = await Comment.find({ postId })
      .select('_id postId userId text parentCommentId isFromGemini likes createdAt updatedAt')
      .limit(3);
    selectedComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Selected Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment.toObject()));
    });
    
    // 3. Lean ile veri
    console.log('📊 3. Lean ile veri testi:');
    const leanComments = await Comment.find({ postId })
      .select('_id postId userId text parentCommentId isFromGemini likes createdAt updatedAt')
      .lean()
      .limit(3);
    leanComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Lean Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment));
    });
    
    // 4. Populate ile veri
    console.log('📊 4. Populate ile veri testi:');
    const populatedComments = await Comment.find({ postId })
      .select('_id postId userId text parentCommentId isFromGemini likes createdAt updatedAt')
      .populate('userId', 'name avatar')
      .lean()
      .limit(3);
    populatedComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Populated Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment));
    });
    
    res.json({
      success: true,
      message: 'ROOT CAUSE test tamamlandı - console log\'ları kontrol et',
      data: {
        postId,
        testResults: {
          rawData: rawComments.length,
          selectedData: selectedComments.length,
          leanData: leanComments.length,
          populatedData: populatedComments.length
        },
        fieldAnalysis: {
          rawParentCommentId: rawComments.map(c => c.parentCommentId),
          selectedParentCommentId: selectedComments.map(c => c.parentCommentId),
          leanParentCommentId: leanComments.map(c => c.parentCommentId),
          populatedParentCommentId: populatedComments.map(c => c.parentCommentId)
        }
      }
    });
    
  } catch (error) {
    console.error('ROOT CAUSE Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// YENİ: GERÇEK SORUN Test Endpoint'i - parentCommentId field'ının nerede kaybolduğunu bulmak için
app.get('/api/gercek-sorun-test/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const Comment = require('./models/Comment');
    
    console.log('🔍 GERÇEK SORUN TEST BAŞLADI - postId:', postId);
    
    // 1. Normal comment get (select ve lean olmadan)
    console.log('📊 1. Normal comment get testi (select ve lean olmadan):');
    const normalComments = await Comment.find({ postId, parentCommentId: null })
      .populate('userId', 'name avatar')
      .limit(3);
    
    normalComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Normal Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment.toObject()));
    });
    
    // 2. toObject() sonrası kontrol
    console.log('📊 2. toObject() sonrası testi:');
    const toObjectComments = normalComments.map(comment => comment.toObject());
    toObjectComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. toObject Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment));
    });
    
    // 3. Response hazırlama testi
    console.log('📊 3. Response hazırlama testi:');
    const responseComments = normalComments.map(comment => {
      const commentObj = comment.toObject();
      const replies = []; // Simüle edilmiş replies
      return { ...commentObj, replies };
    });
    
    responseComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. Response Comment ${comment._id}:`);
      console.log(`     parentCommentId: ${comment.parentCommentId}`);
      console.log(`     Tüm field'lar:`, Object.keys(comment));
    });
    
    res.json({
      success: true,
      message: 'GERÇEK SORUN test tamamlandı - console log\'ları kontrol et',
      data: {
        postId,
        testResults: {
          normalData: normalComments.length,
          toObjectData: toObjectComments.length,
          responseData: responseComments.length
        },
        fieldAnalysis: {
          normalParentCommentId: normalComments.map(c => c.parentCommentId),
          toObjectParentCommentId: toObjectComments.map(c => c.parentCommentId),
          responseParentCommentId: responseComments.map(c => c.parentCommentId)
        },
        finalCheck: {
          hasParentCommentId: responseComments.every(c => c.parentCommentId !== undefined),
          parentCommentIdValues: responseComments.map(c => c.parentCommentId)
        }
      }
    });
    
  } catch (error) {
    console.error('GERÇEK SORUN Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SEARCH ENDPOINT'LERİ - Yeni eklenen

// GET /api/search/users - Kullanıcı arama
app.get('/api/search/users', async (req, res) => {
  try {
    const { q, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi gerekli'
      });
    }

    const searchQuery = q.trim();
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const User = require('./models/User');
    
    // Gelişmiş kullanıcı arama
    const query = {
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    };

    const users = await User.find(query)
      .select('_id name avatar xp level followersCount followingCount createdAt')
      .limit(limitNumber)
      .skip(skip)
      .sort({ name: 1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalUsers: total,
          hasNextPage: skip + limitNumber < total,
          hasPrevPage: pageNumber > 1
        },
        filters: {
          query: searchQuery
        }
      }
    });
    
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      error: 'Kullanıcı arama sırasında hata oluştu'
    });
  }
});

// GET /api/search/tags - Etiket arama
app.get('/api/search/tags', async (req, res) => {
  try {
    const { q, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi gerekli'
      });
    }

    const searchQuery = q.trim();
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const Post = require('./models/Post');
    
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
    console.error('Tag search error:', error);
    res.status(500).json({
      success: false,
      error: 'Etiket arama sırasında hata oluştu'
    });
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment check completed');
  console.log('Frontend URL: http://localhost:3000');
  console.log('Performance optimizations applied');
});

let requestCount = 0;
let startTime = Date.now();

app.use((req, res, next) => {
  requestCount++;
  const requestStart = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - requestStart;
    if (duration > 1000) {
      console.log(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});

setInterval(() => {
  const uptime = Date.now() - startTime;
  console.log(`Performance Stats: ${requestCount} requests in ${Math.round(uptime/1000)}s`);
}, 600000);



process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
