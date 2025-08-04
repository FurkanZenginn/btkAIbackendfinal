# Avatar Yükleme Rehberi

## 🔧 Backend Avatar Upload Sistemi

### Desteklenen Formatlar
- **PNG, JPG, JPEG, GIF** dosyaları
- **Maksimum dosya boyutu**: 10MB
- **Field name**: `avatar`

### Upload Endpoint'leri

#### 1. FormData ile Avatar Yükleme
```javascript
// PUT /api/user/profile
// Content-Type: multipart/form-data

const formData = new FormData();
formData.append('avatar', imageFile); // imageFile bir File objesi olmalı
formData.append('name', 'Kullanıcı Adı'); // Opsiyonel

fetch('/api/user/profile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

#### 2. Base64 ile Avatar Yükleme
```javascript
// PUT /api/user/profile-json
// Content-Type: application/json

const avatarData = {
  avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...', // Base64 string
  name: 'Kullanıcı Adı' // Opsiyonel
};

fetch('/api/user/profile-json', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(avatarData)
});
```

#### 3. File URL ile Avatar Yükleme (React Native)
```javascript
// PUT /api/user/profile-json
// Content-Type: application/json

const avatarData = {
  avatar: 'file:///path/to/image.png', // File URL
  name: 'Kullanıcı Adı' // Opsiyonel
};

fetch('/api/user/profile-json', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(avatarData)
});
```

### Response Format

#### Başarılı Response
```json
{
  "success": true,
  "data": {
    "_id": "user_id",
    "name": "Kullanıcı Adı",
    "email": "user@example.com",
    "avatar": "https://res.cloudinary.com/cloud_name/image/upload/v123/avatars/user_id_timestamp.jpg",
    "points": 100,
    "level": 5,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Hata Response
```json
{
  "success": false,
  "error": "Hata mesajı"
}
```

### Hata Kodları

| Hata | Açıklama |
|------|----------|
| `Dosya boyutu çok büyük (maksimum 10MB)` | Dosya 10MB'dan büyük |
| `Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF)` | Geçersiz dosya formatı |
| `Avatar yükleme hatası: ...` | Cloudinary upload hatası |
| `Beklenmeyen dosya alanı` | FormData field name yanlış |

### Test Endpoint'i

Avatar upload sistemini test etmek için:
```javascript
// POST /api/test-avatar-upload
// Content-Type: multipart/form-data

const formData = new FormData();
formData.append('avatar', imageFile);

fetch('/api/test-avatar-upload', {
  method: 'POST',
  body: formData
});
```

### Frontend Örnekleri

#### React Native (Expo ImagePicker)
```javascript
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    // FormData ile yükleme
    const formData = new FormData();
    formData.append('avatar', {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: 'avatar.jpg'
    });

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('Avatar yüklendi:', data.data.avatar);
      }
    } catch (error) {
      console.error('Avatar yükleme hatası:', error);
    }
  }
};
```

#### Web (File Input)
```javascript
const handleAvatarUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Avatar yüklendi:', data.data.avatar);
    }
  } catch (error) {
    console.error('Avatar yükleme hatası:', error);
  }
};
```

### Önemli Notlar

1. **Field Name**: FormData'da field name `avatar` olmalı
2. **Authorization**: Tüm isteklerde Bearer token gerekli
3. **Content-Type**: FormData için otomatik, JSON için manuel ayarlanmalı
4. **File Size**: Maksimum 10MB
5. **Image Format**: PNG, JPG, JPEG, GIF desteklenir
6. **Cloudinary**: Yüklenen dosyalar Cloudinary'de saklanır
7. **Optimization**: Yüklenen resimler 400x400 boyutuna optimize edilir

### Debug Bilgileri

Backend'de detaylı log'lar yazdırılır:
- Dosya bilgileri (boyut, tip, isim)
- Upload süreci
- Cloudinary response
- Hata detayları

Console'da bu log'ları takip edebilirsiniz. 