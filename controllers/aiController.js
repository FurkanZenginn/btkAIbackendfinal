const { optimizePrompt, getMentorResponse, analyzeImage, getFastAIResponse } = require('../services/geminiService');

const Post = require('../models/Post');
const { addPoints } = require('../services/gamificationService');
const mongoose = require('mongoose');
const axios = require('axios');

// Test endpoint'leri
const testSystemStatus = async (req, res) => {
  try {
    console.log('🔍 System Status Test başlatılıyor...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // 1. MongoDB Atlas Cluster Durumu Test
    try {
      console.log('📊 MongoDB Atlas Cluster durumu kontrol ediliyor...');
      const dbStatus = mongoose.connection.readyState;
      
      if (dbStatus === 1) {
        results.tests.mongodb = {
          status: '✅ BAŞARILI',
          message: 'MongoDB Atlas bağlantısı aktif',
          details: {
            readyState: dbStatus,
            host: mongoose.connection.host,
            name: mongoose.connection.name
          }
        };
        console.log('✅ MongoDB Atlas: BAŞARILI');
      } else {
        results.tests.mongodb = {
          status: '❌ BAŞARISIZ',
          message: 'MongoDB Atlas bağlantısı yok',
          details: {
            readyState: dbStatus,
            error: 'Bağlantı durumu: ' + dbStatus
          }
        };
        console.log('❌ MongoDB Atlas: BAŞARISIZ');
      }
    } catch (error) {
      results.tests.mongodb = {
        status: '❌ HATA',
        message: 'MongoDB Atlas test hatası',
        error: error.message
      };
      console.log('❌ MongoDB Atlas Test Hatası:', error.message);
    }

    // 2. Gemini API Key Geçerliliği Test
    try {
      console.log('🔑 Gemini API Key geçerliliği kontrol ediliyor...');
      const API_KEY = process.env.GEMINI_API_KEY;
      
      if (!API_KEY) {
        results.tests.geminiApi = {
          status: '❌ HATA',
          message: 'Gemini API Key bulunamadı',
          error: 'GEMINI_API_KEY environment variable tanımlı değil'
        };
        console.log('❌ Gemini API Key: BULUNAMADI');
      } else {
        // Basit API test çağrısı
        const testResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
          {
            contents: [{
              parts: [{
                text: "Merhaba, bu bir test mesajıdır."
              }]
            }]
          },
          {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (testResponse.data && testResponse.data.candidates) {
          results.tests.geminiApi = {
            status: '✅ BAŞARILI',
            message: 'Gemini API Key geçerli ve çalışıyor',
            details: {
              model: 'gemini-2.5-flash',
              responseReceived: true
            }
          };
          console.log('✅ Gemini API Key: BAŞARILI');
        } else {
          results.tests.geminiApi = {
            status: '⚠️ UYARI',
            message: 'Gemini API yanıt verdi ama beklenen format değil',
            details: {
              response: testResponse.data
            }
          };
          console.log('⚠️ Gemini API Key: UYARI');
        }
      }
    } catch (error) {
      if (error.response?.status === 400) {
        results.tests.geminiApi = {
          status: '❌ HATA',
          message: 'Gemini API Key geçersiz',
          error: 'API Key doğrulama hatası (400)'
        };
        console.log('❌ Gemini API Key: GEÇERSİZ');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        results.tests.geminiApi = {
          status: '❌ HATA',
          message: 'Gemini API\'ye bağlanılamıyor',
          error: 'Network bağlantı hatası'
        };
        console.log('❌ Gemini API: BAĞLANTI HATASI');
      } else {
        results.tests.geminiApi = {
          status: '❌ HATA',
          message: 'Gemini API test hatası',
          error: error.message
        };
        console.log('❌ Gemini API Test Hatası:', error.message);
      }
    }

    // 3. Backend Sunucu Internet Bağlantısı Test
    try {
      console.log('🌐 Backend internet bağlantısı kontrol ediliyor...');
      
      // Google DNS'e ping testi
      const pingTest = await axios.get('https://8.8.8.8', {
        timeout: 5000,
        validateStatus: () => true // Herhangi bir status code'u kabul et
      });
      
      results.tests.internetConnection = {
        status: '✅ BAŞARILI',
        message: 'Backend sunucusu internet bağlantısı var',
        details: {
          testUrl: 'https://8.8.8.8',
          responseTime: pingTest.headers['x-response-time'] || 'N/A'
        }
      };
      console.log('✅ Internet Bağlantısı: BAŞARILI');
    } catch (error) {
      results.tests.internetConnection = {
        status: '❌ HATA',
        message: 'Backend sunucusu internet bağlantısı yok',
        error: error.message
      };
      console.log('❌ Internet Bağlantısı: BAŞARISIZ');
    }

    // 4. Genel Sistem Durumu
    const allTestsPassed = Object.values(results.tests).every(test => 
      test.status === '✅ BAŞARILI'
    );

    results.overallStatus = allTestsPassed ? '✅ TÜM TESTLER BAŞARILI' : '⚠️ BAZI TESTLER BAŞARISIZ';
    results.summary = {
      totalTests: Object.keys(results.tests).length,
      passedTests: Object.values(results.tests).filter(test => test.status === '✅ BAŞARILI').length,
      failedTests: Object.values(results.tests).filter(test => test.status.includes('❌')).length,
      warningTests: Object.values(results.tests).filter(test => test.status.includes('⚠️')).length
    };

    console.log('📊 Test Sonuçları:', results.summary);
    console.log('🎯 Genel Durum:', results.overallStatus);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ System Status Test Hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Sistem durumu test edilirken hata oluştu',
      details: error.message
    });
  }
};

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
    console.error('❌ AI Controller Error:', error);
    
    // Socket hang up ve network hataları için özel handling
    if (error.code === 'ECONNRESET' || 
        error.message.includes('socket hang up') ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT') {
      
      console.log('🌐 Network bağlantı hatası tespit edildi');
      return res.status(503).json({ 
        success: false, 
        error: 'AI servisi geçici olarak kullanılamıyor. Lütfen birkaç saniye sonra tekrar deneyin.',
        retryAfter: 5
      });
    }
    
    // Timeout hataları
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(408).json({ 
        success: false, 
        error: 'AI yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin.',
        retryAfter: 3
      });
    }
    
    // API key hataları
    if (error.message.includes('API anahtarı') || error.response?.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: 'AI servisi kimlik doğrulama hatası. Lütfen sistem yöneticisi ile iletişime geçin.'
      });
    }
    
    // Rate limit hataları
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        success: false, 
        error: 'AI servisi şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
        retryAfter: 60
      });
    }
    
    // Genel hata
    return res.status(500).json({ 
      success: false, 
      error: 'AI işleminde beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
    });
  }
};

// askAI fonksiyonunu güncelle
const askAIWithOptions = async (req, res) => {
  try {
    const { prompt } = req.body;  // responseType parametresi kaldırıldı
    const userId = req.user._id;

    console.log('🤖 AI Request:', { prompt: prompt });

    const response = await getMentorResponse(prompt);
    
    console.log('✅ AI Response successful');
    
    return res.json({ success: true, data: response });

  } catch (error) {
    console.error('❌ AI Controller Error:', error);
    
    // Hata türüne göre özel mesajlar
    if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
      return res.status(503).json({ success: false, error: 'AI servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin.' });
    }
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({ success: false, error: 'AI servisi çok uzun sürdü. Lütfen tekrar deneyin.' });
    }
    
    return res.status(500).json({ success: false, error: 'AI işleminde hata oluştu.' });
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
  analyzeImageOnly,
  testSystemStatus // Yeni test endpoint'i
}; 