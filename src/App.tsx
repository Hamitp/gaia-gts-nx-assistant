import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  CloudOff,
  Download,
  Droplets,
  FileArchive,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderOpen,
  Gauge,
  Info,
  Layers3,
  Menu,
  Mountain,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { analyses, builtInKnowledge, catalogueIndex, models, parameters, tests } from "./data/catalogue";
import type {
  CanonicalResult,
  ConsolidatedRequirement,
  GaiaProject,
  GroundUnit,
  KnowledgePackage,
  RequirementLevel,
  SoilType,
} from "./domain/types";
import { buildCanonicalResult } from "./engine/result";
import { recommendModels } from "./engine/recommend";
import { analysisChoiceCopy, analysisPurposes, modelDecisionCopy, plainLevelCopy } from "./presentation";

const steps = [
  { label: "Proje", hint: "Temel bilgiler", icon: FileText },
  { label: "Analizler", hint: "Bir veya daha fazla", icon: Gauge },
  { label: "Birimler", hint: "Zemin ve kaya", icon: Layers3 },
  { label: "Koşullar", hint: "Su ve drenaj", icon: Droplets },
  { label: "Modeller", hint: "Gerekçeli seçim", icon: Sparkles },
  { label: "Talep", hint: "Tekrarsız sonuç", icon: ClipboardCheck },
];

const purposeIcons: Record<string, typeof Gauge> = {
  deformation: Gauge,
  construction: Layers3,
  stability: Mountain,
  seepage: Droplets,
  coupled: Waves,
  consolidation: Layers3,
  dynamic: Waves,
  interaction: ShieldCheck,
};

const linkedConditionAnalyses = { constructionStages: "construction-stage", interfacePresent: "interface", pilePresent: "pile-soil" } as const;
const dynamicAnalysisIds = new Set(analyses.filter((analysis) => analysis.group === "Dinamik").map((analysis) => analysis.id));

const soilOptions: { value: SoilType; label: string; hint: string }[] = [
  { value: "unknown", label: "Henüz bilinmiyor", hint: "Karar için veri eksik olarak işaretlenir" },
  { value: "fill", label: "Dolgu", hint: "Doğal olmayan yerleştirilmiş malzeme" },
  { value: "gravel", label: "Çakıl", hint: "İri daneli, çakıl baskın" },
  { value: "sand", label: "Kum", hint: "İri daneli, kum baskın" },
  { value: "silt", label: "Silt", hint: "Düşük plastisiteli ince daneli" },
  { value: "clay", label: "Kil", hint: "Plastik ince daneli" },
  { value: "organic", label: "Organik zemin", hint: "Turba veya organik içerikli" },
  { value: "residual", label: "Rezidüel zemin", hint: "Yerinde ayrışmış zemin" },
  { value: "weak-rock", label: "Zayıf kaya", hint: "Zemin-kaya geçişi" },
  { value: "rock-mass", label: "Kaya kütlesi", hint: "Süreksizlik etkili kaya" },
  { value: "jointed-rock", label: "Eklemli kaya", hint: "Belirgin süreksizlik takımları" },
];

const emptyUnit = (index = 1): GroundUnit => ({
  id: `GU-${nanoid(7)}`,
  name: `Jeoteknik Birim ${index}`,
  soilType: "unknown",
  description: "",
  saturation: "unknown",
  consolidationState: "unknown",
  cyclicRisk: "unknown",
});

function newProject(knowledge: KnowledgePackage): GaiaProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    id: `GAIA-${nanoid(10)}`,
    name: "Yeni proje",
    location: "",
    client: "",
    description: "",
    coordinateSystem: "",
    verticalDatum: "",
    selectedAnalysisIds: [],
    groundUnits: [emptyUnit()],
    conditions: {
      groundwater: "unknown",
      drainageDecision: "unknown",
      constructionStages: false,
      dynamicLoading: false,
      interfacePresent: false,
      pilePresent: false,
    },
    confirmedModelIds: {},
    deferredModelContexts: [],
    createdAt: now,
    updatedAt: now,
    knowledgeVersion: knowledge.manifest.version,
    knowledgePackageId: knowledge.manifest.packageId,
    knowledgeDigest: knowledge.manifest.payloadSha256,
  };
}

const levelCopy: Record<RequirementLevel, { label: string; className: string; description: string }> = {
  required: { label: "Zorunlu", className: "badge-required", description: "Seçilen analiz veya model için doğrudan gerekli." },
  conditional: { label: "Koşullu", className: "badge-conditional", description: "Belirtilen saha veya analiz koşulu oluşursa gerekli." },
  recommended: { label: "Önerilen", className: "badge-recommended", description: "Kaliteyi ve karar güvenini artırır." },
  "missing-decision": { label: "Karar için veri eksik", className: "badge-missing", description: "Sessiz varsayım yapılmadı; bu karar tamamlanmalı." },
};

function GaiaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`gaia-mark ${compact ? "compact" : ""}`} aria-label="GAIA">
      <div className="mark-orbit"><span /></div>
      <div>
        <strong>GAIA</strong>
        {!compact && <small>Geoteknik Veri Talep Asistanı</small>}
      </div>
    </div>
  );
}

function TerrainArt() {
  return (
    <div className="terrain-art" aria-hidden="true">
      <svg viewBox="0 0 760 510" role="img">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#133d4b" />
            <stop offset="1" stopColor="#071c29" />
          </linearGradient>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0" stopColor="#c9a763" stopOpacity=".15" />
            <stop offset=".5" stopColor="#e9c77d" stopOpacity=".9" />
            <stop offset="1" stopColor="#c9a763" stopOpacity=".05" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="9" /></filter>
        </defs>
        <rect width="760" height="510" rx="36" fill="url(#sky)" />
        <circle cx="548" cy="130" r="86" fill="#65dfcf" opacity=".12" filter="url(#glow)" />
        <circle cx="548" cy="130" r="47" fill="none" stroke="#e3c47f" strokeWidth="1.5" opacity=".8" />
        <circle cx="548" cy="130" r="31" fill="none" stroke="#65dfcf" opacity=".4" />
        <path d="M57 245 C160 190 226 225 310 172 C392 121 430 203 503 183 C586 160 648 186 725 135" fill="none" stroke="#75d8cc" strokeWidth="2" opacity=".72" />
        <path d="M57 259 C160 204 226 239 310 186 C392 135 430 217 503 197 C586 174 648 200 725 149" fill="none" stroke="#75d8cc" opacity=".22" />
        <path d="M0 284 C94 259 143 272 234 247 C322 223 360 260 461 221 C575 177 649 220 760 190 L760 510 L0 510Z" fill="#153f47" />
        <path d="M0 328 C103 297 166 333 267 298 C364 265 458 327 552 285 C635 248 698 276 760 249 L760 510 L0 510Z" fill="#17625f" opacity=".72" />
        <path d="M0 374 C96 344 181 377 273 346 C391 307 446 378 563 337 C652 306 703 326 760 303 L760 510 L0 510Z" fill="#2b7f75" opacity=".78" />
        <path d="M0 417 C98 393 189 420 296 394 C411 366 493 417 593 387 C665 366 720 374 760 360 L760 510 L0 510Z" fill="#d9d2bc" opacity=".92" />
        <path d="M0 463 C139 441 226 471 353 449 C474 428 600 466 760 428 L760 510 L0 510Z" fill="#b79b68" opacity=".9" />
        {[74, 132, 191, 249, 308, 366, 425, 483, 542, 600, 659, 717].map((x, i) => (
          <g key={x} opacity={i % 2 ? .42 : .72}>
            <line x1={x} y1="256" x2={x - 18} y2="452" stroke="#f1d79b" strokeWidth="1" />
            <circle cx={x - 18} cy="452" r="2.7" fill="#f4db9c" />
          </g>
        ))}
        <path d="M36 302 C193 274 252 316 394 277 C507 247 633 279 736 240" fill="none" stroke="url(#gold)" strokeWidth="2" />
      </svg>
      <div className="terrain-caption"><span>Katmanı anla</span><span>Doğru veriyi iste</span></div>
    </div>
  );
}

