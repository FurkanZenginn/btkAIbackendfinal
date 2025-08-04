const NodeCache = require('node-cache');

// Cache instance'ı oluştur (5 dakika TTL)
const cache = new NodeCache({ stdTTL: 300 });

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Cache key oluştur
    const key = `__express__${req.originalUrl || req.url}`;
    
    // Cache'den kontrol et
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Orijinal send metodunu sakla
    const originalSend = res.json;
    
    // Send metodunu override et
    res.json = function(body) {
      // Response'u cache'e kaydet
      cache.set(key, body, duration);
      
      // Orijinal send metodunu çağır
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Cache temizleme fonksiyonu
const clearCache = (pattern = null) => {
  if (pattern) {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    cache.del(matchingKeys);
  } else {
    cache.flushAll();
  }
};

// Cache istatistikleri
const getCacheStats = () => {
  return cache.getStats();
};

module.exports = {
  cacheMiddleware,
  clearCache,
  getCacheStats,
  cache
}; 