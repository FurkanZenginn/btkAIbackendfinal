const NodeCache = require('node-cache');

// In-memory cache (Redis yerine geçici çözüm) - Optimized
const cache = new NodeCache({ 
  stdTTL: 600, // 10 dakika default (daha uzun cache)
  checkperiod: 120, // 2 dakikada bir temizlik (daha az sıklık)
  maxKeys: 500, // Daha az key (memory için)
  useClones: false // Clone yapma - daha hızlı
});

// Cache key oluşturma
const createCacheKey = (prefix, params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
};

// Cache get
const getCached = (key) => {
  return cache.get(key);
};

// Cache set
const setCached = (key, data, ttl = 300) => {
  return cache.set(key, data, ttl);
};

// Cache delete
const deleteCached = (key) => {
  return cache.del(key);
};

// Cache flush (tüm cache'i temizle)
const flushCache = () => {
  return cache.flushAll();
};

// Cache stats
const getCacheStats = () => {
  return cache.getStats();
};

// Cache keys
const getCacheKeys = () => {
  return cache.keys();
};

// Post cache işlemleri - Ultra Optimized
const getCachedPosts = async (key, fetchFunction) => {
  const cached = getCached(key);
  if (cached) {
    return cached;
  }
  
  const data = await fetchFunction();
  setCached(key, data, 600); // 10 dakika cache (çok daha uzun)
  return data;
};

// Akıllı cache temizleme
const smartCacheClear = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
  console.log(`🧹 Cleared ${matchingKeys.length} cache keys for pattern: ${pattern}`);
};

// Hap bilgi cache işlemleri
const getCachedHapBilgi = async (key, fetchFunction) => {
  const cached = getCached(key);
  if (cached) {
    console.log('Hap bilgi cache hit:', key);
    return cached;
  }
  
  console.log('Hap bilgi cache miss:', key);
  const data = await fetchFunction();
  setCached(key, data, 600); // 10 dakika cache (hap bilgi daha az değişir)
  return data;
};

module.exports = {
  createCacheKey,
  getCached,
  setCached,
  deleteCached,
  flushCache,
  getCacheStats,
  getCacheKeys,
  getCachedPosts,
  getCachedHapBilgi,
  smartCacheClear
}; 