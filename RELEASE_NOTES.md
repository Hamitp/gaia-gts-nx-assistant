# GAIA 0.1.0-review.4

Tekrarsız parametre ve deney talebi, sade uzman inceleme akışı ve kayıpsız numune/protokol ayrımı.

- Çoklu analiz ve çoklu jeoteknik birim sihirbazı
- Tüm katalog parametrelerinde genel gereksinimi tek ve açık daha belirli mühendislik anlamına güvenle birleştiren; pik/rezidüel gibi farklı anlamları ayrı tutan talep motoru
- Uygun malzeme/koşul bulunmadığında tahmin yapmayan deney öneri motoru
- DOCX, PDF ve XLSX çıktılarında parametreyi tek başlıkta, deney yöntemini tek satırda gösteren; farklı numune/protokol, öncelik ve birim eşleşmelerini alt uygulamalar olarak koruyan çıktı düzeni
- Görünür iş emri, teknik parametre matrisi ve deney programı arasında kanonik kimlik, protokol ve parite denetimi
- Atomik proje kaydı, imzalı bilgi paketi altyapısı ve sıkı Electron güven sınırı
- Windows NSIS kurulum ve taşınabilir paket
- İş ortamına uygun, özgün sinematik Gaia açılış görseli ve responsive iki panelli karşılama ekranı
- Doğrulanmış seçilebilir model bulunmadığında açık kullanıcı onayıyla “karar verisi talebi” oluşturma
- Uzun model listelerinde ve %100–%200 Windows ölçeklendirmesinde ekranda kalan sihirbaz gezinmesi
- Model karar veri paketinin GTS NX alanı olmadığını açıkça belirten, DOCX/PDF/XLSX içinde eş ham teslim ve sınırlama metinleri
- Koşul kapatıldığında otomatik eklenen yapım aşaması, arayüz veya kazık hesabını ve eski model kararlarını temizleyen senkronizasyon
- Dinamik yük etkin fakat dinamik hesap türü eksikse Analizler adımına açık yönlendirme
- Çoklu analiz ve çoklu tabakada birimin açık model kararlarını tek eylemle güvenli karar-verisi talebine dönüştürme
- Tek eylemle DOCX, PDF ve XLSX oluşturma; tamamlanınca çıktı klasörünü açma

Bu sürüm, arayüz ve iş akışı incelemesi içindir. Yerleşik bilgi paketi bağımsız insan geoteknik uzman tarafından satır düzeyinde onaylanmadığından bütün çıktılar **İNCELEME TASLAĞI** olarak işaretlenir; resmî tasarım veya saha deney programı yayımlamak için kullanılmamalıdır.

## Doğrulama

- 155/155 otomatik birim ve bileşen testi
- Normal model seçimi ve tüm modellerin kilitli olduğu konsolidasyon yolu için iki Electron uçtan uca testi
- DOCX/PDF/XLSX: çoklu analiz ve kazık kapsamlı örnekte 31 mühendislik alt koşulu, 28 benzersiz parametre ve 12 kanonik deney/protokol; ham teslim, kullanım yeri, sınırlama, yöntem tekilliği ve protokol görünürlüğü için geri-okuma paritesi
- Kurulu NSIS uygulaması ve taşınabilir EXE duman testleri
- Üretim bağımlılıkları dahil `npm audit`: 0 güvenlik açığı
