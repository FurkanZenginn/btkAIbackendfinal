const User = require('../models/User');
const Post = require('../models/Post');
const { addPoints } = require('../services/gamificationService');
const { notifyFollow } = require('../services/notificationService');
const { asyncHandler, sendSuccess, sendError } = require('../middleware/errorHandler');
const { NotFoundError, ValidationError } = require('../utils/AppError');

// GET /api/user/profile - Kendi profilini getir
const getProfile = asyncHandler(async (req, res) => {
  console.log('🔍 Get Profile Debug:');
  console.log('  - req.user:', req.user);
  
  const userId = req.user._id || req.user.id;
  console.log('  - userId:', userId);
  
  const user = await User.findById(userId)
    .populate('followers', 'name avatar')
    .populate('following', 'name avatar');

  if (!user) {
    console.log('  - ❌ User bulunamadı');
    throw new NotFoundError('Kullanıcı');
  }

  console.log('  - ✅ User bulundu:', user.name);
  
  // Frontend'in beklediği format: { user: {...}, stats: {...} }
  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        points: user.xp, // Frontend points bekliyor
        level: user.level,
        createdAt: user.createdAt
      },
      stats: {
        postsCreated: user.stats?.postsCreated || 0,
        commentsAdded: user.stats?.commentsAdded || 0,
        aiInteractions: user.stats?.aiInteractions || 0,
        points: user.xp, // Stats içinde de points
        level: user.level, // Stats içinde de level
        followersCount: user.followersCount || 0, // Virtual field kullan
        followingCount: user.followingCount || 0  // Virtual field kullan
      }
    }
  });
});

