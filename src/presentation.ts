export interface AnalysisPurpose {
  id: string;
  title: string;
  question: string;
  explanation: string;
  example: string;
  analysisIds: string[];
  extraScope?: boolean;
}

export interface AnalysisChoiceCopy {
  title: string;
  chooseWhen: string;
  outcome: string;
}

export const analysisPurposes: AnalysisPurpose[] = [
  {
    id: "deformation",
    title: "Oturma ve deplasman",
    question: "Yapı ve zemin yük altında ne kadar hareket edecek?",
    explanation: "Temel, istinat yapısı, tünel veya kazı çevresindeki gerilme ve yer değiştirmeleri incelemek için.",
    example: "Temel oturması, duvar deplasmanı, tünel çevresi deformasyonu",
    analysisIds: ["linear-static", "nonlinear-static"],
  },
  {
    id: "construction",
    title: "Kazı ve yapım sırası",
    question: "İmalat adımları ilerledikçe zemin ve yapı nasıl değişecek?",
    explanation: "Kazı, dolgu, destek, tünel açımı veya yükleme sırasının etkisini adım adım görmek için.",
    example: "Kademeli kazı, iksa kurulumu, dolgu serimi, tünel ilerlemesi",
    analysisIds: ["construction-stage"],
  },
  {
    id: "stability",
    title: "Göçme ve stabilite güvenliği",
    question: "Şev, kazı veya dolgu göçmeye karşı yeterince güvenli mi?",
    explanation: "Kritik kayma yüzeyini ve güvenlik düzeyini değerlendirmek için.",
    example: "Doğal şev, derin kazı, dolgu baraj, geçici kazı yüzü",
    analysisIds: ["strength-reduction", "stress-analysis-method"],
  },
  {
    id: "seepage",
    title: "Yeraltı suyu akışı",
    question: "Su nereden nereye akacak ve boşluk suyu basıncı nasıl değişecek?",
    explanation: "Sızma, kaldırma basıncı, drenaj ve zamana bağlı su hareketini değerlendirmek için.",
    example: "Baraj altı sızma, kazı drenajı, su seviyesi değişimi",
    analysisIds: ["steady-seepage", "transient-seepage"],
  },
  {
    id: "coupled",
    title: "Su ve deformasyon birlikte",
    question: "Su basıncı değişirken zemin ne kadar şekil değiştirecek?",
    explanation: "Akım ve mekanik davranışın birbirini etkilediği problemler için.",
    example: "Hızlı su seviyesi düşümü, susuzlaştırma, doygun zeminde yükleme",
    analysisIds: ["sequential-coupled", "fully-coupled"],
  },
  {
    id: "consolidation",
    title: "Zamana bağlı oturma",
    question: "Oturma ne kadar sürede oluşacak?",
    explanation: "Özellikle doygun ince daneli zeminlerde boşluk suyu basıncı sönümünü ve oturma hızını bulmak için.",
    example: "Dolgu altında kil tabakası, ön yükleme, uzun dönem temel oturması",
    analysisIds: ["consolidation"],
  },
  {
    id: "dynamic",
    title: "Deprem ve tekrarlı yükler",
    question: "Zemin deprem, makine veya hareketli yük altında nasıl davranacak?",
    explanation: "Doğal titreşim, deprem talebi, zaman tanım alanı ve çevrimsel zemin davranışı için.",
    example: "Deprem, tren yükü, makine temeli, sıvılaşma hassasiyeti",
    analysisIds: ["eigenvalue", "response-spectrum", "linear-time-history-modal", "linear-time-history-direct", "nonlinear-time-history", "equivalent-linear-2d", "nonlinear-time-history-srm"],
  },
  {
    id: "interaction",
    title: "Kazık, arayüz ve donatı etkisi",
    question: "Zemin ile kazık, yapı yüzeyi veya geosentetik arasındaki etkileşim gerekli mi?",
    explanation: "Bunlar tek başına hesap amacı değildir; seçtiğiniz analize eklenen özel modelleme kapsamıdır.",
    example: "Kazık-zemin, duvar-zemin teması, geogrid donatılı dolgu",
    analysisIds: ["pile-soil", "interface", "reinforced-soil"],
    extraScope: true,
  },
];