function Landing({ onNew, onOpen, installedVersion }: { onNew: () => void; onOpen: () => void; installedVersion: string | null }) {
  return (
    <main className="landing-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="landing-copy">
        <GaiaMark />
        <div className="eyebrow"><span /> Yeryüzünün verisini tasarıma dönüştür</div>
        <h1>Zemini doğru anlamak,<br /><em>doğru soruyla başlar.</em></h1>
        <p className="landing-lead">Analizlerinizi ve jeoteknik birimlerinizi seçin. GAIA, GTS NX için gereken parametreleri, deneyleri ve ham teslimleri tekrarsız bir talep paketinde toplasın.</p>
        <div className="landing-actions">
          <button className="button button-primary button-xl" onClick={onNew}><FilePlus2 size={20} /> Yeni proje <ArrowRight size={18} /></button>
          <button className="button button-ghost button-xl" onClick={onOpen}><FolderOpen size={20} /> Projeyi aç</button>
        </div>
        <div className="trust-row">
          <span><CloudOff size={15} /> Tamamen çevrimdışı</span>
          <span><ShieldCheck size={15} /> Değer uydurmaz</span>
          <span><BookOpen size={15} /> Kaynak izlenebilir</span>
        </div>
        {installedVersion && <div className="installed-pill"><CheckCircle2 size={14} /> Bu bilgisayarda GTS NX {installedVersion} algılandı</div>}
        <footer className="landing-footer">GAIA <span>•</span> Bilgi paketi {builtInKnowledge.manifest.version} <span>•</span> İnceleme sürümü</footer>
      </section>
      <section className="landing-visual" aria-label="Kaya katmanlarının içinden yükselen Gaia gravürü">
        <div className="gaia-hero" role="img" aria-label="Toprak, kökler ve kaya tabakalarıyla bütünleşen Gaia" />
        <div className="hero-status"><Sparkles size={17} /><div><small>GEOTEKNİK KARAR OMURGASI</small><strong>Katmanı anla · doğru veriyi iste</strong></div></div>
        <div className="floating-card floating-one"><span className="float-icon"><FlaskConical size={18} /></span><div><strong>Deney programı</strong><small>Standart + ham teslim</small></div><Check size={16} /></div>
        <div className="floating-card floating-two"><span className="float-icon"><Layers3 size={18} /></span><div><strong>Tekrarsız talepler</strong><small>Tüm analizler, tek liste</small></div><Check size={16} /></div>
        <div className="hero-inscription"><span>ΓΑΙΑ</span><div><strong>Toprağın belleğini oku.</strong><small>Kararı varsayıma değil, kanıta bağla.</small></div></div>
      </section>
    </main>
  );
}

function StepRail({ active, maxReached, onStep, canAccess }: { active: number; maxReached: number; onStep: (step: number) => void; canAccess: (step: number) => boolean }) {
  return (
    <aside className="step-rail">
      <GaiaMark compact />
      <nav aria-label="Proje adımları">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const enabled = index <= maxReached && canAccess(index);
          return (
            <button key={step.label} disabled={!enabled} className={`step-link ${active === index ? "active" : ""} ${index < maxReached ? "done" : ""}`} onClick={() => enabled && onStep(index)} aria-current={active === index ? "step" : undefined}>
              <span className="step-index">{index < maxReached ? <Check size={15} /> : <Icon size={17} />}</span>
              <span><strong>{step.label}</strong><small>{step.hint}</small></span>
              {active === index && <ChevronRight size={16} className="step-chevron" />}
            </button>
          );
        })}
      </nav>
      <div className="rail-note"><ShieldCheck size={18} /><div><strong>Güvenli çalışma</strong><p>GAIA değer hesaplamaz ve eksik kararlarda sessiz varsayım yapmaz.</p></div></div>
    </aside>
  );
}

function TopBar({ project, knowledge, installedVersion, onHome, onSave, onImport }: {
  project: GaiaProject;
  knowledge: KnowledgePackage;
  installedVersion: string | null;
  onHome: () => void;
  onSave: () => void;
  onImport: () => void;
}) {
  const approved = knowledge.manifest.expertReview.status === "approved";
  return (
    <header className="topbar">
      <button className="project-crumb" onClick={onHome}><span>{project.name || "Adsız proje"}</span><small>{project.location || "Konum eklenmedi"}</small></button>
      <div className="topbar-spacer" />
      {installedVersion && <span className="version-chip">GTS NX {installedVersion}</span>}
      <span className={`review-chip ${approved ? "approved" : ""}`} title={approved ? "Uzman onaylı bilgi paketi" : "Bağımsız uzman onayı bekleniyor"}>{approved ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{approved ? "Onaylı bilgi" : "İnceleme bilgisi"}</span>
      <button className="button button-quiet" onClick={onImport}><Upload size={16} /> Bilgi paketi</button>
      <button className="button button-quiet" onClick={onSave}><Save size={16} /> Kaydet</button>
    </header>
  );
}

function SectionIntro({ eyebrow, title, text, aside }: { eyebrow: string; title: string; text: string; aside?: React.ReactNode }) {
  return (
    <div className="section-intro">
      <div><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>
      {aside}
    </div>
  );
}

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function ProjectStep({ project, update }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void }) {
  return (
    <div className="step-content">
      <SectionIntro eyebrow="01 · Başlangıç" title="Projeyi tanıyalım" text="Bu bilgiler resmî talep dokümanının kapağında ve izlenebilirlik bölümünde kullanılacak." />
      <div className="form-card project-form">
        <Field label="Proje adı" hint="Örn. Kuzey İskele Güçlendirmesi"><input value={project.name} onChange={(e) => update({ name: e.target.value })} autoFocus /></Field>
        <Field label="İşveren / müşteri"><input value={project.client} onChange={(e) => update({ client: e.target.value })} placeholder="Kurum veya şirket" /></Field>
        <Field label="Proje konumu"><input value={project.location} onChange={(e) => update({ location: e.target.value })} placeholder="İl, ilçe, saha" /></Field>
        <Field label="Koordinat sistemi" hint="Bilmiyorsanız boş bırakın; sonuçta kritik uyarı çıkar."><input value={project.coordinateSystem} onChange={(e) => update({ coordinateSystem: e.target.value })} placeholder="Örn. ITRF96 / 3° TM30" /></Field>
        <Field label="Düşey datum" hint="Su seviyesi ve birim sınırları aynı datuma bağlanır."><input value={project.verticalDatum} onChange={(e) => update({ verticalDatum: e.target.value })} placeholder="Örn. TUDKA / yerel röper" /></Field>
        <Field label="Kısa proje açıklaması" wide><textarea value={project.description} onChange={(e) => update({ description: e.target.value })} placeholder="Yapı türü, beklenen kazı/dolgu, özel saha koşulları…" rows={4} /></Field>
      </div>
      <div className="helper-strip"><Info size={18} /><div><strong>Bilmiyorsanız tahmin etmeyin.</strong><span>Eksik bırakılan kritik bilgiler GAIA tarafından açıkça işaretlenir ve çıktıya uyarı olarak eklenir.</span></div></div>
    </div>
  );
}