// PUT /api/user/profile - Profil güncelle
const updateProfile = asyncHandler(async (req, res) => {
  console.log('🔧 Profile Update Debug:');
  console.log('  - req.user:', req.user);
  console.log('  - req.user._id:', req.user?._id);
  console.log('  - req.user.id:', req.user?.id);
  console.log('  - req.user type:', typeof req.user);
  console.log('  - req.body:', req.body);
  console.log('  - req.file:', req.file);
  
  // userId'yi farklı yollarla almayı dene
  let userId = null;
  
  if (req.user) {
    userId = req.user._id || req.user.id;
    console.log('  - userId from req.user:', userId);
    console.log('  - userId type:', typeof userId);
  }
  
  // req.body undefined kontrolü - hem FormData hem JSON için
  let name = null;
  let avatarPath = null;
  
  if (req.body) {
    name = req.body.name;
    avatarPath = req.body.avatar;
    console.log('  - name from req.body:', name);
    console.log('  - avatarPath from req.body:', avatarPath);
  } else {
    console.log('  - ❌ req.body is undefined!');
  }
  
  const avatarFile = req.file;
  console.log('  - avatarFile:', avatarFile ? 'EXISTS' : 'NOT EXISTS');
  
  if (!userId) {
    console.log('  - ❌ userId is null/undefined!');
    return res.status(400).json({
      success: false,
      error: 'Kullanıcı ID bulunamadı'
    });
  }
  
  console.log('  - ✅ Final userId:', userId);
  
  // Kullanıcıyı bul
  const user = await User.findById(userId);

  if (!user) {
    console.log('  - ❌ User bulunamadı');
    throw new NotFoundError('Kullanıcı');
  }

  console.log('  - ✅ User bulundu:', user.name);

  // Validation
  if (name && (name.length < 2 || name.length > 50)) {
    console.log('  - ❌ Name validation failed');
    throw new ValidationError('İsim 2-50 karakter arasında olmalıdır');
  }

  // Güncelleme verilerini hazırla
  const updateData = {};
  if (name) updateData.name = name;

  // Avatar işlemi - Geliştirilmiş versiyon
  if (avatarFile) {
    // Multer ile gelen dosya
    try {
      console.log('📁 Avatar file detected:', {
        originalName: avatarFile.originalname,
        mimetype: avatarFile.mimetype,
        size: avatarFile.size,
        fieldname: avatarFile.fieldname
      });
      
      const { uploadToCloudinary } = require('../middleware/uploadMiddleware');
      const avatarUrl = await uploadToCloudinary(avatarFile.buffer, {
        folder: 'avatars',
        public_id: `user_${userId}_${Date.now()}`
      });
      
      updateData.avatar = avatarUrl;
      console.log('  - ✅ Avatar Cloudinary\'ye yüklendi (file):', avatarUrl);
    } catch (uploadError) {
      console.error('  - ❌ Avatar upload hatası (file):', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Avatar yükleme hatası: ' + uploadError.message
      });
    }
  } else if (avatarPath) {
    // Avatar path kontrolü
    if (avatarPath.startsWith('data:image/')) {
      // Base64 image data
      try {
        console.log('📤 Base64 avatar detected, size:', avatarPath.length);
        
        const { uploadBase64ToCloudinary } = require('../middleware/uploadMiddleware');
        const avatarUrl = await uploadBase64ToCloudinary(avatarPath, {
          folder: 'avatars',
          public_id: `user_${userId}_${Date.now()}`
        });
        
        updateData.avatar = avatarUrl;
        console.log('  - ✅ Avatar Cloudinary\'ye yüklendi (base64):', avatarUrl);
      } catch (uploadError) {
        console.error('  - ❌ Avatar upload hatası (base64):', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Avatar yükleme hatası: ' + uploadError.message
        });
      }
    } else if (avatarPath.startsWith('file://')) {
      // File:// URL'den dosya okuma (React Native için)
      try {
        console.log('📁 File:// URL detected:', avatarPath);
        
        const fs = require('fs');
        const path = require('path');
        
        // File:// URL'den dosya yolunu çıkar
        const filePath = avatarPath.replace('file://', '');
        
        // Dosyayı oku
        const fileBuffer = fs.readFileSync(filePath);
        
        console.log('📊 File read, size:', fileBuffer.length);
        
        const { uploadToCloudinary } = require('../middleware/uploadMiddleware');
        const avatarUrl = await uploadToCloudinary(fileBuffer, {
          folder: 'avatars',
          public_id: `user_${userId}_${Date.now()}`
        });
        
        updateData.avatar = avatarUrl;
        console.log('  - ✅ Avatar Cloudinary\'ye yüklendi (file://):', avatarUrl);
      } catch (uploadError) {
        console.error('  - ❌ Avatar upload hatası (file://):', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Avatar yükleme hatası: ' + uploadError.message
        });
      }
    } else if (avatarPath.startsWith('http')) {
      // HTTP URL - direkt kullan
      updateData.avatar = avatarPath;
      console.log('  - ✅ Avatar URL kullanıldı:', avatarPath);
    } else {
      console.log('  - ⚠️ Unknown avatar path format:', avatarPath);
    }
  }

  // Kullanıcıyı güncelle
  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Profil güncellendi:', updatedUser.name);
    
    // Frontend'in beklediği format: { success: true, data: updatedUser }
    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        points: updatedUser.xp,
        level: updatedUser.level,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Profil güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Profil güncellenirken hata oluştu'
    });
  }
});

