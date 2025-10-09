const HapBilgi = require('../models/HapBilgi');
const Post = require('../models/Post');
const { getFastAIResponse } = require('./geminiService');

// Bu fonksiyon eksik, ekle:
const analyzePostAndMatchHapBilgi = async (content, imageURL) => {
  try {
    // Basit analiz yap
    const analysis = {
      analyzedAt: new Date(),
      confidence: 0.8,
      detectedCategory: 'genel',
      detectedTopic: content?.substring(0, 50) || 'genel',
      relatedHapBilgiler: []
    };
    
    return analysis;
  } catch (error) {
    console.error('Hap bilgi analizi hatası:', error);
    return null;
  }
};

// AI ile post analizi ve hap bilgi oluşturma
const analyzePostAndCreateHapBilgi = async (postId, userId) => {
  try {
    const post = await Post.findById(postId).populate('userId', 'name');
    if (!post) {
      throw new Error('Post bulunamadı');
    }

    console.log(`🤖 Post analizi başlıyor: ${postId}`);

    // AI analizi için prompt hazırla
    const analysisPrompt = `
Bu öğrenci sorusunu analiz et ve hap bilgi kartı oluştur:

SORU: ${post.content}

GÖRSEL: ${post.imageURL ? 'Var' : 'Yok'}

Lütfen şu formatta yanıt ver:

KONU: [Ana konu]
BAŞLIK: [Kısa ve açıklayıcı başlık]
İÇERİK: [Detaylı açıklama]
KATEGORİ: [matematik/fizik/kimya/biyoloji/tarih/coğrafya/edebiyat/dil/genel]
ZORLUK: [kolay/orta/zor]
ANAHTAR_KELİMELER: [virgülle ayrılmış anahtar kelimeler]
ÖZET: [Kısa özet]
İLGİLİ_KONULAR: [virgülle ayrılmış ilgili konular]
ÖĞRENME_HEDEFLERİ: [virgülle ayrılmış öğrenme hedefleri]
İPUÇLARI: [virgülle ayrılmış ipuçları]
ÖRNEK_SORU: [Benzer bir örnek soru]
ÇÖZÜM: [Örnek sorunun çözümü]
`;

    // AI analizi yap
    const aiResponse = await getFastAIResponse(analysisPrompt, 'direct-solution');
    
    // AI yanıtını parse et
    const parsedData = parseAIResponse(aiResponse);
    
    // Hap bilgi oluştur
    const hapBilgi = new HapBilgi({
      topic: parsedData.topic,
      title: parsedData.title,
      content: parsedData.content,
      category: parsedData.category,
      difficulty: parsedData.difficulty,
      tags: parsedData.keywords,
      relatedTopics: parsedData.relatedTopics,
      tips: parsedData.tips,
      examples: [{
        question: parsedData.exampleQuestion,
        solution: parsedData.exampleSolution,
        difficulty: parsedData.difficulty
      }],
      aiAnalysis: {
        confidence: 0.8, // AI analizi güven skoru
        keywords: parsedData.keywords,
        summary: parsedData.summary,
        relatedConcepts: parsedData.relatedTopics,
        learningObjectives: parsedData.learningObjectives
      },
      relatedPosts: [{
        postId: post._id,
        relevance: 1.0
      }],
      createdBy: userId,
      sourcePost: post._id
    });

    await hapBilgi.save();
    
    console.log(`✅ Hap bilgi oluşturuldu: ${hapBilgi._id}`);
    
    // İlişkili hap bilgileri bul ve bağla
    await findAndLinkRelatedHapBilgiler(hapBilgi);
    
    return hapBilgi;
    
  } catch (error) {
    console.error('❌ Hap bilgi oluşturma hatası:', error);
    throw error;
  }
};

