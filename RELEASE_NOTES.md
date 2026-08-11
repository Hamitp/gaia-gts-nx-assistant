# GAIA 0.1.0-review.2

Kilitli model bağlamlarında güvenli ilerleme ve görünür gezinme düzeltmesi.

- Çoklu analiz ve çoklu jeoteknik birim sihirbazı
- Tüm parametrelerde bağlam duyarlı, tekrarsız talep üretimi
- Uygun malzeme/koşul bulunmadığında tahmin yapmayan deney öneri motoru
- DOCX, PDF ve XLSX çıktılarında kanonik kimlik ve parite denetimi
- Atomik proje kaydı, imzalı bilgi paketi altyapısı ve sıkı Electron güven sınırı
- Windows NSIS kurulum ve taşınabilir paket
- İş ortamına uygun, özgün sinematik Gaia açılış görseli ve responsive iki panelli karşılama ekranı
- Doğrulanmış seçilebilir model bulunmadığında açık kullanıcı onayıyla “karar verisi talebi” oluşturma
- Uzun model listelerinde ve %100–%200 Windows ölçeklendirmesinde ekranda kalan sihirbaz gezinmesi
- Model karar veri paketinin GTS NX alanı olmadığını açıkça belirten, DOCX/PDF/XLSX içinde eş ham teslim ve sınırlama metinleri

Bu sürüm, arayüz ve iş akışı incelemesi içindir. Yerleşik bilgi paketi bağımsız insan geoteknik uzman tarafından satır düzeyinde onaylanmadığından bütün çıktılar **İNCELEME TASLAĞI** olarak işaretlenir; resmî tasarım veya saha deney programı yayımlamak için kullanılmamalıdır.

## Doğrulama

- 87/87 otomatik birim ve bileşen testi
- Normal model seçimi ve tüm modellerin kilitli olduğu konsolidasyon yolu için iki Electron uçtan uca testi
- DOCX/PDF/XLSX: kilitli model karar verisi dahil 27 gereksinim ve 13 deney kimliği; ham teslim, kullanım yeri ve sınırlama metinleri için geri-okuma paritesi
- Kurulu NSIS uygulaması ve taşınabilir EXE duman testleri
- Üretim bağımlılıkları dahil `npm audit`: 0 güvenlik açığı
