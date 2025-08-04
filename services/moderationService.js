const { getMentorResponse } = require('./geminiService');

// Gemini ile metin moderasyonu
const moderateText = async (text, contentType = 'post') => {
  try {
    const prompt = `
    Bu metni eğitim platformu için analiz et ve uygunluk değerlendirmesi yap.
    
    Metin: "${text}"
    İçerik Türü: ${contentType}
    
    Lütfen şu formatta yanıtla:
    
    UYGUNLUK: [uygun/uygun_değil/düzeltilebilir]
    GÜVENLİK_SEVİYESİ: [düşük/orta/yüksek]
    NEDEN: [kısa açıklama]
    ÖNERİLER: [düzeltme önerileri, virgülle ayrılmış]
    DÜZELTILMIŞ_METIN: [eğer düzeltilebilirse, düzeltilmiş versiyonu]
    
    Değerlendirme kriterleri:
    - Eğitimsel içerik mi?
    - Uygunsuz dil var mı?
    - Spam/trol içerik mi?
    - Kişisel saldırı var mı?
    - Telif hakkı ihlali var mı?
    - Güvenlik riski var mı?
    
    Eğer içerik düzeltilebilirse, "düzeltilebilir" olarak işaretle ve düzeltilmiş versiyonunu ver.
    Sadece gerçekten uygunsuz içerikler için "uygun_değil" kullan.
    `;

    const response = await getMentorResponse(prompt);
    
    // Yanıtı parse et
    const result = parseModerationResponse(response);
    
    return {
      isAppropriate: result.uygunluk === 'uygun',
      needsCorrection: result.uygunluk === 'düzeltilebilir',
      safetyLevel: result.guvenlikSeviyesi,
      reason: result.neden,
      suggestions: result.oneriler,
      correctedText: result.duzeltilmisMetin,
      rawResponse: response
    };

  } catch (error) {
    console.error('Metin moderasyon hatası:', error);
    // Hata durumunda güvenli varsayılan değer
    return {
      isAppropriate: true,
      needsCorrection: false,
      safetyLevel: 'düşük',
      reason: 'Moderasyon sistemi geçici olarak kullanılamıyor',
      suggestions: [],
      correctedText: null,
      rawResponse: ''
    };
  }
};

// Gemini ile görsel moderasyonu (görsel URL'si ile)
const moderateImage = async (imageURL, description = '') => {
  try {
    const prompt = `
    Bu görseli eğitim platformu için analiz et ve uygunluk değerlendirmesi yap.
    
    Görsel URL: ${imageURL}
    Açıklama: "${description}"
    
    Lütfen şu formatta yanıtla:
    
    UYGUNLUK: [uygun/uygun_değil/düzeltilebilir]
    GÜVENLİK_SEVİYESİ: [düşük/orta/yüksek]
    İÇERİK_TÜRÜ: [eğitimsel/kişisel/uygunsuz/diğer]
    NEDEN: [kısa açıklama]
    ÖNERİLER: [düzeltme önerileri, virgülle ayrılmış]
    ALTERNATİF_ÖNERİLER: [alternatif görsel türleri, virgülle ayrılmış]
    
    Değerlendirme kriterleri:
    - Eğitimsel içerik mi?
    - Uygunsuz görsel mi?
    - Kişisel bilgi var mı?
    - Telif hakkı ihlali var mı?
    - Güvenlik riski var mı?
    
    Eğer görsel düzeltilebilirse, "düzeltilebilir" olarak işaretle ve öneriler ver.
    Sadece gerçekten uygunsuz görseller için "uygun_değil" kullan.
    `;

    const response = await getMentorResponse(prompt);
    
    // Yanıtı parse et
    const result = parseModerationResponse(response);
    
    return {
      isAppropriate: result.uygunluk === 'uygun',
      needsCorrection: result.uygunluk === 'düzeltilebilir',
      safetyLevel: result.guvenlikSeviyesi,
      contentType: result.icerikTuru,
      reason: result.neden,
      suggestions: result.oneriler,
      alternativeSuggestions: result.alternatifOneriler,
      rawResponse: response
    };

  } catch (error) {
    console.error('Görsel moderasyon hatası:', error);
    // Hata durumunda güvenli varsayılan değer
    return {
      isAppropriate: true,
      needsCorrection: false,
      safetyLevel: 'düşük',
      contentType: 'eğitimsel',
      reason: 'Moderasyon sistemi geçici olarak kullanılamıyor',
      suggestions: [],
      alternativeSuggestions: [],
      rawResponse: ''
    };
  }
};

