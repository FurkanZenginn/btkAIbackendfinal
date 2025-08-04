const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./errorHandler').asyncHandler;

const protect = asyncHandler(async (req, res, next) => {
  let token;

  console.log('🔐 Auth Middleware Debug:');
  console.log('  - Authorization header:', req.headers.authorization ? 'EXISTS' : 'NOT EXISTS');
  console.log('  - Full headers:', Object.keys(req.headers));

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Token'ı al
      token = req.headers.authorization.split(' ')[1];
      console.log('  - Token extracted:', token ? 'EXISTS' : 'NOT EXISTS');

      // Token'ı doğrula
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('  - ✅ Token decoded:', decoded);
      console.log('  - Decoded ID:', decoded.id);
      console.log('  - Decoded ID type:', typeof decoded.id);

      // Kullanıcıyı bul
      const user = await User.findById(decoded.id).select('-password');
      console.log('  - User found:', user ? 'YES' : 'NO');
      
      if (user) {
        console.log('  - User ID:', user._id);
        console.log('  - User ID type:', typeof user._id);
        console.log('  - User toString():', user._id.toString());
      }

      // req.user'a ata
      req.user = user;
      console.log('  - ✅ req.user set:', req.user);
      console.log('  - req.user._id:', req.user?._id);
      console.log('  - req.user.id:', req.user?.id);

      next();
    } catch (error) {
      console.error('❌ Auth Middleware Error:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Yetkilendirme başarısız, token geçersiz'
      });
    }
  }

  if (!token) {
    console.log('❌ No token found');
    return res.status(401).json({
      success: false,
      error: 'Yetkilendirme başarısız, token bulunamadı'
    });
  }
});

const isAdmin = (req, res, next) => {
  console.log('🔐 isAdmin Middleware Debug:');
  console.log('  - req.user:', req.user);
  console.log('  - req.user.role:', req.user?.role);
  
  if (req.user && req.user.role === 'admin') {
    console.log('  - ✅ User is admin');
    next();
  } else {
    console.log('  - ❌ User is NOT admin or req.user is undefined');
    return res.status(403).json({
      success: false,
      error: 'Admin yetkisi gerekli'
    });
  }
};

module.exports = { protect, isAdmin }; 