function AnalysesStep({ project, update }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void }) {
  const selectedPurpose = analysisPurposes.find((purpose) => purpose.analysisIds.some((id) => project.selectedAnalysisIds.includes(id)));
  const [openPurpose, setOpenPurpose] = useState(selectedPurpose?.id ?? analysisPurposes[0].id);
  const toggle = (id: string) => {
    const selectedAnalysisIds = project.selectedAnalysisIds.includes(id) ? project.selectedAnalysisIds.filter((item) => item !== id) : [...project.selectedAnalysisIds, id];
    const validContexts = new Set(selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => `${analysisId}:${unit.id}`)));
    update({
      selectedAnalysisIds,
      conditions: {
        ...project.conditions,
        constructionStages: selectedAnalysisIds.includes(linkedConditionAnalyses.constructionStages),
        interfacePresent: selectedAnalysisIds.includes(linkedConditionAnalyses.interfacePresent),
        pilePresent: selectedAnalysisIds.includes(linkedConditionAnalyses.pilePresent),
        dynamicLoading: selectedAnalysisIds.some((analysisId) => dynamicAnalysisIds.has(analysisId)),
      },
      confirmedModelIds: Object.fromEntries(Object.entries(project.confirmedModelIds).filter(([key]) => validContexts.has(key))),
      deferredModelContexts: project.deferredModelContexts.filter((key) => validContexts.has(key)),
    });
  };
  return (
    <div className="step-content">
      <SectionIntro eyebrow="02 · Hesap amaçları" title="Önce neyi öğrenmek istediğinizi seçin" text="Birden fazla amacı ve hesap türünü birlikte seçebilirsiniz. GAIA ortak parametreleri ve deneyleri geoteknik talebinde yalnız bir kez gösterecek." aside={<div className="selection-count"><strong>{project.selectedAnalysisIds.length}</strong><span>hesap türü seçildi</span></div>} />
      {project.selectedAnalysisIds.length > 0 && <div className="selected-analysis-strip" aria-label="Seçilen hesap türleri"><strong>Seçiminiz</strong><div>{project.selectedAnalysisIds.map((id) => <button key={id} onClick={() => toggle(id)} title="Seçimi kaldır">{analysisChoiceCopy[id]?.title ?? analyses.find((item) => item.id === id)?.nameTr ?? id}<X size={14} /></button>)}</div></div>}
      <div className="purpose-list">
        {analysisPurposes.map((purpose) => {
          const Icon = purposeIcons[purpose.id] ?? Gauge;
          const purposeAnalyses = purpose.analysisIds.map((id) => analyses.find((analysis) => analysis.id === id)).filter((item) => Boolean(item));
          const selectedCount = purpose.analysisIds.filter((id) => project.selectedAnalysisIds.includes(id)).length;
          const isOpen = openPurpose === purpose.id;
          return <section key={purpose.id} className={`purpose-card ${isOpen ? "open" : ""} ${selectedCount ? "has-selection" : ""}`}>
            <button className="purpose-summary" onClick={() => setOpenPurpose(isOpen ? "" : purpose.id)} aria-expanded={isOpen} aria-controls={`purpose-${purpose.id}`}>
              <span className="purpose-icon"><Icon size={21} /></span>
              <span className="purpose-copy"><small>{purpose.extraScope ? "EK MODELLEME KAPSAMI" : "NE KONTROL EDİLECEK?"}</small><strong>{purpose.title}</strong><b>{purpose.question}</b><em>{purpose.explanation}</em></span>
              {selectedCount > 0 && <span className="purpose-selected"><Check size={14} /> {selectedCount} seçildi</span>}
              <ChevronRight size={19} className="purpose-chevron" />
            </button>
            {isOpen && <div className="purpose-options" id={`purpose-${purpose.id}`}>
              <div className="purpose-guidance"><Info size={17} /><span><strong>{purpose.extraScope ? "Bu kapsamı ne zaman eklemelisiniz?" : "Aşağıdan size uyan çözüm yolunu seçin."}</strong><small>Örnek kullanım: {purpose.example}</small></span></div>
              <div className="analysis-choice-list">
                {purposeAnalyses.map((analysis) => {
                  const item = analysis!;
                  const checked = project.selectedAnalysisIds.includes(item.id);
                  const copy = analysisChoiceCopy[item.id] ?? { title: item.nameTr, chooseWhen: item.summary, outcome: item.example };
                  return <button key={item.id} className={`analysis-choice ${checked ? "selected" : ""}`} onClick={() => toggle(item.id)} aria-pressed={checked}>
                    <span className="check-box">{checked && <Check size={15} />}</span>
                    <span><strong>{copy.title}</strong><b>Şunu seçin: {copy.chooseWhen}</b><p>{copy.outcome}</p><details onClick={(event) => event.stopPropagation()}><summary>GTS NX teknik adını göster</summary><small>{item.nameTr} · {item.officialName}</small></details></span>
                  </button>;
                })}
              </div>
            </div>}
          </section>;
        })}
      </div>
      {!project.selectedAnalysisIds.length && <div className="empty-inline"><CircleHelp size={20} /><span>Devam etmek için en az bir amaç kartını açın ve size uygun hesap türünü seçin.</span></div>}
    </div>
  );
}

function UnitsStep({ project, update }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void }) {
  const updateUnit = (id: string, patch: Partial<GroundUnit>) => update({ groundUnits: project.groundUnits.map((unit) => unit.id === id ? { ...unit, ...patch } : unit) });
  const remove = (id: string) => {
    if (project.groundUnits.length <= 1) return;
    const groundUnits = project.groundUnits.filter((unit) => unit.id !== id);
    const validContexts = new Set(project.selectedAnalysisIds.flatMap((analysisId) => groundUnits.map((unit) => `${analysisId}:${unit.id}`)));
    update({ groundUnits, confirmedModelIds: Object.fromEntries(Object.entries(project.confirmedModelIds).filter(([key]) => validContexts.has(key))), deferredModelContexts: project.deferredModelContexts.filter((key) => validContexts.has(key)) });
  };
  return (
    <div className="step-content">
      <SectionIntro eyebrow="03 · Zemin modeli" title="Jeoteknik birimleri ayırın" text="Farklı mühendislik davranışı gösteren her tabakayı ayrı birim olarak tanımlayın. Aynı parametre birden fazla birimde istenirse talep cümlesi tek kalır; birimler altında listelenir." aside={<button className="button button-secondary" onClick={() => update({ groundUnits: [...project.groundUnits, emptyUnit(project.groundUnits.length + 1)] })}><Plus size={17} /> Birim ekle</button>} />
      <div className="unit-list">
        {project.groundUnits.map((unit, index) => <article className="unit-card" key={unit.id}>
          <div className="unit-number">{String(index + 1).padStart(2, "0")}</div>
          <div className="unit-body">
            <div className="unit-heading"><input className="unit-name" value={unit.name} onChange={(e) => updateUnit(unit.id, { name: e.target.value })} aria-label={`${index + 1}. birim adı`} /><button className="icon-button danger" disabled={project.groundUnits.length === 1} onClick={() => remove(unit.id)} aria-label="Birimi sil"><Trash2 size={17} /></button></div>
            <div className="unit-fields">
              <Field label="Zemin / kaya türü"><select value={unit.soilType} onChange={(e) => updateUnit(unit.id, { soilType: e.target.value as SoilType })}>{soilOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.hint}</option>)}</select></Field>
              <Field label="Doygunluk"><select value={unit.saturation} onChange={(e) => updateUnit(unit.id, { saturation: e.target.value as GroundUnit["saturation"] })}><option value="unknown">Bilinmiyor</option><option value="unsaturated">Doygun değil</option><option value="saturated">Doygun</option><option value="variable">Değişken</option></select></Field>
              <Field label="Konsolidasyon durumu"><select value={unit.consolidationState} onChange={(e) => updateUnit(unit.id, { consolidationState: e.target.value as GroundUnit["consolidationState"] })}><option value="unknown">Bilinmiyor</option><option value="normally-consolidated">Normal konsolide</option><option value="over-consolidated">Aşırı konsolide</option></select></Field>
              <Field label="Çevrimsel risk"><select value={unit.cyclicRisk} onChange={(e) => updateUnit(unit.id, { cyclicRisk: e.target.value as GroundUnit["cyclicRisk"] })}><option value="unknown">Bilinmiyor</option><option value="no">Beklenmiyor</option><option value="yes">Var / incelenecek</option></select></Field>
              <Field label="Birim açıklaması" wide><input value={unit.description} onChange={(e) => updateUnit(unit.id, { description: e.target.value })} placeholder="Saha logundaki tanım, derinlik aralığı veya ayırt edici özellik…" /></Field>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  );
}