// Moderasyon yanıtını parse et
const parseModerationResponse = (response) => {
  const lines = response.split('\n');
  const result = {
    uygunluk: 'uygun',
    guvenlikSeviyesi: 'düşük',
    icerikTuru: 'eğitimsel',
    neden: '',
    oneriler: [],
    duzeltilmisMetin: null,
    alternatifOneriler: []
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('UYGUNLUK:')) {
      result.uygunluk = trimmedLine.replace('UYGUNLUK:', '').trim().toLowerCase();
    } else if (trimmedLine.startsWith('GÜVENLİK_SEVİYESİ:')) {
      result.guvenlikSeviyesi = trimmedLine.replace('GÜVENLİK_SEVİYESİ:', '').trim().toLowerCase();
    } else if (trimmedLine.startsWith('İÇERİK_TÜRÜ:')) {
      result.icerikTuru = trimmedLine.replace('İÇERİK_TÜRÜ:', '').trim().toLowerCase();
    } else if (trimmedLine.startsWith('NEDEN:')) {
      result.neden = trimmedLine.replace('NEDEN:', '').trim();
    } else if (trimmedLine.startsWith('ÖNERİLER:')) {
      const oneriler = trimmedLine.replace('ÖNERİLER:', '').trim();
      result.oneriler = oneriler.split(',').map(o => o.trim()).filter(o => o);
    } else if (trimmedLine.startsWith('DÜZELTILMIŞ_METIN:')) {
      result.duzeltilmisMetin = trimmedLine.replace('DÜZELTILMIŞ_METIN:', '').trim();
    } else if (trimmedLine.startsWith('ALTERNATİF_ÖNERİLER:')) {
      const alternatifler = trimmedLine.replace('ALTERNATİF_ÖNERİLER:', '').trim();
      result.alternatifOneriler = alternatifler.split(',').map(o => o.trim()).filter(o => o);
    }
  }

  return result;
};

// Spam/flood kontrolü
const checkSpam = async (userId, contentType, content) => {
  try {
    const prompt = `
    Bu içeriği spam/flood açısından analiz et.
    
    İçerik: "${content}"
    İçerik Türü: ${contentType}
    
    Lütfen şu formatta yanıtla:
    
    SPAM_SEVİYESİ: [düşük/orta/yüksek]
    FLOOD_RİSKİ: [var/yok]
    NEDEN: [kısa açıklama]
    
    Spam/flood kriterleri:
    - Tekrarlayan içerik
    - Anlamsız karakter dizileri
    - Aşırı kısa/uzun içerik
    - Reklam içeriği
    - Bot benzeri davranış
    `;

    const response = await getMentorResponse(prompt);
    
    // Yanıtı parse et
    const lines = response.split('\n');
    let spamLevel = 'düşük';
    let floodRisk = 'yok';
    let reason = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('SPAM_SEVİYESİ:')) {
        spamLevel = trimmedLine.replace('SPAM_SEVİYESİ:', '').trim().toLowerCase();
      } else if (trimmedLine.startsWith('FLOOD_RİSKİ:')) {
        floodRisk = trimmedLine.replace('FLOOD_RİSKİ:', '').trim().toLowerCase();
      } else if (trimmedLine.startsWith('NEDEN:')) {
        reason = trimmedLine.replace('NEDEN:', '').trim();
      }
    }

    return {
      isSpam: spamLevel === 'yüksek',
      hasFloodRisk: floodRisk === 'var',
      spamLevel,
      reason
    };

  } catch (error) {
    console.error('Spam kontrol hatası:', error);
    return {
      isSpam: false,
      hasFloodRisk: false,
      spamLevel: 'düşük',
      reason: 'Spam kontrolü geçici olarak kullanılamıyor'
    };
  }
};

