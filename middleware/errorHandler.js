const { AppError } = require('../utils/AppError');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Geçersiz ID formatı';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Bu değer zaten kullanılıyor';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Geçersiz token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token süresi doldu';
    error = { message, statusCode: 401 };
  }

  // Rate limit errors
  if (err.statusCode === 429) {
    const message = 'Çok fazla istek, lütfen daha sonra tekrar deneyin';
    error = { message, statusCode: 429 };
  }

  // AI service errors
  if (err.message && err.message.includes('AI')) {
    const message = 'AI servisi geçici olarak kullanılamıyor';
    error = { message, statusCode: 503 };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'Dosya boyutu çok büyük (maksimum 10MB)';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Beklenmeyen dosya alanı';
    error = { message, statusCode: 400 };
  }

  if (err.message && err.message.includes('Sadece resim dosyaları')) {
    const message = 'Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF)';
    error = { message, statusCode: 400 };
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Sunucu hatası';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async error wrapper - SOLID ve Clean Code uyumlu
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Response helper - Tutarlı response formatı
const sendResponse = (res, statusCode, success, data = null, message = null) => {
  const response = { success };
  
  if (data !== null) response.data = data;
  if (message !== null) response.message = message;
  
  res.status(statusCode).json(response);
};

// Success response helpers
const sendSuccess = (res, data = null, message = null) => {
  sendResponse(res, 200, true, data, message);
};

const sendCreated = (res, data = null, message = null) => {
  sendResponse(res, 201, true, data, message);
};

// Error response helpers
const sendError = (res, statusCode, message) => {
  sendResponse(res, statusCode, false, null, message);
};

// Not found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFound,
  sendResponse,
  sendSuccess,
  sendCreated,
  sendError
}; 