export const analysisChoiceCopy: Record<string, AnalysisChoiceCopy> = {
  "linear-static": { title: "Hızlı elastik kontrol", chooseWhen: "Küçük deformasyon ve geri dönen davranış kabulü yeterliyse", outcome: "Gerilme ve deplasmanın ilk kontrolünü verir." },
  "nonlinear-static": { title: "Gerçekçi kalıcı deformasyon", chooseWhen: "Zemin dayanımı, plastikleşme veya kalıcı şekil değişimi önemliyse", outcome: "Yük arttıkça değişen zemin davranışını izler." },
  "construction-stage": { title: "Yapım aşamalarını sırayla incele", chooseWhen: "Kazı, dolgu, destek veya yükleme adımları sonuçları değiştiriyorsa", outcome: "Her imalat adımından sonraki durumu verir." },
  "strength-reduction": { title: "Güvenlik katsayısını doğrudan bul", chooseWhen: "Şev veya kazı stabilitesinin güvenlik düzeyi isteniyorsa", outcome: "Dayanımı azaltarak göçme sınırını arar." },
  "stress-analysis-method": { title: "Mevcut gerilme durumuyla stabilite kontrolü", chooseWhen: "Gerilme alanı üzerinden uzman değerlendirmesi yapılacaksa", outcome: "Hesaplanan gerilmeleri dayanımla karşılaştırır." },
  "steady-seepage": { title: "Sabit su akışı", chooseWhen: "Su seviyeleri ve akım koşulları zamanla değişmiyorsa", outcome: "Dengelenmiş su basıncı ve akım alanını verir." },
  "transient-seepage": { title: "Zamanla değişen su akışı", chooseWhen: "Yağış, pompalama veya su seviyesi değişimi zamana bağlıysa", outcome: "Su basıncının zaman içindeki değişimini verir." },
  "sequential-coupled": { title: "Akım ve deformasyonu ardışık çöz", chooseWhen: "Su hesabı ile mekanik hesabı adımlar halinde bağlamak yeterliyse", outcome: "Bir çözümün sonucunu diğerine aktarır." },
  "fully-coupled": { title: "Akım ve deformasyonu eşzamanlı çöz", chooseWhen: "Su basıncı ve deformasyon birbirini güçlü biçimde etkiliyorsa", outcome: "İki davranışı aynı anda çözer." },
  consolidation: { title: "Konsolidasyon ve oturma süresi", chooseWhen: "Doygun ince daneli zeminde uzun dönem oturma önemliyse", outcome: "Oturma miktarı ile oluşma süresini verir." },
  eigenvalue: { title: "Doğal titreşim biçimleri", chooseWhen: "Yapı-zemin sisteminin doğal periyotları aranıyorsa", outcome: "Doğal frekans ve mod şekillerini verir." },
  "response-spectrum": { title: "Deprem spektrumu ile talep", chooseWhen: "Tasarım spektrumu üzerinden doğrusal deprem hesabı yapılacaksa", outcome: "Modları birleştirerek deprem etkilerini verir." },
  "linear-time-history-modal": { title: "Doğrusal zaman tanım alanı · modal", chooseWhen: "Kayıt boyunca doğrusal yanıt ve modal çözüm yeterliyse", outcome: "Zamana bağlı tepkiyi modlar üzerinden verir." },
  "linear-time-history-direct": { title: "Doğrusal zaman tanım alanı · doğrudan", chooseWhen: "Kayıt boyunca doğrusal yanıt doğrudan integrasyonla aranıyorsa", outcome: "Her zaman adımındaki doğrusal tepkiyi verir." },
  "nonlinear-time-history": { title: "Doğrusal olmayan zaman tanım alanı", chooseWhen: "Kalıcı deformasyon ve doğrusal olmayan çevrimsel davranış önemliyse", outcome: "Zaman boyunca doğrusal olmayan tepkiyi verir." },
  "equivalent-linear-2d": { title: "2B eşdeğer doğrusal zemin tepkisi", chooseWhen: "Tabakalı zeminde deprem dalgası yayılımı eşdeğer doğrusal yaklaşımla incelenecekse", outcome: "Rijitlik ve sönümü şekil değiştirmeye göre yineleyerek hesaplar." },
  "nonlinear-time-history-srm": { title: "SRM ile doğrusal olmayan dinamik", chooseWhen: "Dinamik göçme güvenliği uzman modeliyle değerlendirilecekse", outcome: "Dayanım azaltmayı zaman tanım alanıyla birleştirir." },
  "pile-soil": { title: "Kazık-zemin etkileşimi", chooseWhen: "Kazıkların zemine yük aktarımı modelleniyorsa", outcome: "Kazık ve çevre zeminin birlikte davranmasını temsil eder." },
  interface: { title: "Zemin-yapı arayüzü", chooseWhen: "Duvar, temel veya kaplamada kayma/ayrılma önemliyse", outcome: "Temas yüzeyindeki bağıl hareketi temsil eder." },
  "reinforced-soil": { title: "Donatılı zemin", chooseWhen: "Geogrid veya benzeri donatılar kullanılıyorsa", outcome: "Zemin ile donatının birlikte çalışmasını temsil eder." },
};

export const modelDecisionCopy: Record<string, { summary: string; chooseWhen: string; caution: string }> = {
  elastic: {
    summary: "Zeminin yük kalkınca büyük ölçüde eski şekline döndüğü kabul edilir.",
    chooseWhen: "Ön kontrol, küçük deformasyon veya doğrusal davranış kabulü yeterliyse",
    caution: "Göçme ve kalıcı zemin deformasyonunu temsil etmez.",
  },
  "mohr-coulomb": {
    summary: "Zeminin bir dayanım sınırına ulaştıktan sonra kalıcı şekil değiştirmesine izin verir.",
    chooseWhen: "Genel amaçlı zemin hesabında dayanım ve kalıcı deformasyon önemliyse",
    caution: "Rijitliğin gerilme ve şekil değiştirmeye bağlı değişimini ayrıntılı temsil etmez.",
  },
};

export const plainLevelCopy: Record<string, string> = {
  required: "Mutlaka gerekli",
  conditional: "Koşula bağlı",
  recommended: "Kaliteyi artırır",
  "missing-decision": "Önce karar veya ölçüm gerekli",
};
