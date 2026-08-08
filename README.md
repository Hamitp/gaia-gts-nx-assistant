# GAIA

GAIA, GTS NX ile yapılacak bir veya birden fazla geoteknik analiz için ihtiyaç duyulan parametreleri, deney yollarını ve ham veri teslimlerini tek bir talep paketinde birleştiren çevrimdışı Windows masaüstü uygulamasıdır.

## Güncel durum

Bu depo `0.1.0-review.1` inceleme sürümüdür. Yerleşik bilgi paketi bağımsız geoteknik uzman tarafından satır düzeyinde onaylanmadığı için bütün çıktılar `İNCELEME TASLAĞI` olarak üretilir. Uygulama parametre değeri hesaplamaz, korelasyon sonucu üretmez ve eksik mühendislik kararını sessiz varsayımla tamamlamaz.

Review sürümünde yalnız doğrulanmış çekirdek Elastic ve Mohr–Coulomb model seçimleri açıktır; kısmi ve kilitli katalog modelleri incelenebilir fakat seçilemez. Bu sürüm resmî tasarım veya saha deney programı yayımlamak için kullanılmamalıdır.

## Öne çıkanlar

- Aynı projede çoklu analiz ve çoklu jeoteknik birim seçimi
- Parametre, drenaj, dayanım seviyesi, gerilme yolu, yön, şekil değiştirme aralığı ve numune koşuluna göre anlamsal tekilleştirme
- Aynı anlamdaki ortak parametrelerin tek talepte; farklı pik/kritik/rezidüel koşulların ayrı alt gereksinimlerde tutulması
- Zemin/kaya ve mühendislik bağlamına göre birincil deney seçimi; uygun yöntem yoksa fail-closed davranış
- Her parametre için Türkçe açıklama, resmî GTS NX alan adı, ham veri ve sınırlama notları
- Tek kanonik sonuçtan DOCX, PDF ve XLSX üretimi; kimlik ve SHA-256 denetim izi
- Atomik `.gaia` proje kaydı, Ed25519 imzalı `.gaia-kb` paket altyapısı ve güvenli Electron sınırı
- Telemetri, bulut bağımlılığı veya haricî API yok

## Geliştirme

Gereksinimler: Node.js 22.12+ ve Windows paketleme için Windows 10/11.

```powershell
npm ci
npm run verify
npm run test:exports
npm run dist:win
```

`npm run verify`, birim/bileşen testleri, TypeScript/Vite derlemesi ve Electron kullanıcı akışı testini çalıştırır. `npm run test:exports`, DOCX/PDF/XLSX kimlik ve gereksinim→deney paritesini dosyaları geri okuyarak doğrular.

## Bilgi paketi güven modeli

Üretim onayı uygulama arayüzünden verilemez. Onaylı bir `.gaia-kb` paketi; canonical payload özeti, uyumluluk aralığı, uzman kapsamı ve uygulamaya gömülü güvenilen Ed25519 anahtarıyla doğrulanmalıdır. Geçersiz içe aktarım etkin paketi değiştirmez.

## Kaynak ve marka notu

GTS NX ve MIDAS adları ilgili hak sahiplerinin ticari markalarıdır. Bu proje MIDAS tarafından desteklenmez veya onaylanmaz. Kullanıcıya ait kılavuz PDF/DOCX/XLSX dosyaları telif ve gizlilik nedeniyle bu depoya dahil edilmez.

## Lisans

[MIT](LICENSE). Mühendislik verisi ve bilgi paketi içeriği için ayrıca uzman doğrulaması ve ilgili standartların kullanım koşulları gerekir.
