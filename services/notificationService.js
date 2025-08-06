const Notification = require('../models/Notification');


// Bildirim oluştur ve gönder
const createNotification = async (data) => {
  try {
    const {
      recipientId,
      senderId,
      type,
      title,
      message,
      relatedPost,
      relatedComment,
      metadata = {}
    } = data;

    // Bildirim oluştur
    const notification = new Notification({
      recipientId,
      senderId,
      type,
      title,
      message,
      relatedPost,
      relatedComment,
      metadata
    });

    await notification.save();



    return notification;

  } catch (error) {
    console.error('Bildirim oluşturma hatası:', error);
    throw error;
  }
};

// Yorum bildirimi
const notifyComment = async (postId, commentId, senderId, recipientId) => {
  const notification = await createNotification({
    recipientId,
    senderId,
    type: 'comment',
    title: 'Yeni Yorum',
    message: 'Postuna yeni bir yorum geldi!',
    relatedPost: postId,
    relatedComment: commentId
  });

  return notification;
};

// Beğeni bildirimi
const notifyLike = async (postId, senderId, recipientId, isPost = true) => {
  const notification = await createNotification({
    recipientId,
    senderId,
    type: 'like',
    title: 'Yeni Beğeni',
    message: isPost ? 'Postunu beğendi!' : 'Yorumunu beğendi!',
    relatedPost: isPost ? postId : null,
    relatedComment: !isPost ? postId : null
  });

  return notification;
};

// AI yanıt bildirimi
const notifyAIResponse = async (postId, recipientId) => {
  const notification = await createNotification({
    recipientId,
    type: 'ai_response',
    title: 'AI Yanıtı',
    message: 'AI soruna yanıt verdi!',
    relatedPost: postId
  });

  return notification;
};

// Rozet kazanma bildirimi
const notifyBadgeEarned = async (recipientId, badgeName) => {
  const notification = await createNotification({
    recipientId,
    type: 'badge_earned',
    title: 'Yeni Rozet!',
    message: `"${badgeName}" rozetini kazandın!`,
    metadata: { badgeName }
  });

  return notification;
};

// Seviye atlama bildirimi
const notifyLevelUp = async (recipientId, newLevel) => {
  const notification = await createNotification({
    recipientId,
    type: 'level_up',
    title: 'Seviye Atladın!',
    message: `Seviye ${newLevel}'e yükseldin!`,
    metadata: { newLevel }
  });

  return notification;
};

// Mention bildirimi
const notifyMention = async (postId, commentId, senderId, recipientId) => {
  const notification = await createNotification({
    recipientId,
    senderId,
    type: 'mention',
    title: 'Seni Etiketledi',
    message: 'Bir yorumda seni etiketledi!',
    relatedPost: postId,
    relatedComment: commentId
  });

  return notification;
};

// Follow bildirimi
const notifyFollow = async (senderId, recipientId) => {
  const notification = await createNotification({
    recipientId,
    senderId,
    type: 'follow',
    title: 'Yeni Takipçi',
    message: 'Seni takip etmeye başladı!',
    metadata: { action: 'follow' }
  });

  return notification;
};

// Unfollow bildirimi (opsiyonel - genelde gönderilmez)
const notifyUnfollow = async (senderId, recipientId) => {
  const notification = await createNotification({
    recipientId,
    senderId,
    type: 'unfollow',
    title: 'Takipçi Kaybı',
    message: 'Seni takip etmeyi bıraktı',
    metadata: { action: 'unfollow' }
  });

  return notification;
};

// Kullanıcının bildirimlerini getir
const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipientId: userId })
      .populate('senderId', 'name avatar')
      .populate('relatedPost', 'caption')
      .populate('relatedComment', 'text')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ recipientId: userId });
    const unreadCount = await Notification.countDocuments({ 
      recipientId: userId, 
      isRead: false 
    });

    return {
      notifications,
      total,
      unreadCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit)
    };

  } catch (error) {
    console.error('Bildirim getirme hatası:', error);
    throw error;
  }
};

// Bildirimi okundu olarak işaretle
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { isRead: true },
      { new: true }
    );

    return notification;

  } catch (error) {
    console.error('Bildirim okuma hatası:', error);
    throw error;
  }
};

// Tüm bildirimleri okundu olarak işaretle
const markAllAsRead = async (userId) => {
  try {
    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true }
    );

    return { success: true };

  } catch (error) {
    console.error('Tüm bildirimleri okuma hatası:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  notifyComment,
  notifyLike,
  notifyAIResponse,
  notifyBadgeEarned,
  notifyLevelUp,
  notifyMention,
  notifyFollow,
  notifyUnfollow,
  getUserNotifications,
  markAsRead,
  markAllAsRead
}; 