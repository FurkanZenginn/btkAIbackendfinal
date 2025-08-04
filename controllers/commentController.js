const Comment = require('../models/Comment');
const Post = require('../models/Post');

const { addPoints } = require('../services/gamificationService');

// GET /api/comments/:postId - Post'un yorumlarını getir
const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ 
      postId, 
      parentCommentId: null // Sadece ana yorumlar
    })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Her yorum için alt yorumları getir
    for (let comment of comments) {
      const replies = await Comment.find({ parentCommentId: comment._id })
        .populate('userId', 'name avatar')
        .sort({ createdAt: 1 })
        .limit(5); // En fazla 5 alt yorum
      
      comment = comment.toObject();
      comment.replies = replies;
    }

    const total = await Comment.countDocuments({ postId, parentCommentId: null });

    res.json({
      success: true,
      data: {
        comments,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Yorum getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Yorumlar getirilirken hata oluştu' 
    });
  }
};

// POST /api/comments/:postId - Yeni yorum ekle
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text, parentCommentId } = req.body;
    const userId = req.user._id;

    // Post'un var olduğunu kontrol et
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post bulunamadı' });
    }

    // Yorum oluştur
    const comment = new Comment({
      postId,
      userId,
      text,
      parentCommentId: parentCommentId || null
    });

    await comment.save();

    // Post'un yorum sayısını güncelle
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentCount: 1 }
    });

    // Populate ile kullanıcı bilgilerini ekle
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name avatar');

    // Gamification - puan ekle
    const gamificationResult = await addPoints(
      userId,
      'comment_added',
      'Yeni yorum ekledin!',
      { postId, commentId: comment._id }
    );



    res.status(201).json({
      message: 'Yorum başarıyla eklendi',
      comment: populatedComment,
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('Yorum oluşturma hatası:', error);
    res.status(500).json({ error: 'Yorum oluşturulurken hata oluştu' });
  }
};

// PUT /api/comments/:id/like - Yorum beğen/beğenme
const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    const userId = req.user._id;

    if (!comment) {
      return res.status(404).json({ error: 'Yorum bulunamadı' });
    }

    const likeIndex = comment.likes.indexOf(userId);
    
    if (likeIndex > -1) {
      // Beğeniyi kaldır
      comment.likes.splice(likeIndex, 1);
    } else {
      // Beğen
      comment.likes.push(userId);
    }

    await comment.save();

    res.json({ 
      message: likeIndex > -1 ? 'Beğeni kaldırıldı' : 'Beğenildi',
      likes: comment.likes.length
    });

  } catch (error) {
    console.error('Yorum beğeni hatası:', error);
    res.status(500).json({ error: 'Beğeni işlemi sırasında hata oluştu' });
  }
};

// DELETE /api/comments/:id - Yorum sil
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ error: 'Yorum bulunamadı' });
    }

    // Sadece yorum sahibi veya admin silebilir
    if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Alt yorumları da sil
    await Comment.deleteMany({ parentCommentId: comment._id });
    await comment.deleteOne();

    // Post'un yorum sayısını güncelle
    await Post.findByIdAndUpdate(comment.postId, {
      $inc: { commentCount: -1 }
    });

    res.json({ message: 'Yorum başarıyla silindi' });

  } catch (error) {
    console.error('Yorum silme hatası:', error);
    res.status(500).json({ error: 'Yorum silinirken hata oluştu' });
  }
};

// GET /api/comments?postId=:postId - Query parameter ile yorumları getir
const getCommentsByQuery = async (req, res) => {
  try {
    const { postId, page = 1, limit = 20 } = req.query;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId parametresi gerekli' });
    }

    const skip = (page - 1) * limit;

    const comments = await Comment.find({ 
      postId, 
      parentCommentId: null // Sadece ana yorumlar
    })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Her yorum için alt yorumları getir
    for (let comment of comments) {
      const replies = await Comment.find({ parentCommentId: comment._id })
        .populate('userId', 'name avatar')
        .sort({ createdAt: 1 })
        .limit(5); // En fazla 5 alt yorum
      
      comment = comment.toObject();
      comment.replies = replies;
    }

    const total = await Comment.countDocuments({ postId, parentCommentId: null });

    res.json({
      success: true,
      data: {
        comments,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Yorum getirme hatası (query):', error);
    res.status(500).json({ 
      success: false,
      error: 'Yorumlar getirilirken hata oluştu' 
    });
  }
};

module.exports = {
  getComments,
  getCommentsByQuery,
  createComment,
  toggleCommentLike,
  deleteComment
}; 