function ChoiceCard({ selected, title, text, onClick, icon }: { selected: boolean; title: string; text: string; onClick: () => void; icon?: React.ReactNode }) {
  return <button className={`choice-card ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>{icon}<span><strong>{title}</strong><small>{text}</small></span><span className="radio-dot">{selected && <i />}</span></button>;
}

function ConditionsStep({ project, update, onOpenAnalyses }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void; onOpenAnalyses: () => void }) {
  const setCondition = <K extends keyof GaiaProject["conditions"]>(key: K, value: GaiaProject["conditions"][K]) => {
    const linkedAnalysis = linkedConditionAnalyses[key as keyof typeof linkedConditionAnalyses];
    let selectedAnalysisIds = [...project.selectedAnalysisIds];
    if (value === true && linkedAnalysis && !selectedAnalysisIds.includes(linkedAnalysis)) selectedAnalysisIds.push(linkedAnalysis);
    if (value === false && linkedAnalysis) selectedAnalysisIds = selectedAnalysisIds.filter((id) => id !== linkedAnalysis);
    if (value === false && key === "dynamicLoading") selectedAnalysisIds = selectedAnalysisIds.filter((id) => !dynamicAnalysisIds.has(id));
    const validContexts = new Set(selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => `${analysisId}:${unit.id}`)));
    update({
      conditions: { ...project.conditions, [key]: value },
      selectedAnalysisIds,
      confirmedModelIds: Object.fromEntries(Object.entries(project.confirmedModelIds).filter(([context]) => validContexts.has(context))),
      deferredModelContexts: project.deferredModelContexts.filter((context) => validContexts.has(context)),
    });
  };
  const dynamicAnalysisMissing = project.conditions.dynamicLoading && !project.selectedAnalysisIds.some((id) => dynamicAnalysisIds.has(id));
  return (
    <div className="step-content">
      <SectionIntro eyebrow="04 · Proje koşulları" title="Suyun ve yüklemenin dilini belirleyin" text="Bu seçimler aynı sembollü fakat farklı mühendislik anlamlı parametrelerin güvenli biçimde ayrılmasını sağlar." />
      <div className="condition-section"><div className="condition-title"><Droplets size={20} /><div><h3>Yeraltı suyu</h3><p>Sahadaki su koşulunu en iyi anlatan seçeneği işaretleyin.</p></div></div><div className="choice-grid four">
        <ChoiceCard selected={project.conditions.groundwater === "unknown"} title="Bilinmiyor" text="Ölçüm talep edilecek" onClick={() => setCondition("groundwater", "unknown")} />
        <ChoiceCard selected={project.conditions.groundwater === "not-relevant"} title="İlgili değil" text="Uzman gerekçesi gerekir" onClick={() => setCondition("groundwater", "not-relevant")} />
        <ChoiceCard selected={project.conditions.groundwater === "static"} title="Yaklaşık sabit" text="Kot ve mevsimsel aralık" onClick={() => setCondition("groundwater", "static")} />
        <ChoiceCard selected={project.conditions.groundwater === "time-varying"} title="Zamanla değişiyor" text="Zaman serisi gerekir" onClick={() => setCondition("groundwater", "time-varying")} />
      </div></div>
      <div className="condition-section"><div className="condition-title"><Waves size={20} /><div><h3>Drenaj yaklaşımı</h3><p>Analiz süresi ve zeminin geçirgenliğine göre mühendislik kararınız.</p></div></div><div className="choice-grid four">
        <ChoiceCard selected={project.conditions.drainageDecision === "unknown"} title="Henüz bilinmiyor" text="Karar eksik işaretlenir" onClick={() => setCondition("drainageDecision", "unknown")} />
        <ChoiceCard selected={project.conditions.drainageDecision === "drained"} title="Drenajlı" text="Efektif dayanım" onClick={() => setCondition("drainageDecision", "drained")} />
        <ChoiceCard selected={project.conditions.drainageDecision === "undrained"} title="Drenajsız" text="Toplam veya efektif" onClick={() => setCondition("drainageDecision", "undrained")} />
        <ChoiceCard selected={project.conditions.drainageDecision === "both"} title="Her ikisi" text="Ayrı durumlar incelenecek" onClick={() => setCondition("drainageDecision", "both")} />
      </div></div>
      <div className="condition-section"><div className="condition-title"><Gauge size={20} /><div><h3>Özel modelleme kapsamı</h3><p>Projede bulunuyorsa etkinleştirin; ilgili girdiler talebe eklenir.</p></div></div><div className="toggle-grid">
        {[
          ["constructionStages", "Yapım aşamaları", "Kazı, dolgu veya destek sırası"],
          ["dynamicLoading", "Dinamik yükleme", "Deprem, makine veya hareketli yük"],
          ["interfacePresent", "Zemin-yapı arayüzü", "Duvar, kaplama veya temel teması"],
          ["pilePresent", "Kazık sistemi", "Eksenel veya yanal kazık etkileşimi"],
        ].map(([key, title, text]) => <label className="toggle-card" key={key}><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={Boolean(project.conditions[key as keyof GaiaProject["conditions"]])} onChange={(e) => setCondition(key as keyof GaiaProject["conditions"], e.target.checked as never)} /><i /></label>)}
      </div>{dynamicAnalysisMissing && <div className="helper-strip gold"><AlertTriangle size={18} /><div><strong>Dinamik yük var; hesap türü henüz seçilmedi.</strong><span>Zaman tanım alanı, tepki spektrumu veya hareketli yük gibi uygun çözümü Analizler adımında seçin.</span></div><button className="button button-secondary" onClick={onOpenAnalyses}>Dinamik hesap türünü seç</button></div>}</div>
    </div>
  );
}

function ModelsStep({ project, update, knowledge }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void; knowledge: KnowledgePackage }) {
  const recommendations = useMemo(() => recommendModels(project, knowledge.payload), [project, knowledge]);
  const contexts = project.groundUnits.flatMap((unit) => project.selectedAnalysisIds.map((analysisId) => ({ analysisId, unit, key: `${analysisId}:${unit.id}` })));
  const unresolved = contexts.filter(({ key }) => !project.confirmedModelIds[key]?.length && !project.deferredModelContexts.includes(key));
  const [openContext, setOpenContext] = useState(contexts[0]?.key ?? "");
  useEffect(() => {
    if (!contexts.some(({ key }) => key === openContext)) setOpenContext(unresolved[0]?.key ?? contexts[0]?.key ?? "");
  }, [contexts, openContext, unresolved]);
  const goToNext = (current: string) => {
    const next = contexts.find(({ key }) => key !== current && !project.confirmedModelIds[key]?.length && !project.deferredModelContexts.includes(key));
    setOpenContext(next?.key ?? current);
  };
  const select = (context: string, modelId: string) => {
    update({ confirmedModelIds: { ...project.confirmedModelIds, [context]: [modelId] }, deferredModelContexts: project.deferredModelContexts.filter((item) => item !== context) });
    goToNext(context);
  };
  const defer = (context: string) => {
    const confirmedModelIds = { ...project.confirmedModelIds };
    delete confirmedModelIds[context];
    update({ confirmedModelIds, deferredModelContexts: [...new Set([...project.deferredModelContexts, context])] });
    goToNext(context);
  };
  const deferOpenForUnit = (unitId: string) => {
    const unitContexts = unresolved.filter(({ unit }) => unit.id === unitId).map(({ key }) => key);
    if (!unitContexts.length) return;
    const confirmedModelIds = { ...project.confirmedModelIds };
    unitContexts.forEach((context) => delete confirmedModelIds[context]);
    update({ confirmedModelIds, deferredModelContexts: [...new Set([...project.deferredModelContexts, ...unitContexts])] });
    const next = unresolved.find(({ key }) => !unitContexts.includes(key));
    setOpenContext(next?.key ?? unitContexts[0]);
  };
  const completeCount = contexts.length - unresolved.length;
  return (
    <div className="step-content">
      <SectionIntro eyebrow="05 · Zemin davranışı" title="Her birim için modeli adım adım seçin" text="GAIA modeli sizin yerinize seçmez. Aynı anda yalnız bir karar açılır; doğrulanmamış modeller hesapta kullanılamaz, fakat karar için gerekli veriler talep edilebilir." aside={contexts.length ? <div className="model-progress" role="status" aria-live="polite"><strong>{completeCount} / {contexts.length}</strong><span>karar tamamlandı</span><i><b style={{ width: `${contexts.length ? (completeCount / contexts.length) * 100 : 0}%` }} /></i></div> : undefined} />
      {!contexts.length ? <div className="empty-state"><Sparkles size={30} /><h3>Öneri için önce analiz seçin</h3><p>Analiz ve birim bilgileri tamamlandığında uygun modeller burada sıralanır.</p></div> : <div className="model-unit-list">
        {project.groundUnits.map((unit) => { const openForUnit = unresolved.filter((context) => context.unit.id === unit.id).length; return <section className="model-unit-panel" key={unit.id}>
          <header><div><small>JEOTEKNİK BİRİM</small><h3>{unit.name}</h3><span>{soilOptions.find((item) => item.value === unit.soilType)?.label}</span></div><div className="model-unit-actions"><b>{project.selectedAnalysisIds.length} hesap için karar</b>{openForUnit > 1 && <button className="button button-secondary" onClick={() => deferOpenForUnit(unit.id)}>Açık {openForUnit} karar için veriyi topluca iste</button>}</div></header>
          <div className="model-decision-list">
            {contexts.filter((item) => item.unit.id === unit.id).map(({ analysisId, key: contextKey }) => {
              const analysis = knowledge.payload.analyses.find((item) => item.id === analysisId);
              const candidates = recommendations.filter((item) => item.analysisId === analysisId && item.unitId === unit.id);
              const selectable = candidates.filter((candidate) => candidate.model.catalogueStatus === "verified-core");
              const lockedCandidates = candidates.filter((candidate) => candidate.model.catalogueStatus !== "verified-core");
              const selectedId = project.confirmedModelIds[contextKey]?.[0];
              const selectedModel = models.find((item) => item.id === selectedId);
              const deferred = project.deferredModelContexts.includes(contextKey);
              const isOpen = openContext === contextKey;
              const unknownSoil = unit.soilType === "unknown";
              return <article key={contextKey} className={`model-decision ${isOpen ? "open" : ""} ${selectedId || deferred ? "complete" : ""}`}>
                <button className="model-decision-summary" onClick={() => setOpenContext(isOpen ? "" : contextKey)} aria-expanded={isOpen} aria-controls={`model-${contextKey}`} aria-label={`${unit.name}, ${analysis?.nameTr}, ${selectedId ? "model seçildi" : deferred ? "karar verisi talep edildi" : "seçim bekliyor"}`}>
                  <span className={`decision-state ${selectedId || deferred ? "ok" : ""}`}>{selectedId || deferred ? <Check size={16} /> : <span />}</span>
                  <span><small>HESAP</small><strong>{analysisChoiceCopy[analysisId]?.title ?? analysis?.nameTr}</strong><em>{analysisChoiceCopy[analysisId]?.outcome ?? analysis?.summary}</em></span>
                  <b>{selectedModel ? selectedModel.nameTr : deferred ? "Model seçilmedi · veri istenecek" : unknownSoil ? "Önce zemin türü gerekli" : "Karar bekliyor"}</b>
                  <ChevronRight size={18} />
                </button>
                {isOpen && <div className="model-decision-body" id={`model-${contextKey}`}>
                  <div className="decision-question"><span>Bu hesapta <strong>{unit.name}</strong> davranışını nasıl temsil edeceksiniz?</span><small>Seçiminiz bu bağlam için istenecek parametreleri belirler.</small></div>
                  {unknownSoil && <div className="model-data-route"><Info size={21} /><div><strong>Önce bu birimin zemin/kaya türünü tanımlayın</strong><p>Model önerisi için en azından dolgu, kum, kil veya kaya gibi temel sınıflandırma gerekir. Tahmin etmeyin; model seçmeden karar verisini talep edebilirsiniz.</p></div></div>}
                  {selectable.length > 0 && <div className="simple-model-options">
                    {selectable.map((candidate) => {
                      const copy = modelDecisionCopy[candidate.model.id] ?? { summary: candidate.model.behaviour, chooseWhen: candidate.reasons[0] ?? "Uzman değerlendirmesi uygun buluyorsa", caution: candidate.model.warning ?? "Proje koşullarıyla doğrulanmalıdır." };
                      const checked = selectedId === candidate.model.id;
                      return <button key={candidate.model.id} className={`simple-model-card ${checked ? "selected" : ""}`} onClick={() => select(contextKey, candidate.model.id)} aria-pressed={checked}>
                        <span className="radio-dot">{checked && <i />}</span><span><small>DOĞRULANMIŞ TEMEL SEÇENEK</small><strong>{candidate.model.nameTr}</strong><p>{copy.summary}</p><dl><div><dt>Şunu seçin</dt><dd>{copy.chooseWhen}</dd></div><div><dt>En önemli sınır</dt><dd>{copy.caution}</dd></div></dl><em>{candidate.model.parameterIds.length} veri girdisi talebe eklenir</em></span>
                      </button>;
                    })}
                  </div>}
                  <div className={`model-data-route ${deferred ? "selected" : ""}`}>
                    {deferred ? <CheckCircle2 size={21} /> : <CircleHelp size={21} />}<div><strong>{deferred ? "Model seçilmedi; karar verileri talebe eklendi" : "Henüz güvenli model kararı veremiyorum"}</strong><p>GAIA bir model uydurmaz. Sınıflandırma, gerilme geçmişi ve davranış verileri geoteknik ekipten istenir; model daha sonra uzman tarafından seçilir.</p></div><button className={`button ${deferred ? "button-secondary" : "button-primary"}`} onClick={() => defer(contextKey)} aria-pressed={deferred}>{deferred ? <><Check size={17} /> Talebe eklendi</> : <>Karar için veri iste <ArrowRight size={17} /></>}</button>
                  </div>
                  {lockedCandidates.length > 0 && <details className="model-catalogue-details locked-model-details"><summary>Teknik ayrıntı: henüz seçilemeyen ileri modeller <span>{lockedCandidates.length}</span></summary><div>{lockedCandidates.map((candidate) => <article key={candidate.model.id}><div><strong>{candidate.model.nameTr}</strong><small>{candidate.model.name}</small></div><span className={`catalogue-state ${candidate.model.catalogueStatus}`}>Hesapta kilitli</span><p>{candidate.model.unverifiedFields[0] ?? candidate.reasons[0]}</p></article>)}</div></details>}
                </div>}
              </article>;
            })}
          </div>
        </section>; })}
      </div>}
      <div className="helper-strip gold"><AlertTriangle size={18} /><div><strong>Öneri, otomatik mühendislik kararı değildir.</strong><span>Model uygunluğu; saha davranışı, gerilme yolu, veri kalitesi ve bağımsız uzman incelemesiyle doğrulanmalıdır.</span></div></div>
    </div>
  );
}

function DetailDrawer({ requirement, onClose }: { requirement: ConsolidatedRequirement | null; onClose: () => void }) {
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!requirement) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && drawerRef.current) {
        const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((item) => !item.hasAttribute("disabled"));
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus(), 0);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [requirement, onClose]);
  if (!requirement) return null;
  const p = requirement.parameter;
  const methodList = p.preferredTestIds.map((id) => catalogueIndex.testById.get(id)).filter(Boolean);
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside ref={drawerRef} className="detail-drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <header><div><span>{p.group}</span><h2 id="drawer-title">{p.nameTr}</h2><small>{p.officialName} · {p.symbol} [{p.unit}]</small></div><button className="icon-button" onClick={onClose} aria-label="Kapat"><X size={20} /></button></header>
    <div className="drawer-body">
      <section><h3>Bu nedir?</h3><p>{p.meaning}</p></section>
      <section><h3>Neden isteniyor?</h3><p>{p.why}</p></section>
      <section><h3>GTS NX’te nerede kullanılır?</h3><p className="path-box">{p.gtsPath}</p></section>
      <section><h3>Nasıl belirlenir?</h3><div className="method-list">{methodList.map((method) => <div key={method!.id}><FlaskConical size={17} /><span><strong>{method!.nameTr}</strong><small>{method!.nameEn}<br />{method!.standardPrimary}{method!.standardAlternative ? ` · alternatif ${method!.standardAlternative}` : ""}</small></span></div>)}</div><p className="alternative">{p.alternativeMethod}</p></section>
      <section><h3>Laboratuvardan hangi ham veriyi istemeliyim?</h3><p>{p.rawRequest}</p></section>
      {p.limitations.length > 0 && <section className="warning-section"><h3>Sınırlar ve dikkat noktaları</h3><ul>{p.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      <section><h3>Bu talebin bağlamı</h3><dl><div><dt>Drenaj</dt><dd>{requirement.drainage}</dd></div><div><dt>Rijitlik / dayanım bazısı</dt><dd>{requirement.stiffnessBasis} / {requirement.strengthBasis}</dd></div><div><dt>Dayanım seviyesi</dt><dd>{requirement.strengthState}</dd></div><div><dt>Gerilme yolu</dt><dd>{requirement.stressPath}</dd></div><div><dt>Numune koşulu</dt><dd>{requirement.specimenCondition}</dd></div></dl></section>
    </div>
  </aside></div>;
}

const drainageTr: Record<string, string> = { any: "Genel", drained: "Drenajlı", "undrained-effective": "Drenajsız · efektif gerilme", "undrained-total": "Drenajsız · toplam gerilme" };
const strengthTr: Record<string, string> = { any: "", peak: "Pik dayanım", critical: "Kritik durum", residual: "Rezidüel dayanım", "post-cyclic": "Çevrim sonrası" };
const fieldTestIds = new Set(["survey-borehole", "spt", "cptu", "scptu", "dmt", "pressuremeter", "field-vane", "piezometer", "geophysics", "pile-load"]);
const levelRank: Record<RequirementLevel, number> = { required: 4, "missing-decision": 3, conditional: 2, recommended: 1 };

function testPriority(item: CanonicalResult["tests"][number]): RequirementLevel {
  return item.applicability.reduce<RequirementLevel>((highest, use) => levelRank[use.level] > levelRank[highest] ? use.level : highest, "recommended");
}

function testGroupPriority(items: CanonicalResult["tests"]): RequirementLevel {
  return items.reduce<RequirementLevel>((highest, item) => levelRank[testPriority(item)] > levelRank[highest] ? testPriority(item) : highest, "recommended");
}

const protocolScopeTr: Record<string, string> = { interface: "Arayüz numunesi", pile: "Kazık sistemi / elemanı", structure: "Yapısal eleman / ürün", project: "Proje geneli", "ground-unit": "Zemin / kaya numunesi" };

function testProtocolLabel(result: CanonicalResult, test: CanonicalResult["tests"][number]): string {
  const requirements = test.requirementIds.map((id) => result.requirements.find((item) => item.id === id)).filter((item): item is ConsolidatedRequirement => Boolean(item));
  const scopes = [...new Set(requirements.map((item) => protocolScopeTr[item.parameter.scope] ?? protocolScopeTr["ground-unit"]))];
  const drainage = [...new Set(requirements.map((item) => item.drainage).filter((item) => item !== "any"))].map((item) => drainageTr[item]);
  const strength = [...new Set(requirements.map((item) => item.strengthState).filter((item) => item !== "any"))].map((item) => strengthTr[item]);
  const directions = [...new Set(requirements.map((item) => item.direction).filter((item) => item !== "any"))].map((item) => item.toUpperCase());
  const specimenConditions = [...new Set(requirements.map((item) => item.specimenCondition).filter((item) => item !== "any"))];
  return [...scopes, ...drainage, ...strength, ...directions, ...specimenConditions].join(" · ") || "Standart deney protokolü";
}

function testProtocolApplicability(test: CanonicalResult["tests"][number], project: GaiaProject): string {
  const byLevel = new Map<RequirementLevel, Set<string>>();
  test.applicability.forEach((use) => {
    const units = byLevel.get(use.level) ?? new Set<string>();
    if (!use.groundUnitIds.length) units.add("");
    else use.groundUnitIds.forEach((id) => units.add(id));
    byLevel.set(use.level, units);
  });
  return [...byLevel.entries()].sort(([left], [right]) => levelRank[right] - levelRank[left]).map(([level, unitIds]) => `${plainLevelCopy[level]}: ${unitIds.has("") ? "Proje geneli" : [...unitIds].map((id) => project.groundUnits.find((unit) => unit.id === id)?.name ?? id).join(" · ")}`).join("; ");
}

function ResultsStep({ result, project, onDetail }: { result: CanonicalResult; project: GaiaProject; onDetail: (req: ConsolidatedRequirement) => void }) {
  const [view, setView] = useState<"brief" | "parameters" | "tests" | "models" | "quality">("brief");
  const [filter, setFilter] = useState<RequirementLevel | "all">("all");
  const [query, setQuery] = useState("");
  const visible = result.requirements.filter((req) => (filter === "all" || req.level === filter) && `${req.parameter.nameTr} ${req.parameter.officialName} ${req.parameter.symbol}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  const count = (level: RequirementLevel) => result.requirements.filter((req) => req.level === level).length;
  const conceptMap = new Map<string, ConsolidatedRequirement[]>();
  visible.forEach((requirement) => conceptMap.set(requirement.parameter.id, [...(conceptMap.get(requirement.parameter.id) ?? []), requirement]));
  const concepts = [...conceptMap.values()];
  const uniqueParameterCount = new Set(result.requirements.map((item) => item.parameter.id)).size;
  const rawUses = result.requirements.reduce((sum, item) => sum + Math.max(1, item.analysisIds.length), 0);
  const mergedCount = Math.max(0, rawUses - result.requirements.length);
  const linkedRequirementIds = new Set(result.tests.flatMap((item) => item.requirementIds));
  const openDecisions = result.requirements.filter((item) => item.level === "missing-decision");
  const directRequests = result.requirements.filter((item) => item.level !== "missing-decision" && !linkedRequirementIds.has(item.id));
  const groupRequirements = (items: ConsolidatedRequirement[]) => {
    const grouped = new Map<string, ConsolidatedRequirement[]>();
    items.forEach((item) => grouped.set(item.parameter.id, [...(grouped.get(item.parameter.id) ?? []), item]));
    return [...grouped.values()];
  };
  const openDecisionGroups = groupRequirements(openDecisions);
  const directRequestGroups = groupRequirements(directRequests);
  const testsByMethod = new Map<string, CanonicalResult["tests"]>();
  result.tests.forEach((item) => testsByMethod.set(item.method.id, [...(testsByMethod.get(item.method.id) ?? []), item]));
  const testGroups = [...testsByMethod.values()];
  const fieldTests = testGroups.filter((items) => fieldTestIds.has(items[0].method.id));
  const laboratoryTests = testGroups.filter((items) => !fieldTestIds.has(items[0].method.id));
  const testUnits = (items: CanonicalResult["tests"]) => [...new Set(items.flatMap((item) => item.groundUnitIds))].map((id) => project.groundUnits.find((unit) => unit.id === id)?.name ?? id).join(" · ") || "Proje geneli";
  return (
    <div className="step-content result-step">
      <SectionIntro eyebrow="06 · Uzman inceleme taslağı" title={result.engineeringUseAllowed ? "Geoteknik ekip için onaylı iş listesi" : "Uzman incelemesi için tekrarsız taslak iş listesi"} text={`${rawUses} analiz kullanımındaki ortak ihtiyaçlar birleştirildi; ${mergedCount} tekrar kaldırıldı. Aynı deney yöntemi bir kez gösterilir; farklı numune ve protokol uygulamaları kendi öncelik ve birimleriyle ayrı tutulur.`} />
      {result.warnings.length > 0 && <div className="warning-panel"><AlertTriangle size={20} /><div><strong>Dışa aktarmadan önce dikkat</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
      <div className="metric-grid">
        <div className="metric-card"><span className="metric-icon mint"><ClipboardCheck size={20} /></span><div><strong>{uniqueParameterCount} / {result.requirements.length}</strong><small>parametre / mühendislik koşulu</small></div></div>
        <div className="metric-card"><span className="metric-icon blue"><FlaskConical size={20} /></span><div><strong>{testGroups.length} / {result.tests.length}</strong><small>yöntem / uygulama ayrımı</small></div></div>
        <div className="metric-card"><span className="metric-icon gold"><Layers3 size={20} /></span><div><strong>{project.groundUnits.length}</strong><small>jeoteknik birim</small></div></div>
        <div className="metric-card"><span className="metric-icon slate"><FileArchive size={20} /></span><div><strong>3</strong><small>eş içerikli çıktı biçimi</small></div></div>
      </div>
      <div className="result-view-tabs" role="tablist" aria-label="Sonuç bölümleri">
        {[{ id: "brief", label: "Gönderilecek işler", count: testGroups.length + directRequestGroups.length + openDecisionGroups.length }, { id: "parameters", label: "Mühendislik matrisi", count: uniqueParameterCount }, { id: "tests", label: "Deney matrisi", count: testGroups.length }, { id: "models", label: "Model kararları", count: Object.keys(project.confirmedModelIds).length + project.deferredModelContexts.length }, { id: "quality", label: "Kalite ve kaynaklar", count: result.warnings.length }].map((tab) => <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-controls={`panel-${tab.id}`} aria-selected={view === tab.id} className={view === tab.id ? "active" : ""} onClick={() => setView(tab.id as typeof view)}>{tab.label}<span>{tab.count}</span></button>)}
      </div>
      {view === "brief" && <div id="panel-brief" role="tabpanel" aria-labelledby="tab-brief" className="handoff-view" data-testid="geotechnical-work-order">
        <div className="handoff-intro"><ClipboardCheck size={24} /><div><span>{result.engineeringUseAllowed ? "GEOTEKNİK EKİP İÇİN ONAYLI ÖZET" : "UZMAN İNCELEMESİ İÇİN TASLAK"}</span><h3>Bu sırayla ilerleyin</h3><p>{result.engineeringUseAllowed ? "Geoteknik ekip" : "İnceleyen geoteknik uzman"}; aşağıdaki hedef birimleri ve tasarım etki derinliğini dikkate alarak adet/derinlik programını değerlendirmeli, ham kayıtların yorumlanmış raporla birlikte teslim kapsamını doğrulamalıdır.</p></div></div>
        <div className="handoff-steps" aria-label="İş sırası"><div><span>1</span><strong>Açık kararları kapatın</strong><small>{openDecisionGroups.length ? `${openDecisionGroups.length} karar/ölçüm eksik` : "Açık karar yok"}</small></div><div><span>2</span><strong>Saha ve laboratuvarı planlayın</strong><small>{testGroups.length} yöntem · {result.tests.length} uygulama/protokol ayrımı</small></div><div><span>3</span><strong>Ham veriyi teslim edin</strong><small>Özet sonuçla birlikte denetlenebilir kayıt</small></div></div>
        {openDecisionGroups.length > 0 && <section className="work-section decision-work"><header><AlertTriangle size={19} /><div><span>ÖNCE NETLEŞTİRİN</span><h3>İşe başlamadan önce gereken karar ve ölçümler</h3></div><b>{openDecisionGroups.length}</b></header><div className="direct-request-list">{openDecisionGroups.map((items) => { const req = items[0]; return <article key={req.parameter.id}><span className={`status-badge ${levelCopy[req.level].className}`}>{plainLevelCopy[req.level]}</span><div><strong>{req.parameter.nameTr}</strong><p>{req.parameter.why}</p><small><b>İstenen kanıt / teslim:</b> {req.parameter.rawRequest}</small></div><button className="detail-button" onClick={() => onDetail(req)}>Açıkla <ChevronRight size={15} /></button></article>; })}</div></section>}
        {[{ id: "field", title: "Saha çalışmaları", icon: Mountain, items: fieldTests }, { id: "lab", title: "Laboratuvar deneyleri", icon: FlaskConical, items: laboratoryTests }].map((group) => {
          const Icon = group.icon;
          return group.items.length > 0 && <section className="work-section" key={group.id}><header><Icon size={19} /><div><span>YAPILACAK İŞLER</span><h3>{group.title}</h3></div><b>{group.items.length}</b></header><div className="work-order-list">{group.items.map((items) => {
            const item = items[0];
            const priority = testGroupPriority(items);
            const parameterIds = [...new Set(items.flatMap((candidate) => candidate.parameterIds))];
            const analysisIds = [...new Set(items.flatMap((candidate) => candidate.analysisIds))];
            return <article className="work-order-card" key={item.method.id} data-test-method={item.method.id}>
              <div className="work-order-title"><span className={`status-badge ${items.length > 1 ? "badge-conditional" : levelCopy[priority].className}`}>{items.length > 1 ? "Ayrı uygulamalar" : plainLevelCopy[priority]}</span><div><strong>{item.method.nameTr}</strong><small>{item.method.standardPrimary}</small></div></div>
              <dl><div><dt>Toplam kapsam</dt><dd>{testUnits(items)}</dd></div><div><dt>Hangi çıktılar alınacak?</dt><dd>{parameterIds.map((id) => parameters.find((parameter) => parameter.id === id)?.nameTr ?? id).join(" · ")}</dd></div>{items.length > 1 && <div><dt>Ayrı uygulanacak numune/protokoller</dt><dd>{items.map((candidate) => <span key={candidate.id}><b>{testProtocolLabel(result, candidate)}</b><small>{testProtocolApplicability(candidate, project)}</small></span>)}</dd></div>}<div><dt>Hangi ham kayıtlar teslim edilecek?</dt><dd>{item.method.rawDeliverables.join(" · ")}</dd></div></dl>
              <details><summary>Teknik ayrıntı: kullanıldığı hesaplar</summary><p>{analysisIds.map((id) => analyses.find((analysis) => analysis.id === id)?.nameTr ?? id).join(" · ")}</p></details>
            </article>;
          })}</div></section>;
        })}
        {directRequestGroups.length > 0 && <section className="work-section"><header><FileText size={19} /><div><span>DENEY DIŞI TESLİMLER</span><h3>Doğrudan istenecek proje ve saha verileri</h3></div><b>{directRequestGroups.length}</b></header><div className="direct-request-list">{directRequestGroups.map((items) => { const req = items[0]; return <article key={req.parameter.id}><span className={`status-badge ${levelCopy[req.level].className}`}>{plainLevelCopy[req.level]}</span><div><strong>{req.parameter.nameTr}</strong><p>{req.parameter.why}</p><small><b>İstenecek teslim:</b> {req.parameter.rawRequest}</small></div><button className="detail-button" onClick={() => onDetail(req)}>Açıkla <ChevronRight size={15} /></button></article>; })}</div></section>}
      </div>}
      {view === "parameters" && <div id="panel-parameters" role="tabpanel" aria-labelledby="tab-parameters">
        <div className="result-toolbar"><div className="filter-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tümü <span>{result.requirements.length}</span></button>{(["required", "conditional", "recommended", "missing-decision"] as RequirementLevel[]).map((level) => <button key={level} className={filter === level ? "active" : ""} onClick={() => setFilter(level)}>{levelCopy[level].label} <span>{count(level)}</span></button>)}</div><div className="result-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Parametre ara" /></div></div>
        <div className="result-table-wrap"><table className="result-table"><thead><tr><th>Durum / Parametre</th><th>Mühendislik alt koşulları</th><th>Kullanıldığı analizler</th><th>Uygulanacak birimler</th><th>Birincil belirleme yolu</th><th /></tr></thead><tbody>
          {concepts.map((variants) => {
            const first = variants[0];
            const analysisIds = [...new Set(variants.flatMap((item) => item.analysisIds))];
            const unitIds = [...new Set(variants.flatMap((item) => item.groundUnitIds))];
            const testRequests = result.tests.filter((item) => item.requirementIds.some((id) => variants.some((variant) => variant.id === id)));
            return <tr key={first.parameter.id}><td data-label="Durum / Parametre"><div className="status-stack">{[...new Set(variants.map((item) => item.level))].map((level) => <span key={level} className={`status-badge ${levelCopy[level].className}`}>{levelCopy[level].label}</span>)}</div><strong>{first.parameter.nameTr}</strong><small>{first.parameter.officialName} · {first.parameter.symbol} [{first.parameter.unit}]</small></td><td data-label="Mühendislik alt koşulları"><div className="variant-list">{variants.map((item) => <span key={item.id}><b>{drainageTr[item.drainage]}</b>{strengthTr[item.strengthState] && <> · {strengthTr[item.strengthState]}</>}{item.direction !== "any" && <> · {item.direction.toUpperCase()}</>}{item.specimenCondition !== "any" && <small>{item.specimenCondition}</small>}</span>)}</div></td><td data-label="Kullanıldığı analizler"><div className="tag-list">{analysisIds.map((id) => <span key={id}>{analyses.find((a) => a.id === id)?.nameTr ?? id}</span>)}</div></td><td data-label="Uygulanacak birimler">{unitIds.length ? <div className="tag-list unit-tags">{unitIds.map((id) => <span key={id}>{project.groundUnits.find((u) => u.id === id)?.name ?? id}</span>)}</div> : <span className="project-scope">Proje geneli</span>}</td><td data-label="Birincil belirleme yolu"><span className="method-cell">{[...new Set(testRequests.map((item) => item.method.nameTr))].join(" · ") || "Uzman yöntem kararı gerekli"}</span></td><td data-label="Ayrıntı"><button className="detail-button" onClick={() => onDetail(first)}>Açıkla <ChevronRight size={15} /></button></td></tr>;
          })}
        </tbody></table>{!visible.length && <div className="empty-table">Aramanızla eşleşen parametre bulunamadı.</div>}</div>
      </div>}
      {view === "tests" && <div id="panel-tests" role="tabpanel" aria-labelledby="tab-tests" className="result-table-wrap"><table className="result-table test-program-table"><thead><tr><th>Deney / standart</th><th>Sağlayacağı parametreler</th><th>Analizler, uygulama/protokol ve birimler</th><th>İstenecek ham teslimler</th></tr></thead><tbody>{testGroups.map((items) => { const item = items[0]; const parameterIds = [...new Set(items.flatMap((candidate) => candidate.parameterIds))]; const analysisIds = [...new Set(items.flatMap((candidate) => candidate.analysisIds))]; return <tr key={item.method.id}>
        <td data-label="Deney / standart"><strong>{item.method.nameTr}</strong><small>{item.method.nameEn}<br />{item.method.standardPrimary}</small></td>
        <td data-label="Sağlayacağı parametreler"><div className="tag-list">{parameterIds.map((id) => <span key={id}>{parameters.find((p) => p.id === id)?.nameTr ?? id}</span>)}</div></td>
        <td data-label="Analizler, uygulama/protokol ve birimler"><p>{analysisIds.map((id) => analyses.find((a) => a.id === id)?.nameTr ?? id).join(" · ")}</p><div className="variant-list">{items.map((candidate) => <span key={candidate.id}><b>{testProtocolLabel(result, candidate)}</b><small>{testProtocolApplicability(candidate, project)}</small></span>)}</div></td>
        <td data-label="İstenecek ham teslimler"><ul className="raw-list">{item.method.rawDeliverables.map((raw) => <li key={raw}>{raw}</li>)}</ul></td>
      </tr>; })}</tbody></table></div>}
      {view === "models" && <div id="panel-models" role="tabpanel" aria-labelledby="tab-models" className="decision-grid">{project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => { const key = `${analysisId}:${unit.id}`; const modelId = project.confirmedModelIds[key]?.[0]; const model = models.find((item) => item.id === modelId); return <article key={key}><span>{analyses.find((item) => item.id === analysisId)?.nameTr}</span><h3>{unit.name}</h3>{model ? <p><CheckCircle2 size={16} /> Kullanıcı seçimi: <strong>{model.nameTr}</strong></p> : <p className="deferred"><CircleHelp size={16} /> Model seçilmedi; karar verisi istendi.</p>}</article>; }))}</div>}
      {view === "quality" && <div id="panel-quality" role="tabpanel" aria-labelledby="tab-quality" className="quality-grid"><section><h3>Kritik uyarılar</h3>{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={15} />{warning}</p>)}</section><section><h3>Kaynak izi</h3>{result.sources.map((source) => <p key={source.id}><BookOpen size={15} /><span><strong>{source.title}</strong><small>{source.locator} · doğrulama {source.verifiedAt}</small></span></p>)}</section></div>}
      <div className="parity-note"><ShieldCheck size={18} /><div><strong>Tek kaynak, üç çıktı</strong><p>DOCX, PDF ve XLSX aynı {uniqueParameterCount} parametre, {result.requirements.length} mühendislik alt koşulu, {testGroups.length} deney yöntemi ve {result.tests.length} uygulama/protokol ayrımından üretilir.</p></div></div>
    </div>
  );
}