// POST /api/user/follow/:userId - Kullanıcı takip et/bırak (toggle)
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    console.log('🔍 Follow request:', { followerId, userId });

    // Kendini takip etmeyi engelle
    if (followerId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Kendinizi takip edemezsiniz.'
      });
    }

    // Her iki kullanıcıyı da bul
    const follower = await User.findById(followerId);
    const userToFollow = await User.findById(userId);

    if (!follower || !userToFollow) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı.'
      });
    }

    // Zaten takip ediliyor mu kontrol et
    const isFollowing = follower.following.includes(userId);

    if (isFollowing) {
      // UNFOLLOW - Takibi bırak
      console.log('🔄 Unfollowing...');
      
      // 1. Follower'ın following array'ini güncelle
      follower.following = follower.following.filter(id => id.toString() !== userId);
      
      // 2. Followed user'ın followers array'ini güncelle
      userToFollow.followers = userToFollow.followers.filter(id => id.toString() !== followerId);
      
      // 3. Her iki kullanıcıyı da kaydet
      await Promise.all([follower.save(), userToFollow.save()]);
      
      console.log('✅ Unfollowed successfully');
      
      return res.json({
        success: true,
        message: 'Takip bırakıldı.',
        isFollowing: false,
        data: {
          followerFollowingCount: follower.followingCount,
          userFollowersCount: userToFollow.followersCount
        }
      });
    } else {
      // FOLLOW - Takip et
      console.log('🔄 Following...');
      
      // 1. Follower'ın following array'ine ekle
      follower.following.push(userId);
      
      // 2. Followed user'ın followers array'ine ekle
      userToFollow.followers.push(followerId);
      
      // 3. Her iki kullanıcıyı da kaydet
      await Promise.all([follower.save(), userToFollow.save()]);

      // 4. Puan ekle (hata olursa devam et)
      try {
        await addPoints(followerId, 'follow_user', 'Kullanıcı takip etme');
      } catch (pointsError) {
        console.warn('Puan ekleme başarısız, takip işlemi devam ediyor:', pointsError.message);
      }

      console.log('✅ Followed successfully');
      
      return res.json({
        success: true,
        message: 'Kullanıcı takip edildi.',
        isFollowing: true,
        data: {
          followerFollowingCount: follower.followingCount,
          userFollowersCount: userToFollow.followersCount
        }
      });
    }

  } catch (error) {
    console.error('Takip etme hatası:', error);
    return res.status(500).json({
      success: false,
      error: 'Takip işlemi sırasında hata oluştu'
    });
  }
};

// DELETE /api/user/follow/:userId - Kullanıcı takibi bırak (alternatif endpoint)
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const userToUnfollow = await User.findById(userId);
    const currentUser = await User.findById(currentUserId);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Takip ediliyor mu kontrol et
    if (!currentUser.following.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bu kullanıcıyı takip etmiyorsunuz'
      });
    }

    // Takibi bırak - Virtual field'lar otomatik hesaplanır
    currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
    userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== currentUserId.toString());

    await currentUser.save();
    await userToUnfollow.save();

    // Puan ekle (unfollow için)
    try {
      await addPoints(currentUserId, 'unfollow_user', 'Kullanıcı takibi bırakma');
    } catch (pointsError) {
      console.warn('Puan ekleme başarısız, unfollow işlemi devam ediyor:', pointsError.message);
    }

    res.json({
      success: true,
      message: 'Kullanıcı takibi bırakıldı',
      data: {
        following: currentUser.followingCount,
        followers: userToUnfollow.followersCount
      }
    });

  } catch (error) {
    console.error('Takip bırakma hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Takip bırakma işlemi sırasında hata oluştu'
    });
  }
};

// GET /api/user/:userId/profile - Başka kullanıcının profilini görüntüle
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(userId)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Takip durumunu kontrol et
    const isFollowing = user.followers.some(follower => follower._id.toString() === currentUserId.toString());

    // Kullanıcının son postlarını getir
    const recentPosts = await Post.find({ userId, isModerated: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name avatar');

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar,
          level: user.level,
          xp: user.xp,
          stats: user.stats,
          followers: user.followers,
          following: user.following,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          createdAt: user.createdAt
        },
        isFollowing,
        recentPosts
      }
    });

  } catch (error) {
    console.error('Kullanıcı profili getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Kullanıcı profili alınırken hata oluştu'
    });
  }
};