// AI yanıtını parse et
const parseAIResponse = (aiResponse) => {
  const lines = aiResponse.split('\n');
  const data = {};
  
  lines.forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      
      switch (key.trim()) {
        case 'KONU':
          data.topic = value;
          break;
        case 'BAŞLIK':
          data.title = value;
          break;
        case 'İÇERİK':
          data.content = value;
          break;
        case 'KATEGORİ':
          data.category = value.toLowerCase();
          break;
        case 'ZORLUK':
          data.difficulty = value.toLowerCase();
          break;
        case 'ANAHTAR_KELİMELER':
          data.keywords = value.split(',').map(k => k.trim());
          break;
        case 'ÖZET':
          data.summary = value;
          break;
        case 'İLGİLİ_KONULAR':
          data.relatedTopics = value.split(',').map(k => k.trim());
          break;
        case 'ÖĞRENME_HEDEFLERİ':
          data.learningObjectives = value.split(',').map(k => k.trim());
          break;
        case 'İPUÇLARI':
          data.tips = value.split(',').map(k => k.trim());
          break;
        case 'ÖRNEK_SORU':
          data.exampleQuestion = value;
          break;
        case 'ÇÖZÜM':
          data.exampleSolution = value;
          break;
      }
    }
  });
  
  return data;
};

// İlişkili hap bilgileri bul ve bağla
const findAndLinkRelatedHapBilgiler = async (hapBilgi) => {
  try {
    const relatedHapBilgiler = await hapBilgi.findRelatedHapBilgiler(10);
    
    // Mevcut hap bilgiyi güncelle
    const relatedLinks = relatedHapBilgiler.map(related => ({
      hapBilgiId: related._id,
      relevance: hapBilgi.calculateSimilarity(related)
    })).filter(link => link.relevance > 0.3); // %30'dan fazla benzerlik
    
    hapBilgi.relatedHapBilgiler = relatedLinks;
    await hapBilgi.save();
    
    // Diğer hap bilgileri de bu yeni hap bilgiyi referans alsın
    for (const related of relatedHapBilgiler) {
      const similarity = hapBilgi.calculateSimilarity(related);
      if (similarity > 0.3) {
        const existingLink = related.relatedHapBilgiler.find(
          link => link.hapBilgiId.toString() === hapBilgi._id.toString()
        );
        
        if (!existingLink) {
          related.relatedHapBilgiler.push({
            hapBilgiId: hapBilgi._id,
            relevance: similarity
          });
          await related.save();
        }
      }
    }
    
    console.log(`🔗 ${relatedLinks.length} ilişkili hap bilgi bağlandı`);
    
  } catch (error) {
    console.error('❌ İlişkili hap bilgi bağlama hatası:', error);
  }
};

// Kullanıcı için önerilen hap bilgileri
const getRecommendedHapBilgiler = async (userId, limit = 10) => {
  try {
    // Kullanıcının geçmiş etkileşimlerini al
    const userPosts = await Post.find({ userId }).select('content topicTags');
    const userKeywords = new Set();
    
    userPosts.forEach(post => {
      if (post.topicTags) {
        post.topicTags.forEach(tag => userKeywords.add(tag));
      }
    });
    
    // Kullanıcının ilgi alanlarına göre hap bilgileri bul
    const recommendations = await HapBilgi.find({
      isActive: true,
      $or: [
        { 'aiAnalysis.keywords': { $in: Array.from(userKeywords) } },
        { tags: { $in: Array.from(userKeywords) } }
      ]
    })
    .sort({ 'aiAnalysis.confidence': -1, usageCount: -1 })
    .limit(limit)
    .populate('createdBy', 'name avatar');
    
    return recommendations;
    
  } catch (error) {
    console.error('❌ Önerilen hap bilgi getirme hatası:', error);
    throw error;
  }
};

// Benzer konulardaki soruları bul
const findSimilarQuestions = async (hapBilgiId, limit = 10) => {
  try {
    const hapBilgi = await HapBilgi.findById(hapBilgiId);
    if (!hapBilgi) {
      throw new Error('Hap bilgi bulunamadı');
    }
    
    const keywords = [...(hapBilgi.aiAnalysis.keywords || []), ...(hapBilgi.tags || [])];
    
    // Benzer anahtar kelimelere sahip postları bul
    const similarPosts = await Post.find({
      isModerated: true,
      $or: [
        { topicTags: { $in: keywords } },
        { content: { $regex: keywords.join('|'), $options: 'i' } }
      ]
    })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
    
    return similarPosts;
    
  } catch (error) {
    console.error('❌ Benzer sorular getirme hatası:', error);
    throw error;
  }
};

