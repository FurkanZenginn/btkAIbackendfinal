const Learning = require('../models/Learning');
const { addPoints } = require('../services/gamificationService');

// GET /api/learning/progress - Kullanıcının öğrenme ilerlemesi
const getLearningProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category } = req.query;

    let query = { userId, isActive: true };
    if (category) {
      query.category = category;
    }

    const learningRecords = await Learning.find(query)
      .sort({ lastStudied: -1 });

    // İstatistikleri hesapla
    const stats = {
      totalTopics: learningRecords.length,
      totalProgress: learningRecords.reduce((sum, record) => sum + record.progress, 0),
      averageProgress: learningRecords.length > 0 ? 
        Math.round(learningRecords.reduce((sum, record) => sum + record.progress, 0) / learningRecords.length) : 0,
      totalTimeSpent: learningRecords.reduce((sum, record) => sum + record.timeSpent, 0),
      completedLessons: learningRecords.reduce((sum, record) => sum + record.completedLessons.length, 0),
      completedAssessments: learningRecords.reduce((sum, record) => sum + record.assessments.length, 0)
    };

    res.json({
      success: true,
      data: {
        learningRecords,
        stats
      }
    });

  } catch (error) {
    console.error('Öğrenme ilerlemesi getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Öğrenme ilerlemesi alınırken hata oluştu'
    });
  }
};

// POST /api/learning/start - Yeni öğrenme oturumu başlat
const startLearningSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topic, category, difficulty = 'orta' } = req.body;

    // Mevcut öğrenme kaydını kontrol et
    let learningRecord = await Learning.findOne({
      userId,
      topic,
      category,
      isActive: true
    });

    if (!learningRecord) {
      // Yeni öğrenme kaydı oluştur
      learningRecord = new Learning({
        userId,
        topic,
        category,
        difficulty,
        lastStudied: new Date()
      });
      await learningRecord.save();
    } else {
      // Son çalışma zamanını güncelle
      learningRecord.lastStudied = new Date();
      await learningRecord.save();
    }

    res.json({
      success: true,
      data: learningRecord,
      message: 'Öğrenme oturumu başlatıldı'
    });

  } catch (error) {
    console.error('Öğrenme oturumu başlatma hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Öğrenme oturumu başlatılırken hata oluştu'
    });
  }
};

// PUT /api/learning/:id/progress - İlerleme güncelle
const updateLearningProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, timeSpent, lessonId, score } = req.body;
    const userId = req.user._id;

    const learningRecord = await Learning.findOne({
      _id: id,
      userId,
      isActive: true
    });

    if (!learningRecord) {
      return res.status(404).json({
        success: false,
        error: 'Öğrenme kaydı bulunamadı'
      });
    }

    // İlerlemeyi güncelle
    if (progress !== undefined) {
      learningRecord.progress = Math.min(100, Math.max(0, progress));
    }

    // Çalışma süresini ekle
    if (timeSpent) {
      learningRecord.timeSpent += timeSpent;
    }

    // Dersi tamamlandı olarak işaretle
    if (lessonId && score !== undefined) {
      learningRecord.completedLessons.push({
        lessonId,
        completedAt: new Date(),
        score
      });
    }

    learningRecord.lastStudied = new Date();
    await learningRecord.save();

    // Gamification puanı ekle
    if (progress > learningRecord.progress) {
      await addPoints(
        userId,
        'learning_progress',
        'Öğrenme ilerlemesi kaydettin!',
        { topic: learningRecord.topic, progress: learningRecord.progress }
      );
    }

    res.json({
      success: true,
      data: learningRecord,
      message: 'İlerleme güncellendi'
    });

  } catch (error) {
    console.error('İlerleme güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'İlerleme güncellenirken hata oluştu'
    });
  }
};

// POST /api/learning/:id/assessment - Değerlendirme sonucu kaydet
const saveAssessmentResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { assessmentId, score, questions } = req.body;
    const userId = req.user._id;

    const learningRecord = await Learning.findOne({
      _id: id,
      userId,
      isActive: true
    });

    if (!learningRecord) {
      return res.status(404).json({
        success: false,
        error: 'Öğrenme kaydı bulunamadı'
      });
    }

    // Değerlendirme sonucunu kaydet
    learningRecord.assessments.push({
      assessmentId,
      score,
      completedAt: new Date(),
      questions
    });

    // Skora göre ilerlemeyi güncelle
    if (score >= 80) {
      learningRecord.progress = Math.min(100, learningRecord.progress + 10);
    } else if (score >= 60) {
      learningRecord.progress = Math.min(100, learningRecord.progress + 5);
    }

    learningRecord.lastStudied = new Date();
    await learningRecord.save();

    // Gamification puanı ekle
    await addPoints(
      userId,
      'assessment_completed',
      'Değerlendirme tamamladın!',
      { topic: learningRecord.topic, score }
    );

    res.json({
      success: true,
      data: learningRecord,
      message: 'Değerlendirme sonucu kaydedildi'
    });

  } catch (error) {
    console.error('Değerlendirme kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Değerlendirme kaydedilirken hata oluştu'
    });
  }
};

// GET /api/learning/topics - Mevcut konular
const getAvailableTopics = async (req, res) => {
  try {
    const { category } = req.query;

    // Kategorilere göre konular
    const topicsByCategory = {
      matematik: [
        'Temel Matematik', 'Geometri', 'Cebir', 'Trigonometri', 
        'Türev', 'İntegral', 'Olasılık', 'İstatistik'
      ],
      fizik: [
        'Mekanik', 'Elektrik', 'Manyetizma', 'Optik', 
        'Termodinamik', 'Dalgalar', 'Atom Fiziği'
      ],
      kimya: [
        'Temel Kimya', 'Organik Kimya', 'İnorganik Kimya', 
        'Analitik Kimya', 'Fizikokimya', 'Biyokimya'
      ],
      biyoloji: [
        'Hücre Biyolojisi', 'Genetik', 'Evrim', 'Ekoloji',
        'İnsan Anatomisi', 'Bitki Biyolojisi', 'Mikrobiyoloji'
      ],
      tarih: [
        'İlk Çağ', 'Orta Çağ', 'Yeni Çağ', 'Yakın Çağ',
        'Osmanlı Tarihi', 'Cumhuriyet Tarihi', 'Dünya Tarihi'
      ],
      coğrafya: [
        'Fiziki Coğrafya', 'Beşeri Coğrafya', 'Türkiye Coğrafyası',
        'Dünya Coğrafyası', 'İklim Bilimi', 'Ekonomik Coğrafya'
      ],
      edebiyat: [
        'Türk Edebiyatı', 'Dünya Edebiyatı', 'Şiir', 'Roman',
        'Hikaye', 'Tiyatro', 'Deneme', 'Eleştiri'
      ],
      dil: [
        'Dilbilgisi', 'Yazım Kuralları', 'Noktalama', 'Anlatım',
        'Kompozisyon', 'Edebi Türler', 'Dil Bilimi'
      ]
    };

    let topics = [];
    if (category && topicsByCategory[category]) {
      topics = topicsByCategory[category];
    } else {
      // Tüm konuları birleştir
      Object.values(topicsByCategory).forEach(categoryTopics => {
        topics = topics.concat(categoryTopics);
      });
    }

    res.json({
      success: true,
      data: {
        topics,
        categories: Object.keys(topicsByCategory)
      }
    });

  } catch (error) {
    console.error('Konu listesi getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Konu listesi alınırken hata oluştu'
    });
  }
};

module.exports = {
  getLearningProgress,
  startLearningSession,
  updateLearningProgress,
  saveAssessmentResult,
  getAvailableTopics
}; 