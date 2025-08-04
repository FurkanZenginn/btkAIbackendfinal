const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getComments,
  getCommentsByQuery,
  createComment,
  toggleCommentLike,
  deleteComment
} = require('../controllers/commentController');

// GET /api/comments/:postId - Post'un yorumlarını getir
router.get('/:postId', getComments);

// GET /api/comments - Query parameter ile yorumları getir (frontend uyumluluğu için)
router.get('/', getCommentsByQuery);

// POST /api/comments/:postId - Yeni yorum ekle
router.post('/:postId', protect, createComment);

// PUT /api/comments/:id/like - Yorum beğen/beğenme
router.put('/:id/like', protect, toggleCommentLike);

// DELETE /api/comments/:id - Yorum sil
router.delete('/:id', protect, deleteComment);

module.exports = router; 