function Wizard({ initialProject, knowledge, installedVersion, onHome, onKnowledgeChanged }: { initialProject: GaiaProject; knowledge: KnowledgePackage; installedVersion: string | null; onHome: () => void; onKnowledgeChanged: (knowledge: KnowledgePackage) => void }) {
  const [project, setProject] = useState(initialProject);
  const [active, setActive] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [detail, setDetail] = useState<ConsolidatedRequirement | null>(null);
  const [toast, setToast] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const update = (patch: Partial<GaiaProject>) => setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  const result = useMemo(() => buildCanonicalResult(project, knowledge), [project, knowledge]);
  const modelContexts = project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => `${analysisId}:${unit.id}`));
  const modelDecisionsComplete = modelContexts.every((context) => Boolean(project.confirmedModelIds[context]?.length) || project.deferredModelContexts.includes(context));
  const canNext = (active !== 1 || project.selectedAnalysisIds.length > 0) && (active !== 4 || modelDecisionsComplete);
  const canAccess = (step: number) => (step <= 1 || project.selectedAnalysisIds.length > 0) && (step <= 4 || modelDecisionsComplete);
  const goNext = () => {
    if (!canNext) return;
    const next = Math.min(steps.length - 1, active + 1);
    setActive(next);
    setMaxReached((current) => Math.max(current, next));
  };
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector(".workspace-main")?.scrollTo({ top: 0, behavior: "auto" });
  }, [active]);
  const save = async () => {
    if (!window.gaia) return setToast("Tarayıcı önizlemesinde proje kaydı devre dışı.");
    const answer = await window.gaia.saveProject(project);
    if (!answer.canceled) setToast(answer.error ?? (answer.path ? `Proje kaydedildi: ${answer.path}` : "Proje kaydedilemedi."));
  };
  const exportBundle = async () => {
    if (!window.gaia) return setToast("Dışa aktarım masaüstü uygulamasında kullanılabilir.");
    setIsExporting(true);
    try {
      const answer = await window.gaia.exportBundle(result);
      setToast(answer.error ?? (answer.canceled ? "Dışa aktarım iptal edildi." : "DOCX, PDF ve Excel hazır. Çıktı klasörü açıldı."));
    } finally {
      setIsExporting(false);
    }
  };
  const importKnowledge = async () => {
    if (!window.gaia) return setToast("Bilgi paketi içe aktarımı masaüstü uygulamasında kullanılabilir.");
    const answer = await window.gaia.importKnowledge();
    if (answer.error) return setToast(answer.error);
    if (!answer.canceled) {
      const loaded = await window.gaia.getKnowledge();
      if (loaded) {
        setProject((current) => ({ ...current, knowledgeVersion: loaded.manifest.version, knowledgePackageId: loaded.manifest.packageId, knowledgeDigest: loaded.manifest.payloadSha256, confirmedModelIds: {}, deferredModelContexts: [] }));
        onKnowledgeChanged(loaded);
      }
      setToast(`Bilgi paketi yüklendi: ${answer.manifest?.version}`);
    }
  };
  return <div className="app-shell"><StepRail active={active} maxReached={maxReached} canAccess={canAccess} onStep={setActive} /><div className="workspace"><TopBar project={project} knowledge={knowledge} installedVersion={installedVersion} onHome={onHome} onSave={save} onImport={importKnowledge} /><main className="workspace-main">
    {active === 0 && <ProjectStep project={project} update={update} />}
    {active === 1 && <AnalysesStep project={project} update={update} />}
    {active === 2 && <UnitsStep project={project} update={update} />}
    {active === 3 && <ConditionsStep project={project} update={update} onOpenAnalyses={() => setActive(1)} />}
    {active === 4 && <ModelsStep project={project} update={update} knowledge={knowledge} />}
    {active === 5 && <ResultsStep result={result} project={project} onDetail={setDetail} />}
  </main><footer className="wizard-footer"><button className="button button-quiet" onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0}><ArrowLeft size={17} /> Geri</button><div><span>Adım {active + 1} / {steps.length}</span><div className="footer-progress"><i style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div></div>{active < steps.length - 1 ? <button className="button button-primary" onClick={goNext} disabled={!canNext}>Devam et <ArrowRight size={17} /></button> : <button className="button button-primary export-button" onClick={exportBundle} disabled={isExporting} aria-busy={isExporting}><Download size={17} />{isExporting ? "Dosyalar hazırlanıyor…" : result.engineeringUseAllowed ? "DOCX, PDF ve Excel oluştur" : "Taslak DOCX, PDF ve Excel oluştur"}</button>}</footer></div>
    <DetailDrawer requirement={detail} onClose={() => setDetail(null)} />
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast("")}><X size={15} /></button></div>}
  </div>;
}

