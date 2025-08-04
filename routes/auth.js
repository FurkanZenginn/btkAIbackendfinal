const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// Kayıt endpointi
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email ve şifre zorunludur.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ 
      error: 'Bu email zaten kayıtlı.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ 
      message: 'Kayıt başarılı! Hoş geldiniz! 🎉',
      showAlert: true,
      alertType: 'success',
      alertDuration: 4000,
      redirect: '/login'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: 'Kayıt sırasında hata oluştu.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });
  }
});

// Giriş endpointi
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email ve şifre zorunludur.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ 
      error: 'Kullanıcı bulunamadı.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ 
      error: 'Şifre hatalı.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ 
      token,
      message: 'Giriş başarılı! Hoş geldiniz! 👋',
      showAlert: true,
      alertType: 'success',
      alertDuration: 4000,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        level: user.level,
        xp: user.xp
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: 'Giriş sırasında hata oluştu.',
      showAlert: true,
      alertType: 'error',
      alertDuration: 4000
    });
  }
});

module.exports = router;