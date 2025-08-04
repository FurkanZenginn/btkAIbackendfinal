const {
  findMatchingHapBilgi,
  generateHapBilgiWithAI,
  incrementUsageCount,
  getPopularHapBilgiler,
  getHapBilgilerByCategory,
  searchHapBilgiler,
  getSimilarQuestionsByHapBilgi
} = require('../services/hapBilgiService');
const HapBilgi = require('../models/HapBilgi');

// GET /api/hap-bilgi/topic/:topic - Konuya göre hap bilgi getir
const getHapBilgiByTopic = async (req, res) => {
  try {
    const { topic } = req.params;
    const { difficulty = 'orta', includeSimilarQuestions = false } = req.query;

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
        success: false,
        error: 'Bu konuyla ilgili hap bilgi bulunamadı'
      });
    }

    // Kullanım sayısını artır
    await incrementUsageCount(hapBilgi._id);

    // Benzer soruları da getir (isteğe bağlı)
    let similarQuestions = [];
    if (includeSimilarQuestions === 'true') {
      similarQuestions = await getSimilarQuestionsByHapBilgi(hapBilgi._id, 3);
    }

    res.json({
      success: true,
      data: {
        hapBilgi,
        similarQuestions: includeSimilarQuestions === 'true' ? similarQuestions : undefined
      }
    });

  } catch (error) {
    console.error('Hap bilgi getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi alınırken hata oluştu'
    });
  }
};

// GET /api/hap-bilgi/popular - Popüler hap bilgiler
const getPopularHapBilgilerController = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const hapBilgiler = await getPopularHapBilgiler(parseInt(limit));

    res.json({
      success: true,
      data: hapBilgiler
    });

  } catch (error) {
    console.error('Popüler hap bilgiler hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Popüler hap bilgiler alınırken hata oluştu'
    });
  }
};

// GET /api/hap-bilgi/category/:category - Kategori bazında hap bilgiler
const getHapBilgilerByCategoryController = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20 } = req.query;
    
    const hapBilgiler = await getHapBilgilerByCategory(category, parseInt(limit));

    res.json({
      success: true,
      data: hapBilgiler
    });

  } catch (error) {
    console.error('Kategori hap bilgiler hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Kategori hap bilgiler alınırken hata oluştu'
    });
  }
};

// GET /api/hap-bilgi/search - Hap bilgi arama
const searchHapBilgilerController = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi gerekli'
      });
    }

    const hapBilgiler = await searchHapBilgiler(q, parseInt(limit));

    res.json({
      success: true,
      data: hapBilgiler
    });

  } catch (error) {
    console.error('Hap bilgi arama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi arama sırasında hata oluştu'
    });
  }
};

// POST /api/hap-bilgi - Yeni hap bilgi oluştur (Admin)
const createHapBilgi = async (req, res) => {
  try {
    const {
      topic,
      title,
      content,
      category,
      difficulty,
      tags,
      examples,
      tips,
      relatedTopics
    } = req.body;

    const hapBilgi = new HapBilgi({
      topic,
      title,
      content,
      category,
      difficulty,
      tags,
      examples,
      tips,
      relatedTopics,
      createdBy: req.user._id
    });

    await hapBilgi.save();

    res.status(201).json({
      success: true,
      data: hapBilgi,
      message: 'Hap bilgi başarıyla oluşturuldu'
    });

  } catch (error) {
    console.error('Hap bilgi oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi oluşturulurken hata oluştu'
    });
  }
};

// PUT /api/hap-bilgi/:id - Hap bilgi güncelle (Admin)
const updateHapBilgi = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const hapBilgi = await HapBilgi.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!hapBilgi) {
      return res.status(404).json({
        success: false,
        error: 'Hap bilgi bulunamadı'
      });
    }

    res.json({
      success: true,
      data: hapBilgi,
      message: 'Hap bilgi başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Hap bilgi güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi güncellenirken hata oluştu'
    });
  }
};

// DELETE /api/hap-bilgi/:id - Hap bilgi sil (Admin)
const deleteHapBilgi = async (req, res) => {
  try {
    const { id } = req.params;

    const hapBilgi = await HapBilgi.findByIdAndDelete(id);

    if (!hapBilgi) {
      return res.status(404).json({
        success: false,
        error: 'Hap bilgi bulunamadı'
      });
    }

    res.json({
      success: true,
      message: 'Hap bilgi başarıyla silindi'
    });

  } catch (error) {
    console.error('Hap bilgi silme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi silinirken hata oluştu'
    });
  }
};

// GET /api/hap-bilgi/:id - Tek hap bilgi getir
const getHapBilgiById = async (req, res) => {
  try {
    const { id } = req.params;

    const hapBilgi = await HapBilgi.findById(id);

    if (!hapBilgi) {
      return res.status(404).json({
        success: false,
        error: 'Hap bilgi bulunamadı'
      });
    }

    // Kullanım sayısını artır
    await incrementUsageCount(hapBilgi._id);

    res.json({
      success: true,
      data: hapBilgi
    });

  } catch (error) {
    console.error('Hap bilgi getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hap bilgi alınırken hata oluştu'
    });
  }
};

// GET /api/hap-bilgi/:id/similar-questions - Hap bilgiye göre benzer sorular
const getSimilarQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const questions = await getSimilarQuestionsByHapBilgi(id, parseInt(limit));

    res.json({
      success: true,
      data: {
        hapBilgiId: id,
        questions,
        totalQuestions: questions.length
      }
    });

  } catch (error) {
    console.error('Benzer soru getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Benzer sorular alınırken hata oluştu'
    });
  }
};

module.exports = {
  getHapBilgiByTopic,
  getPopularHapBilgiler: getPopularHapBilgilerController,
  getHapBilgilerByCategory: getHapBilgilerByCategoryController,
  searchHapBilgiler: searchHapBilgilerController,
  createHapBilgi,
  updateHapBilgi,
  deleteHapBilgi,
  getHapBilgiById,
  getSimilarQuestions
}; 