export default function App() {
  const [knowledge, setKnowledge] = useState<KnowledgePackage>(builtInKnowledge);
  const [project, setProject] = useState<GaiaProject | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [appMessage, setAppMessage] = useState("");
  useEffect(() => {
    if (!window.gaia) return;
    void window.gaia.getInstalledGtsVersion().then(setInstalledVersion);
    void window.gaia.getKnowledge().then((loaded) => loaded && setKnowledge(loaded));
  }, []);
  const open = async () => {
    if (!window.gaia) return setAppMessage("Proje açma özelliği masaüstü uygulamasında kullanılabilir.");
    const answer = await window.gaia.openProject();
    if (answer.project) setProject(answer.project);
    else if (answer.error) setAppMessage(answer.error);
  };
  if (!project) return <><Landing onNew={() => setProject(newProject(knowledge))} onOpen={open} installedVersion={installedVersion} />{appMessage && <div className="toast" role="status"><AlertTriangle size={18} /><span>{appMessage}</span><button onClick={() => setAppMessage("")}><X size={15} /></button></div>}</>;
  return <Wizard initialProject={project} knowledge={knowledge} installedVersion={installedVersion} onHome={() => { window.scrollTo({ top: 0, behavior: "auto" }); setProject(null); }} onKnowledgeChanged={setKnowledge} />;
}
