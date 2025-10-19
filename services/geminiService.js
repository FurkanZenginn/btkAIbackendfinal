const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const TIMEOUT = 30000;

const retryRequest = async (requestFn, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`API Attempt ${attempt}/${maxRetries}`);
      return await requestFn();
    } catch (error) {
      console.error(`API Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('All retry attempts failed');
        throw error;
      }
      
      if (error.code === 'ECONNRESET' || 
          error.message.includes('socket hang up') ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT') {
        
        const waitTime = attempt * 2000;
        console.log(`Waiting ${waitTime/1000} seconds before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      console.log('Waiting 1 second before retry...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

const imageCache = new Map();

const PROMPT_IMPROVEMENT_RULES = {
  // Sadece gerçekten karmaşık sorular için
  math: {
    keywords: ['integral', 'türev', 'denklem', 'formül', 'hesapla', 'çöz'],
    improvements: [
      'Hangi matematik konusu ile ilgili?',
      'Verilen değerler neler?'
    ]
  },
  physics: {
    keywords: ['hız', 'ivme', 'kuvvet', 'enerji', 'basınç', 'sıcaklık'],
    improvements: [
      'Hangi fizik konusu ile ilgili?',
      'Verilen değerler ve birimler neler?'
    ]
  },
  chemistry: {
    keywords: ['molekül', 'reaksiyon', 'kimyasal', 'element', 'bileşik'],
    improvements: [
      'Hangi kimya konusu ile ilgili?',
      'Verilen kimyasal bileşikler neler?'
    ]
  }
};

function improvePromptFrontend(userPrompt) {
  let improvedPrompt = userPrompt.trim();
  
  // Çok kısa prompt'lar için minimal iyileştirme
  if (improvedPrompt.length < 20) {
    improvedPrompt += '?';
    return improvedPrompt;
  }
  
  // Soru işareti kontrolü
  if (!improvedPrompt.endsWith('?')) {
    improvedPrompt += '?';
  }
  
  // Sadece gerçekten karmaşık sorular için konu tespiti
  const detectedSubject = detectSubject(improvedPrompt);
  
  if (detectedSubject && detectedSubject !== 'general' && improvedPrompt.length > 100) {
    const rules = PROMPT_IMPROVEMENT_RULES[detectedSubject];
    if (rules && rules.improvements.length > 0) {
      // Sadece 1 iyileştirme ekle
      const relevantImprovement = rules.improvements[0];
      improvedPrompt += `\n\nLütfen ${relevantImprovement.toLowerCase()}.`;
    }
  }
  
  return improvedPrompt;
}

function detectSubject(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [subject, rules] of Object.entries(PROMPT_IMPROVEMENT_RULES)) {
    if (rules.keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return subject;
    }
  }
  
  return 'general';
}

async function getImageData(imageURL) {
  try {
    if (imageCache.has(imageURL)) {
      return imageCache.get(imageURL);
    }

    if (imageURL.startsWith('data:image')) {
      imageCache.set(imageURL, imageURL);
      return imageURL;
    }
    
    const response = await axios.get(imageURL, { 
      responseType: 'arraybuffer',
      timeout: 60000
    });
    const buffer = Buffer.from(response.data, 'binary');
    const base64 = buffer.toString('base64');
    
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    const result = `data:${mimeType};base64,${base64}`;
    
    imageCache.set(imageURL, result);
    
    return result;
  } catch (error) {
    console.error('Image processing error:', error);
    return null;
  }
}

async function getFastAIResponse(prompt, responseType, imageURL = null) {
  try {
    if (!API_KEY) {
      throw new Error('API key not found. Please check GEMINI_API_KEY environment variable.');
    }

    // Prompt analizi - basit mi karmaşık mı?
    const isSimpleQuestion = prompt.length < 50 && 
      !prompt.includes('?') && 
      !prompt.includes('nasıl') && 
      !prompt.includes('neden') &&
      !prompt.includes('açıkla') &&
      !prompt.includes('hesapla') &&
      !prompt.includes('çöz') &&
      !prompt.includes('formül');

    let promptText = '';
    
    if (isSimpleQuestion) {
      // Basit sorular için minimal prompt
      promptText = `"${prompt}" - Bu konuda yardımcı olabilir misin?`;
    } else {
      // Karmaşık sorular için sadece net cevap iste
      promptText = `"${prompt}" - Bu soruya net ve anlaşılır bir şekilde cevap ver.`;
    }

    const parts = [
      {
        text: promptText
      }
    ];

    // Eğer görsel varsa ekle
    if (imageURL) {
      const imageData = await getImageData(imageURL);
      if (imageData) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData.split(',')[1] // base64 kısmını al
          }
        });
      }
    }

    const data = {
      contents: [
        {
          parts: parts
        }
      ]
    };

    const response = await axios.post(BASE_URL, data, {
      timeout: 60000, // 60 saniye timeout
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      }
    });

    // Response kontrolü
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Gemini API\'den geçersiz yanıt alındı.');
    }

    const rawResponse = response.data.candidates[0].content.parts[0].text;
    
    // Response'u temizle ve kullanıcı dostu hale getir
    return cleanAIResponse(rawResponse);

  } catch (error) {
    console.error('Gemini API Hatası:', error.message);
    
    // Kullanıcı dostu hata mesajları
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      throw new Error('AI servisine bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
    }
    
    if (error.response?.status === 400) {
      throw new Error('Geçersiz istek. Lütfen sorunuzu kontrol edin.');
    }
    
    if (error.response?.status === 401) {
      throw new Error('AI servisi kimlik doğrulama hatası. Lütfen sistem yöneticisi ile iletişime geçin.');
    }
    
    if (error.response?.status === 429) {
      throw new Error('AI servisi şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.');
    }
    
    if (error.response?.status === 500) {
      throw new Error('AI servisi geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('AI yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin.');
    }
    
    // Genel hata
    throw new Error('AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
  }
}

// Prompt İyileştirici (görsel ile) - Eski versiyon (geriye uyumluluk)
async function optimizePrompt(userPrompt, imageURL = null) {
  try {
    // API key kontrolü
    if (!API_KEY) {
      throw new Error('API key not found.');
    }

    // Basit prompt'lar için sistem talimatı ekleme
    const isSimpleQuestion = userPrompt.length < 50 && 
      !userPrompt.includes('?') && 
      !userPrompt.includes('nasıl') && 
      !userPrompt.includes('neden') &&
      !userPrompt.includes('açıkla') &&
      !userPrompt.includes('hesapla');

    let promptText = '';
    
    if (isSimpleQuestion) {
      // Basit sorular için minimal prompt
      promptText = `"${userPrompt}" - Bu konuda yardımcı olabilir misin?`;
    } else {
      // Karmaşık sorular için sadece konu tespiti
      promptText = `"${userPrompt}" - Bu soruya net ve anlaşılır bir şekilde cevap ver.`;
    }

    const parts = [
      {
        text: promptText
      }
    ];

    // Eğer görsel varsa ekle
    if (imageURL) {
      const imageData = await getImageData(imageURL);
      if (imageData) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData.split(',')[1] // base64 kısmını al
          }
        });
      }
    }

    const data = {
      contents: [
        {
          parts: parts
        }
      ]
    };

    const response = await axios.post(BASE_URL, data, {
      timeout: 30000
    });

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from API.');
    }

    return response.data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error('Prompt optimization error:', error.message);
    throw new Error('Service is currently unavailable. Please try again later.');
  }
}

