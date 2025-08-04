const { optimizePrompt, getMentorResponse, getStepByStepGuidance, getDirectSolution, analyzeImage, getFastAIResponse } = require('../services/geminiService');

const Post = require('../models/Post');
const { addPoints } = require('../services/gamificationService');

// POST /api/ai/question - AI ile soru sor (eski versiyon - geriye uyumluluk için)
const askAI = async (req, res) => {
  try {
    const { prompt, postId, imageURL } = req.body;
    const userId = req.user._id;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt (soru) boş olamaz.' });
    }

    // 1. Prompt'u iyileştir
    const optimizedPrompt = await optimizePrompt(prompt, imageURL);

    // 2. Mentor AI yanıtı al
    const aiResponse = await getMentorResponse(optimizedPrompt, imageURL);

    // 3. Post'a AI yanıtını kaydet (eğer postId varsa)
    if (postId) {
      await Post.findByIdAndUpdate(postId, {
        aiResponse: aiResponse
      });


    }

    // Gamification - AI kullanımı için puan ekle
    const gamificationResult = await addPoints(
      userId,
      'ai_used',
      'AI ile etkileşim kurdun!',
      { postId, prompt, hasImage: !!imageURL }
    );

    // 4. Sonucu dön
    res.json({
      originalPrompt: prompt,
      optimizedPrompt,
      aiResponse,
      postId: postId || null,
      hasImage: !!imageURL,
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('AI hata:', error);
    
    // Kullanıcı dostu hata mesajları
    let errorMessage = 'AI işleminde hata oluştu.';
    
    if (error.message.includes('API anahtarı')) {
      errorMessage = 'AI servisi konfigürasyon hatası. Lütfen sistem yöneticisi ile iletişime geçin.';
    } else if (error.message.includes('bağlanılamıyor')) {
      errorMessage = 'AI servisine bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
    } else if (error.message.includes('yoğun')) {
      errorMessage = 'AI servisi şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.';
    } else if (error.message.includes('kullanılamıyor')) {
      errorMessage = 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
};

// POST /api/ai/ask-with-options - Yeni AI soru endpoint'i (iki seçenekli) - HIZLI VERSİYON
const askAIWithOptions = async (req, res) => {
  try {
    const { prompt, responseType, postId, imageURL } = req.body;
    const userId = req.user._id;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt (soru) boş olamaz.' });
    }

    if (!responseType || !['step-by-step', 'direct-solution'].includes(responseType)) {
      return res.status(400).json({ error: 'Geçerli bir responseType belirtilmelidir (step-by-step veya direct-solution).' });
    }

    // HIZLI AI YANITI - Tek API çağrısı
    const aiResponse = await getFastAIResponse(prompt, responseType, imageURL);
    const responseTypeText = responseType === 'step-by-step' ? 'Adım Adım Rehberlik' : 'Direkt Çözüm';

    // Post'a AI yanıtını kaydet (eğer postId varsa)
    if (postId) {
      await Post.findByIdAndUpdate(postId, {
        aiResponse: aiResponse,
        aiResponseType: responseType
      });


    }

    // Gamification - AI kullanımı için puan ekle
    const gamificationResult = await addPoints(
      userId,
      'ai_used',
      `AI ile ${responseTypeText} aldın!`,
      { postId, prompt, responseType, hasImage: !!imageURL }
    );

    // Sonucu dön
    res.json({
      originalPrompt: prompt,
      aiResponse,
      responseType: responseType,
      responseTypeText: responseTypeText,
      postId: postId || null,
      hasImage: !!imageURL,
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('AI hata:', error);
    
    // Kullanıcı dostu hata mesajları
    let errorMessage = 'AI işleminde hata oluştu.';
    
    if (error.message.includes('API anahtarı')) {
      errorMessage = 'AI servisi konfigürasyon hatası. Lütfen sistem yöneticisi ile iletişime geçin.';
    } else if (error.message.includes('bağlanılamıyor')) {
      errorMessage = 'AI servisine bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
    } else if (error.message.includes('yoğun')) {
      errorMessage = 'AI servisi şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.';
    } else if (error.message.includes('kullanılamıyor')) {
      errorMessage = 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
};

// POST /api/ai/analyze-image - Sadece görsel analizi
const analyzeImageOnly = async (req, res) => {
  try {
    const { imageURL, analysisType = 'general' } = req.body;
    const userId = req.user._id;

    if (!imageURL) {
      return res.status(400).json({ error: 'Görsel URL\'si gereklidir.' });
    }

    // Görsel analizi yap
    const analysis = await analyzeImage(imageURL, analysisType);

    // Gamification - Görsel analizi için puan ekle
    const gamificationResult = await addPoints(
      userId,
      'image_analyzed',
      'Görsel analizi yaptın!',
      { analysisType }
    );

    res.json({
      imageURL,
      analysisType,
      analysis,
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('Görsel analizi hatası:', error);
    res.status(500).json({ error: 'Görsel analizi sırasında hata oluştu.' });
  }
};

// POST /api/ai/analyze-post - Post analizi ve konu etiketleme
const analyzePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { caption, imageURL } = req.body;

    // Post'u bul
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post bulunamadı' });
    }

    // AI ile konu analizi yap
    const analysisPrompt = `
    Bu öğrenci sorusunu analiz et ve konu etiketlerini belirle:
    
    Soru: ${caption || post.caption}
    Görsel: ${imageURL || post.imageURL}
    
    Lütfen şu formatta yanıtla:
    - Konu: [ana konu]
    - Alt Konular: [alt konular virgülle ayrılmış]
    - Zorluk Seviyesi: [kolay/orta/zor]
    - Önerilen Etiketler: [etiketler virgülle ayrılmış]
    `;

    const analysis = await getMentorResponse(analysisPrompt);

    // Post'u güncelle
    const topicTags = analysis.match(/Önerilen Etiketler: (.+)/)?.[1]?.split(',').map(tag => tag.trim()) || [];
    const difficulty = analysis.match(/Zorluk Seviyesi: (.+)/)?.[1] || 'orta';

    await Post.findByIdAndUpdate(postId, {
      topicTags,
      difficulty,
      isModerated: true
    });

    res.json({
      analysis,
      topicTags,
      difficulty,
      message: 'Post analizi tamamlandı'
    });

  } catch (error) {
    console.error('Post analizi hatası:', error);
    res.status(500).json({ error: 'Post analizi sırasında hata oluştu' });
  }
};

// POST /api/ai/hap-bilgi - Konu bazlı hap bilgi önerisi
const getHapBilgi = async (req, res) => {
  try {
    const { topic, difficulty = 'orta' } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Konu belirtilmelidir' });
    }

    // Hap bilgi service'ini kullan
    const { findMatchingHapBilgi, generateHapBilgiWithAI } = require('../services/hapBilgiService');
    const HapBilgi = require('../models/HapBilgi');

    // Önce mevcut hap bilgilerde ara
    let hapBilgi = await findMatchingHapBilgi(topic, difficulty);

    // Eğer bulunamazsa AI ile oluştur
    if (!hapBilgi) {
      const aiGenerated = await generateHapBilgiWithAI(topic, difficulty);
      
      if (aiGenerated) {
        hapBilgi = new HapBilgi({
          ...aiGenerated,
          createdBy: req.user?._id
        });
        await hapBilgi.save();
      }
    }

    if (!hapBilgi) {
      return res.status(404).json({ 
        error: 'Bu konuyla ilgili hap bilgi bulunamadı' 
      });
    }

    res.json({
      topic,
      hapBilgi,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Hap bilgi hatası:', error);
    res.status(500).json({ error: 'Hap bilgi alınırken hata oluştu' });
  }
};

// POST /api/ai/user-analysis - Kullanıcı ilgi alanı analizi
const analyzeUserInterests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { recentPosts, recentComments } = req.body;

    // Kullanıcının son aktivitelerini analiz et
    const analysisPrompt = `
    Bu kullanıcının son aktivitelerini analiz et ve ilgi alanlarını belirle:
    
    Son Postlar: ${recentPosts?.join(', ') || 'Yok'}
    Son Yorumlar: ${recentComments?.join(', ') || 'Yok'}
    
    Lütfen şu formatta yanıtla:
    - İlgi Alanları: [konular virgülle ayrılmış]
    - Güçlü Konular: [güçlü olduğu alanlar]
    - Geliştirilmesi Gereken: [zayıf alanlar]
    - Öneriler: [öneriler]
    `;

    const analysis = await getMentorResponse(analysisPrompt);

    // İlgi alanlarını çıkar
    const interests = analysis.match(/İlgi Alanları: (.+)/)?.[1]?.split(',').map(topic => topic.trim()) || [];

    res.json({
      analysis,
      interests,
      message: 'Kullanıcı analizi tamamlandı'
    });

  } catch (error) {
    console.error('Kullanıcı analizi hatası:', error);
    res.status(500).json({ error: 'Kullanıcı analizi sırasında hata oluştu' });
  }
};

module.exports = {
  askAI,
  askAIWithOptions,
  analyzePost,
  getHapBilgi,
  analyzeUserInterests,
  analyzeImageOnly
}; 