// Kullanıcı davranış analizi
const analyzeUserBehavior = async (userId, recentActivity) => {
  try {
    const prompt = `
    Bu kullanıcının son aktivitelerini analiz et ve davranış değerlendirmesi yap.
    
    Son Aktiviteler: ${JSON.stringify(recentActivity)}
    
    Lütfen şu formatta yanıtla:
    
    DAVRANIŞ_SEVİYESİ: [normal/şüpheli/riskli]
    GÜVENLİK_RİSKİ: [düşük/orta/yüksek]
    NEDEN: [kısa açıklama]
    ÖNERİLER: [varsa öneriler]
    
    Değerlendirme kriterleri:
    - Normal kullanıcı davranışı mı?
    - Spam/flood davranışı var mı?
    - Uygunsuz içerik paylaşımı var mı?
    - Bot benzeri davranış var mı?
    - Güvenlik riski oluşturuyor mu?
    `;

    const response = await getMentorResponse(prompt);
    
    // Yanıtı parse et
    const lines = response.split('\n');
    let behaviorLevel = 'normal';
    let securityRisk = 'düşük';
    let reason = '';
    let suggestions = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('DAVRANIŞ_SEVİYESİ:')) {
        behaviorLevel = trimmedLine.replace('DAVRANIŞ_SEVİYESİ:', '').trim().toLowerCase();
      } else if (trimmedLine.startsWith('GÜVENLİK_RİSKİ:')) {
        securityRisk = trimmedLine.replace('GÜVENLİK_RİSKİ:', '').trim().toLowerCase();
      } else if (trimmedLine.startsWith('NEDEN:')) {
        reason = trimmedLine.replace('NEDEN:', '').trim();
      } else if (trimmedLine.startsWith('ÖNERİLER:')) {
        const oneriler = trimmedLine.replace('ÖNERİLER:', '').trim();
        suggestions = oneriler.split(',').map(o => o.trim()).filter(o => o);
      }
    }

    return {
      behaviorLevel,
      securityRisk,
      reason,
      suggestions,
      isSuspicious: behaviorLevel === 'şüpheli' || behaviorLevel === 'riskli'
    };

  } catch (error) {
    console.error('Kullanıcı davranış analizi hatası:', error);
    return {
      behaviorLevel: 'normal',
      securityRisk: 'düşük',
      reason: 'Davranış analizi geçici olarak kullanılamıyor',
      suggestions: [],
      isSuspicious: false
    };
  }
};

// Kural tabanlı basit kontroller
const simpleTextChecks = (text) => {
  const checks = {
    isTooShort: text.length < 3,
    isTooLong: text.length > 5000,
    hasExcessiveCaps: (text.match(/[A-ZĞÜŞİÖÇ]/g) || []).length > text.length * 0.7,
    hasExcessivePunctuation: (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length > text.length * 0.3,
    hasRepeatedChars: /(.)\1{5,}/.test(text),
    hasSpamWords: /(spam|reklam|kazan|para|ücretsiz|bedava|tıkla|link)/i.test(text)
  };

  const issues = Object.entries(checks)
    .filter(([key, value]) => value)
    .map(([key]) => key);

  return {
    hasIssues: issues.length > 0,
    issues,
    isSpam: checks.hasSpamWords || checks.hasRepeatedChars,
    isFlood: checks.isTooShort || checks.hasExcessiveCaps
  };
};

module.exports = {
  moderateText,
  moderateImage,
  checkSpam,
  analyzeUserBehavior,
  simpleTextChecks
}; 