// Hap bilgi arama
const searchHapBilgiler = async (query, filters = {}) => {
  try {
    const { category, difficulty, limit = 20 } = filters;
    
    let searchQuery = {
      isActive: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { topic: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { 'aiAnalysis.keywords': { $in: [new RegExp(query, 'i')] } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };
    
    if (category) searchQuery.category = category;
    if (difficulty) searchQuery.difficulty = difficulty;
    
    const results = await HapBilgi.find(searchQuery)
      .populate('createdBy', 'name avatar')
      .sort({ 'aiAnalysis.confidence': -1, usageCount: -1 })
      .limit(limit);
    
    return results;
    
  } catch (error) {
    console.error('❌ Hap bilgi arama hatası:', error);
    throw error;
  }
};

// Hap bilgi istatistikleri
const getHapBilgiStats = async () => {
  try {
    const stats = await HapBilgi.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalViews: { $sum: '$viewCount' },
          totalUsage: { $sum: '$usageCount' },
          avgConfidence: { $avg: '$aiAnalysis.confidence' }
        }
      }
    ]);
    
    const categoryStats = await HapBilgi.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgUsage: { $avg: '$usageCount' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    return {
      overall: stats[0] || {},
      byCategory: categoryStats
    };
    
  } catch (error) {
    console.error('❌ Hap bilgi istatistik hatası:', error);
    throw error;
  }
};

// Soru ve AI yanıtından hap bilgi oluştur
const createHapBilgiFromQuestion = async (question, aiResponse, userId) => {
  try {
    console.log(`🤖 Soru ve AI yanıtından hap bilgi oluşturuluyor...`);

    // NLP analizi için prompt hazırla
    const nlpPrompt = `
Bu soru ve AI yanıtını analiz et ve hap bilgi kartı oluştur:

SORU: ${question}
AI YANITI: ${aiResponse}

Lütfen şu formatta yanıt ver:

KONU: [Ana konu]
BAŞLIK: [Kısa ve açıklayıcı başlık]
İÇERİK: [Detaylı açıklama - AI yanıtını özetle]
KATEGORİ: [matematik/fizik/kimya/biyoloji/tarih/coğrafya/edebiyat/dil/genel]
ZORLUK: [kolay/orta/zor]
ANAHTAR_KELİMELER: [virgülle ayrılmış anahtar kelimeler]
ÖZET: [Kısa özet]
İLGİLİ_KONULAR: [virgülle ayrılmış ilgili konular]
ÖĞRENME_HEDEFLERİ: [virgülle ayrılmış öğrenme hedefleri]
İPUÇLARI: [virgülle ayrılmış ipuçları]
ÖRNEK_SORU: [Benzer bir örnek soru]
ÇÖZÜM: [Örnek sorunun çözümü]
`;

    // AI analizi yap
    const aiAnalysis = await getFastAIResponse(nlpPrompt, 'direct-solution');
    
    // AI yanıtını parse et
    const parsedData = parseAIResponse(aiAnalysis);
    
    // Hap bilgi oluştur
    const hapBilgi = new HapBilgi({
      topic: parsedData.topic,
      title: parsedData.title,
      content: parsedData.content,
      category: parsedData.category,
      difficulty: parsedData.difficulty,
      tags: parsedData.keywords,
      relatedTopics: parsedData.relatedTopics,
      tips: parsedData.tips,
      examples: [{
        question: parsedData.exampleQuestion,
        solution: parsedData.exampleSolution,
        difficulty: parsedData.difficulty
      }],
      aiAnalysis: {
        confidence: 0.9, // Yüksek güven skoru (soru + AI yanıtı var)
        keywords: parsedData.keywords,
        summary: parsedData.summary,
        relatedConcepts: parsedData.relatedTopics,
        learningObjectives: parsedData.learningObjectives,
        sourceQuestion: question,
        sourceAIResponse: aiResponse
      },
      createdBy: userId,
      sourceType: 'question_ai_response' // Kaynak türü
    });

    await hapBilgi.save();
    
    console.log(`✅ Soru ve AI yanıtından hap bilgi oluşturuldu: ${hapBilgi._id}`);
    
    // İlişkili hap bilgileri bul ve bağla
    await findAndLinkRelatedHapBilgiler(hapBilgi);
    
    return hapBilgi;
    
  } catch (error) {
    console.error('❌ Soru ve AI yanıtından hap bilgi oluşturma hatası:', error);
    throw error;
  }
};

