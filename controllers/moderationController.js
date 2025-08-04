const {
  moderateText,
  moderateImage,
  checkSpam
} = require('../services/moderationService');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');

// POST /api/moderation/check-text - Metin moderasyonu
const checkTextModeration = async (req, res) => {
  try {
    const { text, contentType = 'post' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Metin gerekli'
      });
    }

    const result = await moderateText(text, contentType);

    res.json({
      success: true,
      data: {
        isAppropriate: result.isAppropriate,
        needsCorrection: result.needsCorrection,
        safetyLevel: result.safetyLevel,
        reason: result.reason,
        suggestions: result.suggestions,
        correctedText: result.correctedText,
        message: result.needsCorrection ? 
          'İçeriğinizi düzeltmeniz gerekiyor' : 
          result.isAppropriate ? 'İçerik uygun' : 'İçerik uygun değil'
      }
    });

  } catch (error) {
    console.error('Metin moderasyon kontrolü hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Moderasyon kontrolü sırasında hata oluştu'
    });
  }
};

// POST /api/moderation/check-image - Görsel moderasyonu
const checkImageModeration = async (req, res) => {
  try {
    const { imageURL, description = '' } = req.body;

    if (!imageURL) {
      return res.status(400).json({
        success: false,
        error: 'Görsel URL gerekli'
      });
    }

    const result = await moderateImage(imageURL, description);

    res.json({
      success: true,
      data: {
        isAppropriate: result.isAppropriate,
        needsCorrection: result.needsCorrection,
        safetyLevel: result.safetyLevel,
        contentType: result.contentType,
        reason: result.reason,
        suggestions: result.suggestions,
        alternativeSuggestions: result.alternativeSuggestions,
        message: result.needsCorrection ? 
          'Görselinizi değiştirmeniz gerekiyor' : 
          result.isAppropriate ? 'Görsel uygun' : 'Görsel uygun değil'
      }
    });

  } catch (error) {
    console.error('Görsel moderasyon kontrolü hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Moderasyon kontrolü sırasında hata oluştu'
    });
  }
};

// POST /api/moderation/check-spam - Spam kontrolü
const checkSpamContent = async (req, res) => {
  try {
    const { content, contentType = 'post' } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'İçerik gerekli'
      });
    }

    const result = await checkSpam(userId, contentType, content);

    res.json({
      success: true,
      data: {
        isSpam: result.isSpam,
        hasFloodRisk: result.hasFloodRisk,
        spamLevel: result.spamLevel,
        reason: result.reason
      }
    });

  } catch (error) {
    console.error('Spam kontrolü hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Spam kontrolü sırasında hata oluştu'
    });
  }
};

// PUT /api/moderation/flag-content/:type/:id - İçerik işaretle
const flagContent = async (req, res) => {
  try {
    const { type, id } = req.params;
    const userId = req.user._id;
    const { reason, details } = req.body;

    if (!['post', 'comment'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz içerik türü'
      });
    }

    let content;
    if (type === 'post') {
      content = await Post.findById(id);
    } else if (type === 'comment') {
      content = await Comment.findById(id);
    }

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'İçerik bulunamadı'
      });
    }

    // Kendi içeriğini işaretleyemez
    if (content.userId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Kendi içeriğinizi işaretleyemezsiniz'
      });
    }

    // İçeriği işaretle
    content.flaggedBy = userId;
    content.flaggedAt = new Date();
    content.flaggedReason = reason || 'Kullanıcı tarafından işaretlendi';
    content.flagDetails = details || '';

    await content.save();

    res.json({
      success: true,
      message: 'İçerik başarıyla işaretlendi',
      data: {
        flaggedAt: content.flaggedAt,
        reason: content.flaggedReason
      }
    });

  } catch (error) {
    console.error('İçerik işaretleme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'İçerik işaretlenirken hata oluştu'
    });
  }
};

module.exports = {
  checkTextModeration,
  checkImageModeration,
  checkSpamContent,
  flagContent
}; 