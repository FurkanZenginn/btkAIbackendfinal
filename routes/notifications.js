const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
} = require('../controllers/notificationController');

// GET /api/notifications - Kullanıcının bildirimlerini getir
router.get('/', protect, getNotifications);

// PUT /api/notifications/:id/read - Bildirimi okundu olarak işaretle
router.put('/:id/read', protect, markNotificationAsRead);

// PUT /api/notifications/read-all - Tüm bildirimleri okundu olarak işaretle
router.put('/read-all', protect, markAllNotificationsAsRead);

// GET /api/notifications/unread-count - Okunmamış bildirim sayısı
router.get('/unread-count', protect, getUnreadCount);

module.exports = router; 