# Tems Call Flow Analyzer

Tems log dosyalarını analiz etmek ve call flow'ları görselleştirmek için geliştirilmiş modern web uygulaması.

## Özellikler

### 📊 Call Flow Analizi
- **Görsel Call Flow Diagramı**: Mesajlaşma akışını adım adım görselleştirme
- **Paging İşlemleri**: Paging mesajlarını özel görseller ile gösterme
- **Zaman Analizi**: Mesajlar arası geçen süreleri hesaplama
- **Hata Tespiti**: Otomatik hata mesajı tespit ve vurgulama

### 🔍 Gelişmiş Filtreleme
- **Protokol Filtresi**: Paging, Call Setup, Handover, Location Update, Authentication, SMS
- **Mesaj Tipi Filtresi**: Request, Response, Indication, Complete
- **Kaynak/Hedef Filtresi**: Belirli node'lar arası iletişimi görme
- **Zaman Aralığı Filtresi**: Belirli zaman dilimindeki mesajları görme

### 📈 İstatistikler ve Raporlama
- **Gerçek Zamanlı İstatistikler**: Mesaj sayıları, protokol dağılımı
- **Hata Analizi**: Tespit edilen hataların detaylı analizi
- **Performans Metrikleri**: Yanıt süreleri ve sistem performansı
- **CSV Export**: Filtrelenmiş verileri dışa aktarma

### 🎨 Modern Arayüz
- **Responsive Tasarım**: Mobil ve desktop uyumlu
- **Dark/Light Theme**: Kullanıcı tercihi
- **Zoom Kontrolleri**: Diagramları büyütme/küçültme
- **Interaktif Elementler**: Mesaj detaylarını görme

## Kurulum

### Gereksinimler
- Python 3.8+
- pip (Python package manager)

### Adım 1: Projeyi İndirin
```bash
git clone <repository-url>
cd LogViewer
```

### Adım 2: Virtual Environment Oluşturun (Önerilen)
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Adım 3: Bağımlılıkları Yükleyin
```bash
pip install -r requirements.txt
```

### Adım 4: Uygulamayı Başlatın
```bash
python app.py
```

Uygulama `http://localhost:5000` adresinde çalışmaya başlayacaktır.

## Kullanım

### 1. Log Dosyası Yükleme
- Sol paneldeki "Log Dosyası Yükle" bölümünden `.log` veya `.txt` dosyanızı seçin
- "Yükle ve Analiz Et" butonuna tıklayın
- Sistem otomatik olarak dosyayı parse edecek ve analiz edecektir

### 2. Call Flow Diagramını İnceleme
- **Call Flow Diagramı** sekmesinde mesajlaşma akışını görün
- Her adım numaralandırılmış ve renklendirilmiştir:
  - 🔵 **Mavi**: Paging mesajları
  - 🟢 **Yeşil**: Call Setup mesajları
  - 🟡 **Sarı**: Handover mesajları
  - 🔴 **Kırmızı**: Hata mesajları
- Zoom kontrolleri ile diagramı büyütüp küçültebilirsiniz
- Herhangi bir adıma tıklayarak detaylarını görebilirsiniz

### 3. Mesajları Filtreleme
- Sol paneldeki filtre seçeneklerini kullanın:
  - **Protokol Tipi**: Sadece belirli protokol mesajlarını göster
  - **Mesaj Tipi**: Request, Response vb. tiplerini filtrele
  - **Kaynak/Hedef**: Belirli node'lar arası iletişimi görüntüle
- "Filtreleri Uygula" butonuna tıklayın
- "Filtreleri Temizle" ile tüm filtreleri kaldırın

### 4. Detaylı Mesaj Listesi
- **Mesaj Listesi** sekmesinde tüm mesajları tablo formatında görün
- Herhangi bir satıra tıklayarak mesaj detaylarını açın
- "Dışa Aktar" butonu ile filtrelenmiş verileri CSV formatında indirin

### 5. Analiz Sonuçları
- **Analiz Sonuçları** sekmesinde:
  - **Timing Analizi**: Toplam süre ve ortalama yanıt süreleri
  - **Hata Analizi**: Tespit edilen hatalar ve açıklamaları
  - **Sistem Önerileri**: Performans iyileştirme önerileri

## Desteklenen Log Formatları

Uygulama aşağıdaki Tems log formatlarını destekler:

```
2024-01-15 10:30:25.123 PAGING Request From: BSC_001 To: MSC_001
2024-01-15 10:30:25.145 PAGING Response From: MSC_001 To: BSC_001
2024-01-15 10:30:25.200 CALL_SETUP Request From: MSC_001 To: BSC_001
```

### Otomatik Tanınan Alanlar:
- **Timestamp**: `YYYY-MM-DD HH:MM:SS.mmm` formatı
- **Protocol Type**: PAGING, CALL_SETUP, HANDOVER, LOCATION_UPDATE, AUTH, SMS
- **Message Type**: Request, Response, Indication, Complete, Challenge, Deliver
- **Source/Destination**: From:/To: alanları
- **Transaction ID**: TID, TransactionId, Transaction_ID
- **Parameters**: IMSI, TMSI, LAI, CI, MSISDN, MCC, MNC, LAC, CellId

## Teknik Detaylar

### Proje Yapısı
```
LogViewer/
├── app.py                 # Ana Flask uygulaması
├── tems_parser.py         # Log parsing ve analiz modülü
├── requirements.txt       # Python bağımlılıkları
├── templates/
│   └── index.html        # Ana HTML template
├── static/
│   ├── css/
│   │   └── style.css     # CSS stilleri
│   └── js/
│       └── app.js        # JavaScript uygulaması
└── uploads/              # Geçici dosya yükleme klasörü
```

### API Endpoints
- `GET /` - Ana sayfa
- `POST /upload` - Log dosyası yükleme
- `POST /api/analyze` - Call flow analizi
- `POST /api/filter` - Mesaj filtreleme

### Teknolojiler
- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6
- **Charts**: Chart.js (gelecek sürümlerde)

## Geliştirme

### Debug Modu
```bash
export FLASK_ENV=development
python app.py
```

### Yeni Özellik Ekleme
1. `tems_parser.py` - Yeni parsing logic'i
2. `app.py` - Yeni API endpoint'leri
3. `static/js/app.js` - Frontend functionality
4. `templates/index.html` - UI elementleri

## Sorun Giderme

### Yaygın Sorunlar

**1. Dosya yüklenmiyor**
- Dosya formatının `.log` veya `.txt` olduğundan emin olun
- Dosya boyutunun 50MB'dan küçük olduğunu kontrol edin
- Dosya encoding'inin UTF-8 olduğunu kontrol edin

**2. Mesajlar parse edilmiyor**
- Log formatının desteklenen formatta olduğunu kontrol edin
- Timestamp formatının doğru olduğunu kontrol edin
- Console'da hata mesajlarını kontrol edin

**3. Performans sorunları**
- Büyük dosyalar için filtreleme kullanın
- Browser cache'ini temizleyin
- Zoom seviyesini düşürün

### Log Seviyeleri
- **INFO**: Normal işlem logları
- **WARNING**: Uyarı mesajları
- **ERROR**: Hata mesajları
- **DEBUG**: Detaylı debug bilgileri

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## İletişim

Sorularınız için:
- GitHub Issues kullanın
- Email: [your-email@example.com]

---

**Not**: Bu uygulama Tems log dosyalarını analiz etmek için geliştirilmiştir. Gerçek network operasyonlarında kullanmadan önce test ortamında doğrulayın.