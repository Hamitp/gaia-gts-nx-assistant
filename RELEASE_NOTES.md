# GAIA 0.1.0-review.1

İlk kamuya açık inceleme sürümü.

- Çoklu analiz ve çoklu jeoteknik birim sihirbazı
- Tüm parametrelerde bağlam duyarlı, tekrarsız talep üretimi
- Uygun malzeme/koşul bulunmadığında tahmin yapmayan deney öneri motoru
- DOCX, PDF ve XLSX çıktılarında kanonik kimlik ve parite denetimi
- Atomik proje kaydı, imzalı bilgi paketi altyapısı ve sıkı Electron güven sınırı
- Windows NSIS kurulum ve taşınabilir paket

Bu sürüm, arayüz ve iş akışı incelemesi içindir. Yerleşik bilgi paketi bağımsız insan geoteknik uzman tarafından satır düzeyinde onaylanmadığından bütün çıktılar **İNCELEME TASLAĞI** olarak işaretlenir; resmî tasarım veya saha deney programı yayımlamak için kullanılmamalıdır.

## Doğrulama

- 87/87 otomatik birim ve bileşen testi
- Electron uçtan uca sihirbaz testi
- DOCX/PDF/XLSX: 15 gereksinim ve 10 deney kimliği için geri-okuma paritesi
- Kurulu NSIS uygulaması ve taşınabilir EXE duman testleri
- Üretim bağımlılıkları dahil `npm audit`: 0 güvenlik açığı
