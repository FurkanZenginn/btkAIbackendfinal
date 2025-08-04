const {
  getUserNotifications,
  markAsRead,
  markAllAsRead
} = require('../services/notificationService');

// GET /api/notifications - Kullanıcının bildirimlerini getir
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications(userId, page, limit);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Bildirim getirme hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Bildirimler alınırken hata oluştu' 
    });
  }
};

// PUT /api/notifications/:id/read - Bildirimi okundu olarak işaretle
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await markAsRead(id, userId);

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        error: 'Bildirim bulunamadı' 
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Bildirim okuma hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Bildirim okunurken hata oluştu' 
    });
  }
};

// PUT /api/notifications/read-all - Tüm bildirimleri okundu olarak işaretle
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Tüm bildirimler okundu olarak işaretlendi'
    });

  } catch (error) {
    console.error('Tüm bildirimleri okuma hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Bildirimler okunurken hata oluştu' 
    });
  }
};

// GET /api/notifications/unread-count - Okunmamış bildirim sayısı
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications(userId, page, limit);

    res.json({
      success: true,
      data: {
        unreadCount: result.unreadCount
      }
    });

  } catch (error) {
    console.error('Okunmamış bildirim sayısı hatası:', error);
    res.status(500).json({ 
      success: false,
      error: 'Okunmamış bildirim sayısı alınırken hata oluştu' 
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
}; 