// GET /api/user/following/posts - Takip edilen kullanıcıların postları
const getFollowingPosts = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Takip edilen kullanıcıların postlarını getir
    const posts = await Post.find({
      userId: { $in: currentUser.following },
      isModerated: true
    })
      .populate('userId', 'name avatar')
      .populate('hapBilgiAnalysis.relatedHapBilgiler.hapBilgiId', 'topic title content category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      userId: { $in: currentUser.following },
      isModerated: true
    });

    res.json({
      success: true,
      data: {
        posts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Takip edilen postlar getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Takip edilen postlar alınırken hata oluştu'
    });
  }
};

// GET /api/user/:userId/posts - Kullanıcının tüm postları
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({
      userId,
      isModerated: true
    })
      .populate('userId', 'name avatar')
      .populate('hapBilgiAnalysis.relatedHapBilgiler.hapBilgiId', 'topic title content category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      userId,
      isModerated: true
    });

    res.json({
      success: true,
      data: {
        posts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Kullanıcı postları getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Kullanıcı postları alınırken hata oluştu'
    });
  }
};

// GET /api/user/:userId/followers - Kullanıcının takipçilerini getir
const getUserFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Takipçileri getir
    const followers = await User.find({
      _id: { $in: user.followers }
    })
      .select('name avatar level xp')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = user.followers.length;

    res.json({
      success: true,
      data: {
        followers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Takipçiler getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Takipçiler alınırken hata oluştu'
    });
  }
};

// GET /api/user/:userId/following - Kullanıcının takip ettiklerini getir
const getUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Takip edilenleri getir
    const following = await User.find({
      _id: { $in: user.following }
    })
      .select('name avatar level xp')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = user.following.length;

    res.json({
      success: true,
      data: {
        following,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Takip edilenler getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Takip edilenler alınırken hata oluştu'
    });
  }
};

// GET /api/user/search - Kullanıcı arama
const searchUsers = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Arama terimi gerekli'
    });
  }

  const searchQuery = q.trim();
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Arama sorgusu - sadece name alanında arama yap
  const query = {
    name: { $regex: searchQuery, $options: 'i' }
  };

  // Mevcut kullanıcıyı sonuçlardan hariç tut
  query._id = { $ne: req.user._id };

  const users = await User.find(query)
    .select('_id name avatar xp level followersCount followingCount createdAt')
    .limit(limitNumber)
    .skip(skip)
    .sort({ name: 1 });

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
        totalUsers: total,
        hasNextPage: skip + limitNumber < total,
        hasPrevPage: pageNumber > 1
      }
    }
  });
});

// Test endpoint - Follow sistemi test etmek için
const testFollowSystem = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const user = await User.findById(userId);
    const currentUser = await User.findById(currentUserId);

    if (!user || !currentUser) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    const isFollowing = currentUser.following.includes(userId);

    res.json({
      success: true,
      data: {
        currentUser: {
          _id: currentUser._id,
          name: currentUser.name,
          followingCount: currentUser.followingCount,
          followersCount: currentUser.followersCount,
          following: currentUser.following.length,
          followers: currentUser.followers.length,
          followingArray: currentUser.following,
          followersArray: currentUser.followers
        },
        targetUser: {
          _id: user._id,
          name: user.name,
          followingCount: user.followingCount,
          followersCount: user.followersCount,
          following: user.following.length,
          followers: user.followers.length,
          followingArray: user.following,
          followersArray: user.followers
        },
        isFollowing,
        followStatus: isFollowing ? 'Takip ediliyor' : 'Takip edilmiyor',
        debug: {
          currentUserFollowingIds: currentUser.following,
          targetUserFollowersIds: user.followers,
          checkResult: currentUser.following.includes(userId)
        }
      }
    });

  } catch (error) {
    console.error('Follow sistemi test hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Test sırasında hata oluştu'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getUserProfile,
  getFollowingPosts,
  getUserPosts,
  getUserFollowers,
  getUserFollowing,
  searchUsers,
  testFollowSystem
}; 