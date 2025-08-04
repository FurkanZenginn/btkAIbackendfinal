const HapBilgi = require('../models/HapBilgi');

const seedHapBilgiler = async () => {
  try {
    // Mevcut hap bilgileri kontrol et
    const count = await HapBilgi.countDocuments();
    if (count > 0) {
      console.log('Hap bilgiler zaten mevcut, seed atlanıyor...');
      return;
    }

    const hapBilgiler = [
      {
        topic: 'Trigonometri',
        title: 'Sinüs ve Kosinüs Temelleri',
        content: 'Sinüs ve kosinüs fonksiyonları, bir açının karşı kenarının hipotenüse oranı (sinüs) ve komşu kenarın hipotenüse oranı (kosinüs) olarak tanımlanır.',
        category: 'matematik',
        difficulty: 'orta',
        tags: ['trigonometri', 'sinüs', 'kosinüs', 'açı', 'üçgen'],
        examples: [
          {
            question: '30° açısının sinüs değeri nedir?',
            solution: 'sin(30°) = 1/2 = 0.5'
          },
          {
            question: '60° açısının kosinüs değeri nedir?',
            solution: 'cos(60°) = 1/2 = 0.5'
          }
        ],
        tips: [
          '30°-60°-90° üçgeninde sin(30°) = 1/2, cos(60°) = 1/2',
          '45°-45°-90° üçgeninde sin(45°) = cos(45°) = √2/2',
          'Birim çemberde sinüs y-koordinatı, kosinüs x-koordinatıdır'
        ],
        relatedTopics: ['Tanjant', 'Kotanjant', 'Birim Çember', 'Ters Trigonometrik Fonksiyonlar']
      },
      {
        topic: 'Asit-Baz',
        title: 'pH ve pOH Hesaplama',
        content: 'pH = -log[H+] formülü ile hesaplanır. pOH = -log[OH-] ve pH + pOH = 14 ilişkisi vardır.',
        category: 'kimya',
        difficulty: 'orta',
        tags: ['asit', 'baz', 'pH', 'pOH', 'konsantrasyon'],
        examples: [
          {
            question: '[H+] = 0.001 M olan çözeltinin pH\'ı nedir?',
            solution: 'pH = -log(0.001) = -log(10^-3) = 3'
          },
          {
            question: 'pH = 5 olan çözeltinin [H+] konsantrasyonu nedir?',
            solution: '[H+] = 10^(-pH) = 10^(-5) = 0.00001 M'
          }
        ],
        tips: [
          'pH < 7 asidik, pH = 7 nötr, pH > 7 bazik',
          'pH değeri 1 azalırsa [H+] 10 kat artar',
          'Güçlü asitler tamamen iyonlaşır, zayıf asitler kısmen iyonlaşır'
        ],
        relatedTopics: ['Tampon Çözeltiler', 'Nötralleşme', 'İndikatörler', 'Tuzlar']
      },
      {
        topic: 'Newton Kanunları',
        title: 'Hareket Kanunları',
        content: 'Newton\'un üç hareket kanunu: 1) Eylemsizlik, 2) Kuvvet ve ivme, 3) Etki-tepki prensibi.',
        category: 'fizik',
        difficulty: 'orta',
        tags: ['newton', 'kuvvet', 'hareket', 'ivme', 'eylemsizlik'],
        examples: [
          {
            question: 'Durgun bir cisme 10N kuvvet uygulanırsa ivmesi ne olur? (m=2kg)',
            solution: 'F = ma → 10 = 2a → a = 5 m/s²'
          },
          {
            question: 'Sürtünmesiz yüzeyde 5 m/s² ivme ile hareket eden 3kg\'lık cisme uygulanan kuvvet nedir?',
            solution: 'F = ma = 3 × 5 = 15 N'
          }
        ],
        tips: [
          'Birinci kanun: Durgun cisim durgun kalır, hareketli cisim sabit hızla hareket eder',
          'İkinci kanun: F = ma (kuvvet = kütle × ivme)',
          'Üçüncü kanun: Her etkiye eşit ve zıt tepki vardır'
        ],
        relatedTopics: ['Sürtünme', 'Enerji', 'Momentum', 'Yerçekimi']
      },
      {
        topic: 'Fotosentez',
        title: 'Bitkilerde Enerji Üretimi',
        content: 'Fotosentez, bitkilerin güneş ışığını kullanarak CO₂ ve H₂O\'dan glikoz ve O₂ üretmesidir.',
        category: 'biyoloji',
        difficulty: 'orta',
        tags: ['fotosentez', 'bitki', 'enerji', 'klorofil', 'glikoz'],
        examples: [
          {
            question: 'Fotosentez denklemi nedir?',
            solution: '6CO₂ + 6H₂O + ışık → C₆H₁₂O₆ + 6O₂'
          },
          {
            question: 'Fotosentez hangi organelde gerçekleşir?',
            solution: 'Kloroplast organelinde gerçekleşir'
          }
        ],
        tips: [
          'Klorofil pigmenti ışığı emer',
          'Işık reaksiyonları ve karanlık reaksiyonlar olmak üzere 2 aşamalıdır',
          'Oksijen gazı yan ürün olarak açığa çıkar'
        ],
        relatedTopics: ['Solunum', 'Klorofil', 'Kloroplast', 'Glikoz']
      }
    ];

    await HapBilgi.insertMany(hapBilgiler);
    console.log(`${hapBilgiler.length} adet hap bilgi eklendi!`);

  } catch (error) {
    console.error('Hap bilgi seed hatası:', error);
  }
};

module.exports = { seedHapBilgiler }; 