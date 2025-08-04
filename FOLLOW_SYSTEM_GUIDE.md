# Follow Sistemi Rehberi

## 🔧 Backend Follow Sistemi

### Düzeltilen Sorunlar
1. ✅ **Feedback Model**: `follow_user` enum değeri eklendi
2. ✅ **Gamification Service**: `follow_user` tipi tanımlandı
3. ✅ **User Model**: `followersCount` ve `followingCount` alanları eklendi
4. ✅ **User Controller**: Follow/Unfollow mantığı düzeltildi

### Follow Endpoint'leri

#### 1. Takip Et/Takibi Bırak (Toggle)
```javascript
// POST /api/user/follow/:userId
// Authorization: Bearer token

fetch('/api/user/follow/64f1a2b3c4d5e6f7g8h9i0j1', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Response (Takip Etme):**
```json
{
  "success": true,
  "message": "Kullanıcı takip edildi.",
  "isFollowing": true
}
```

**Response (Takibi Bırakma):**
```json
{
  "success": true,
  "message": "Takip bırakıldı.",
  "isFollowing": false
}
```

#### 2. Kullanıcı Profili Getir
```javascript
// GET /api/user/:userId/profile
// Authorization: Bearer token

fetch('/api/user/64f1a2b3c4d5e6f7g8h9i0j1/profile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Kullanıcı Adı",
      "avatar": "https://...",
      "level": 5,
      "xp": 450,
      "followersCount": 25,
      "followingCount": 12,
      "isFollowing": true
    },
    "recentPosts": [...]
  }
}
```

#### 3. Takipçileri Getir
```javascript
// GET /api/user/:userId/followers?page=1&limit=20

fetch('/api/user/64f1a2b3c4d5e6f7g8h9i0j1/followers?page=1&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

#### 4. Takip Edilenleri Getir
```javascript
// GET /api/user/:userId/following?page=1&limit=20

fetch('/api/user/64f1a2b3c4d5e6f7g8h9i0j1/following?page=1&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Gamification Sistemi

#### Takip Etme Puanı
- **Puan**: 5 XP
- **Tip**: `follow_user`
- **Açıklama**: "Yeni kullanıcı takip ettin!"

#### Feedback Kaydı
```javascript
// Otomatik olarak oluşturulur
{
  userId: "follower_id",
  type: "follow_user",
  points: 5,
  description: "Yeni kullanıcı takip ettin!",
  metadata: {}
}
```

### Veritabanı Yapısı

#### User Model Güncellemeleri
```javascript
{
  // Mevcut alanlar...
  followers: [ObjectId], // Takipçiler
  following: [ObjectId], // Takip edilenler
  followersCount: Number, // Takipçi sayısı
  followingCount: Number  // Takip edilen sayısı
}
```

#### Feedback Model Güncellemeleri
```javascript
{
  type: {
    enum: [
      'post_created',
      'comment_added', 
      'post_liked',
      'comment_liked',
      'ai_used',
      'helpful_answer',
      'follow_user', // ✅ EKLENDİ
      'daily_login',
      'streak_milestone'
    ]
  }
}
```

### Frontend Örnekleri

#### React Native Follow Button
```javascript
const FollowButton = ({ userId, isFollowing, onToggle }) => {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleFollow = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/follow/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setFollowing(data.isFollowing);
        onToggle && onToggle(data.isFollowing);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleFollow}
      disabled={loading}
      style={[
        styles.button,
        following ? styles.following : styles.follow
      ]}
    >
      <Text style={styles.buttonText}>
        {loading ? '...' : following ? 'Takip Ediliyor' : 'Takip Et'}
      </Text>
    </TouchableOpacity>
  );
};
```

#### Web Follow Button
```javascript
const FollowButton = ({ userId, isFollowing, onToggle }) => {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleFollow = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/follow/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setFollowing(data.isFollowing);
        onToggle && onToggle(data.isFollowing);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleFollow}
      disabled={loading}
      className={`follow-button ${following ? 'following' : 'follow'}`}
    >
      {loading ? '...' : following ? 'Takip Ediliyor' : 'Takip Et'}
    </button>
  );
};
```

### Önemli Notlar

1. **Toggle Sistemi**: Aynı endpoint ile takip et/takibi bırak
2. **Gamification**: Sadece takip etme sırasında puan verilir
3. **Validation**: Kendini takip etme engeli var
4. **Counters**: `followersCount` ve `followingCount` otomatik güncellenir
5. **Authorization**: Tüm isteklerde Bearer token gerekli

### Test Endpoint'i

Follow sistemini test etmek için:
```javascript
// GET /api/test-follow-system
fetch('/api/test-follow-system')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Hata Kodları

| Hata | Açıklama |
|------|----------|
| `Kendinizi takip edemezsiniz.` | Kendini takip etme denemesi |
| `Kullanıcı bulunamadı.` | Geçersiz userId |
| `Takip işlemi sırasında hata oluştu` | Sunucu hatası |

### Debug Bilgileri

Backend'de detaylı log'lar yazdırılır:
- Follow request detayları
- Gamification puan ekleme
- Database güncellemeleri
- Hata detayları

Console'da bu log'ları takip edebilirsiniz. 