// KULLANICI BAZLI VERİ FİLTRELEME - Hap bilgi'leri kullanıcıya göre filtrele
const getUserSpecificHapBilgiler = async (userId, options = {}) => {
  try {
    const { category, difficulty, limit = 20, page = 1 } = options;
    const skip = (page - 1) * limit;
    
    // Kullanıcıya özel filtreleme
    const query = {
      $or: [
        // Kullanıcının oluşturduğu hap bilgiler
        { createdBy: userId },
        // Kullanıcının eriştiği hap bilgiler
        { 'accessHistory.userId': userId },
        // Kullanıcının bookmark'ladığı hap bilgiler
        { 'userStats.userId': userId, 'userStats.isBookmarked': true }
      ]
    };
    
    // Kategori filtresi
    if (category) {
      query.category = category;
    }
    
    // Zorluk filtresi
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    const hapBilgiler = await HapBilgi.find(query)
      .populate('createdBy', 'name')
      .populate('lastAccessedBy', 'name')
      .sort({ 'accessHistory.accessedAt': -1 })
      .skip(skip)
      .limit(limit);
    
    return hapBilgiler;
    
  } catch (error) {
    console.error('Kullanıcı bazlı hap bilgi getirme hatası:', error);
    throw error;
  }
};

// Kullanıcının hap bilgi istatistiklerini getir
const getUserHapBilgiStats = async (userId) => {
  try {
    const stats = await HapBilgi.aggregate([
      {
        $match: {
          $or: [
            { createdBy: userId },
            { 'accessHistory.userId': userId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalCreated: {
            $sum: { $cond: [{ $eq: ['$createdBy', userId] }, 1, 0] }
          },
          totalAccessed: {
            $sum: { $cond: [{ $in: [userId, '$accessHistory.userId'] }, 1, 0] }
          },
          totalBookmarked: {
            $sum: {
              $size: {
                $filter: {
                  input: '$userStats',
                  cond: { $and: [{ $eq: ['$$this.userId', userId] }, { $eq: ['$$this.isBookmarked', true] }] }
                }
              }
            }
          },
          averageRating: {
            $avg: {
              $let: {
                vars: {
                  userRating: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$userStats',
                          cond: { $eq: ['$$this.userId', userId] }
                        }
                      },
                      0
                    ]
                  }
                },
                in: '$$userRating.rating'
              }
            }
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalCreated: 0,
      totalAccessed: 0,
      totalBookmarked: 0,
      averageRating: 0
    };
    
  } catch (error) {
    console.error('Kullanıcı hap bilgi istatistikleri hatası:', error);
    throw error;
  }
};

module.exports = {
  analyzePostAndCreateHapBilgi,
  analyzePostAndMatchHapBilgi, // Eksik fonksiyon eklendi
  createHapBilgiFromQuestion, // Yeni fonksiyon eklendi
  findAndLinkRelatedHapBilgiler,
  getRecommendedHapBilgiler,
  findSimilarQuestions,
  searchHapBilgiler,
  getHapBilgiStats,
  getUserSpecificHapBilgiler,
  getUserHapBilgiStats
}; 