async function analyzeImage(imageURL, analysisType = 'general') {
  const imageData = await getImageData(imageURL);
  if (!imageData) {
    throw new Error('Image could not be processed');
  }

  let promptText = '';
  
  switch (analysisType) {
    case 'math':
      promptText = `Bu görseldeki matematik sorusunu analiz et ve şunları belirt:
1. Soru türü (cebir, geometri, analiz, vb.)
2. Verilen bilgiler
3. İstenen sonuç
4. Kullanılabilecek formüller/teoremler
5. Zorluk seviyesi (kolay/orta/zor)`;
      break;
    case 'physics':
      promptText = `Bu görseldeki fizik sorusunu analiz et ve şunları belirt:
1. Konu alanı (mekanik, elektrik, termodinamik, vb.)
2. Verilen değerler ve birimler
3. İstenen hesaplama
4. Kullanılabilecek formüller
5. Zorluk seviyesi`;
      break;
    case 'chemistry':
      promptText = `Bu görseldeki kimya sorusunu analiz et ve şunları belirt:
1. Konu alanı (organik, inorganik, analitik, vb.)
2. Verilen kimyasal bileşikler/reaksiyonlar
3. İstenen hesaplama/analiz
4. Kullanılabilecek formüller/kanunlar
5. Zorluk seviyesi`;
      break;
    default:
      promptText = `Bu görseldeki akademik soruyu analiz et ve şunları belirt:
1. Hangi ders/konu alanı
2. Soru türü
3. Verilen bilgiler
4. İstenen sonuç
5. Zorluk seviyesi`;
  }

  const data = {
    contents: [
      {
        parts: [
          {
            text: promptText
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData.split(',')[1]
            }
          }
        ]
      }
    ]
  };

  const response = await axios.post(BASE_URL, data);
  return response.data.candidates[0].content.parts[0].text;
}

async function getMentorResponse(prompt, imageURL = null) {
  return await getFastAIResponse(prompt, 'direct', imageURL);
}

// AI response'larını temizle ve kullanıcı dostu hale getir
function cleanAIResponse(response) {
  if (!response || typeof response !== 'string') {
    return response;
  }
  
  let cleanedResponse = response;
  
  // Sistem talimatlarını kaldır
  const systemInstructions = [
    'Bu soruya DETAYLI VE AÇIKLAYICI bir şekilde cevap ver:',
    '1. **Çözüm Adımları**:',
    '2. **Formüller/Teoremler**:',
    '3. **Neden Bu Yöntem**:',
    '4. **Alternatif Yöntemler**:',
    '5. **Kontrol**:',
    'Öğrencinin tam olarak anlayabilmesi için her detayı açıkla.',
    'Lütfen şunları da belirt:',
    'Bu konuda yardımcı olabilir misin?'
  ];
  
  systemInstructions.forEach(instruction => {
    cleanedResponse = cleanedResponse.replace(instruction, '');
  });
  
  // Fazla boşlukları temizle
  cleanedResponse = cleanedResponse.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleanedResponse = cleanedResponse.trim();
  
  // Eğer response çok kısaysa, orijinal response'u döndür
  if (cleanedResponse.length < 10) {
    return response;
  }
  
  return cleanedResponse;
}

module.exports = {
  optimizePrompt,
  getMentorResponse,
  analyzeImage,
  getFastAIResponse,
  improvePromptFrontend,
  cleanAIResponse,
  PROMPT_IMPROVEMENT_RULES
};
