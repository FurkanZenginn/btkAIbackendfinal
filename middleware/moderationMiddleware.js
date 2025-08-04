const {
  moderateText,
  moderateImage,
  checkSpam,
  simpleTextChecks
} = require('../services/moderationService');

// Rate limiting için basit cache
const userActivityCache = new Map();

// Rate limit kontrolü
const checkRateLimit = (userId, action, limit = 5, windowMs = 60000) => {
  const now = Date.now();
  const key = `${userId}_${action}`;
  
  if (!userActivityCache.has(key)) {
    userActivityCache.set(key, []);
  }
  
  const activities = userActivityCache.get(key);
  
  // Eski aktiviteleri temizle
  const recentActivities = activities.filter(time => now - time < windowMs);
  userActivityCache.set(key, recentActivities);
  
  if (recentActivities.length >= limit) {
    return false; // Rate limit aşıldı
  }
  
  recentActivities.push(now);
  return true; // Rate limit aşılmadı
};

// Metin moderasyonu middleware
const moderateTextContent = async (req, res, next) => {
  try {
    // req.body undefined olabilir, kontrol et
    if (!req.body) {
      return next();
    }
    
    const { caption, text } = req.body;
    const content = caption || text;
    
    if (!content) {
      return next();
    }

    // Basit kontroller önce
    const simpleChecks = simpleTextChecks(content);
    if (simpleChecks.hasIssues) {
      return res.status(400).json({
        error: 'İçerik moderasyon kurallarına uymuyor',
        details: simpleChecks.issues,
        reason: simpleChecks.isSpam ? 'Spam içerik tespit edildi' : 
                simpleChecks.isFlood ? 'Flood davranışı tespit edildi' : 
                'İçerik standartlarına uymuyor',
        suggestions: [
          'Daha açıklayıcı bir metin yazın',
          'Spam kelimeler kullanmayın',
          'Aşırı kısa veya uzun metinlerden kaçının'
        ]
      });
    }

    // Rate limit kontrolü
    const userId = req.user?._id || req.ip;
    if (!checkRateLimit(userId, 'text_moderation', 10, 60000)) {
      return res.status(429).json({
        error: 'Çok fazla içerik gönderiyorsunuz. Lütfen bekleyin.'
      });
    }

    // Gemini ile moderasyon
    const moderationResult = await moderateText(content, req.originalUrl.includes('post') ? 'post' : 'comment');
    
    // Düzeltme gerekiyorsa kullanıcıya öneri ver
    if (moderationResult.needsCorrection) {
      return res.status(400).json({
        error: 'İçeriğinizi düzeltmeniz gerekiyor',
        reason: moderationResult.reason,
        suggestions: moderationResult.suggestions,
        correctedText: moderationResult.correctedText,
        needsCorrection: true,
        message: 'Lütfen önerilen düzeltmeleri yaparak tekrar deneyin'
      });
    }
    
    // Gerçekten uygunsuzsa reddet
    if (!moderationResult.isAppropriate) {
      return res.status(400).json({
        error: 'İçerik uygun değil',
        reason: moderationResult.reason,
        suggestions: moderationResult.suggestions
      });
    }

    // Spam kontrolü
    const spamCheck = await checkSpam(userId, 'text', content);
    if (spamCheck.isSpam || spamCheck.hasFloodRisk) {
      return res.status(400).json({
        error: 'Spam/flood içerik tespit edildi',
        reason: spamCheck.reason,
        suggestions: [
          'Daha orijinal içerik paylaşın',
          'Tekrarlayan mesajlar göndermeyin',
          'Daha açıklayıcı metinler yazın'
        ]
      });
    }

    // Moderasyon sonuçlarını request'e ekle
    req.moderationResult = {
      isApproved: true,
      safetyLevel: moderationResult.safetyLevel,
      reason: moderationResult.reason
    };

    next();

  } catch (error) {
    console.error('Metin moderasyon middleware hatası:', error);
    // Hata durumunda güvenli geçiş
    req.moderationResult = {
      isApproved: true,
      safetyLevel: 'düşük',
      reason: 'Moderasyon sistemi geçici olarak kullanılamıyor'
    };
    next();
  }
};

// Görsel moderasyonu middleware
const moderateImageContent = async (req, res, next) => {
  try {
    // req.body undefined olabilir, kontrol et
    if (!req.body) {
      return next();
    }
    
    const { imageURL, caption } = req.body;
    
    if (!imageURL) {
      return next();
    }

    // Rate limit kontrolü
    const userId = req.user?._id || req.ip;
    if (!checkRateLimit(userId, 'image_moderation', 5, 60000)) {
      return res.status(429).json({
        error: 'Çok fazla görsel gönderiyorsunuz. Lütfen bekleyin.'
      });
    }

    // Gemini ile görsel moderasyonu
    const moderationResult = await moderateImage(imageURL, caption || '');
    
    // Düzeltme gerekiyorsa kullanıcıya öneri ver
    if (moderationResult.needsCorrection) {
      return res.status(400).json({
        error: 'Görselinizi değiştirmeniz gerekiyor',
        reason: moderationResult.reason,
        suggestions: moderationResult.suggestions,
        alternativeSuggestions: moderationResult.alternativeSuggestions,
        needsCorrection: true,
        message: 'Lütfen önerilen değişiklikleri yaparak tekrar deneyin'
      });
    }
    
    // Gerçekten uygunsuzsa reddet
    if (!moderationResult.isAppropriate) {
      return res.status(400).json({
        error: 'Görsel uygun değil',
        reason: moderationResult.reason,
        suggestions: moderationResult.suggestions,
        alternativeSuggestions: moderationResult.alternativeSuggestions
      });
    }

    // Moderasyon sonuçlarını request'e ekle
    req.imageModerationResult = {
      isApproved: true,
      safetyLevel: moderationResult.safetyLevel,
      contentType: moderationResult.contentType,
      reason: moderationResult.reason
    };

    next();

  } catch (error) {
    console.error('Görsel moderasyon middleware hatası:', error);
    // Hata durumunda güvenli geçiş
    req.imageModerationResult = {
      isApproved: true,
      safetyLevel: 'düşük',
      contentType: 'eğitimsel',
      reason: 'Moderasyon sistemi geçici olarak kullanılamıyor'
    };
    next();
  }
};

// Kullanıcı davranış kontrolü middleware
const checkUserBehavior = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return next();
    }

    // Son aktiviteleri kontrol et (basit implementasyon)
    const recentActivity = {
      lastAction: new Date(),
      actionType: req.method + ' ' + req.originalUrl,
      userAgent: req.get('User-Agent')
    };

    // Rate limit kontrolü
    if (!checkRateLimit(userId, 'general', 20, 60000)) {
      return res.status(429).json({
        error: 'Çok fazla istek gönderiyorsunuz. Lütfen bekleyin.'
      });
    }

    // Davranış analizi (opsiyonel, performans için)
    if (req.originalUrl.includes('post') || req.originalUrl.includes('comment')) {
      const behaviorResult = await analyzeUserBehavior(userId, recentActivity);
      
      if (behaviorResult.isSuspicious) {
        return res.status(403).json({
          error: 'Şüpheli davranış tespit edildi',
          reason: behaviorResult.reason,
          suggestions: behaviorResult.suggestions
        });
      }
    }

    next();

  } catch (error) {
    console.error('Kullanıcı davranış kontrolü hatası:', error);
    next(); // Hata durumunda geçiş izni ver
  }
};

module.exports = {
  moderateTextContent,
  moderateImageContent,
  checkUserBehavior,
  checkRateLimit
}; 