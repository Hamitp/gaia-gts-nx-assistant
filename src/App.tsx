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

const steps = [
  { label: "Proje", hint: "Temel bilgiler", icon: FileText },
  { label: "Analizler", hint: "Bir veya daha fazla", icon: Gauge },
  { label: "Birimler", hint: "Zemin ve kaya", icon: Layers3 },
  { label: "Koşullar", hint: "Su ve drenaj", icon: Droplets },
  { label: "Modeller", hint: "Gerekçeli seçim", icon: Sparkles },
  { label: "Talep", hint: "Tekrarsız sonuç", icon: ClipboardCheck },
];

const analysisIcons: Record<string, typeof Gauge> = {
  Statik: Mountain,
  Stabilite: Mountain,
  Sızma: Droplets,
  "Bağlı analiz": Waves,
  Konsolidasyon: Layers3,
  Dinamik: Waves,
  "Modelleme kapsamı": ShieldCheck,
};

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
  const [query, setQuery] = useState("");
  const groups = [...new Set(analyses.map((analysis) => analysis.group))];
  const toggle = (id: string) => update({ selectedAnalysisIds: project.selectedAnalysisIds.includes(id) ? project.selectedAnalysisIds.filter((item) => item !== id) : [...project.selectedAnalysisIds, id] });
  return (
    <div className="step-content">
      <SectionIntro eyebrow="02 · Analiz kapsamı" title="Hangi analizleri yapacaksınız?" text="Aynı projede istediğiniz kadar analiz seçin. Ortak veri ihtiyaçları sonuçta otomatik olarak tekilleştirilir." aside={<div className="selection-count"><strong>{project.selectedAnalysisIds.length}</strong><span>analiz seçildi</span></div>} />
      <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Analiz ara: konsolidasyon, dinamik, kazık…" aria-label="Analiz ara" />{query && <button onClick={() => setQuery("")} aria-label="Aramayı temizle"><X size={16} /></button>}</div>
      <div className="analysis-groups">
        {groups.map((group) => {
          const visible = analyses.filter((analysis) => analysis.group === group && `${analysis.nameTr} ${analysis.officialName} ${analysis.summary}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
          if (!visible.length) return null;
          const Icon = analysisIcons[group] ?? Gauge;
          return <section key={group} className="analysis-group"><h3><Icon size={18} /> {group}<span>{visible.length}</span></h3><div className="analysis-grid">
            {visible.map((analysis) => {
              const checked = project.selectedAnalysisIds.includes(analysis.id);
              return <button key={analysis.id} className={`analysis-card ${checked ? "selected" : ""}`} onClick={() => toggle(analysis.id)} aria-pressed={checked}>
                <span className="check-box">{checked && <Check size={15} />}</span>
                <div><strong>{analysis.nameTr}</strong><small>{analysis.officialName}</small><p>{analysis.summary}</p><em>{analysis.example}</em></div>
              </button>;
            })}
          </div></section>;
        })}
      </div>
      {!project.selectedAnalysisIds.length && <div className="empty-inline"><CircleHelp size={20} /><span>Devam etmek için en az bir analiz seçin.</span></div>}
    </div>
  );
}

function UnitsStep({ project, update }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void }) {
  const updateUnit = (id: string, patch: Partial<GroundUnit>) => update({ groundUnits: project.groundUnits.map((unit) => unit.id === id ? { ...unit, ...patch } : unit) });
  const remove = (id: string) => project.groundUnits.length > 1 && update({ groundUnits: project.groundUnits.filter((unit) => unit.id !== id) });
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

function ConditionsStep({ project, update }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void }) {
  const setCondition = <K extends keyof GaiaProject["conditions"]>(key: K, value: GaiaProject["conditions"][K]) => {
    const linked: Partial<Record<keyof GaiaProject["conditions"], string>> = { constructionStages: "construction-stage", interfacePresent: "interface", pilePresent: "pile-soil" };
    const linkedAnalysis = linked[key];
    const selectedAnalysisIds = value === true && linkedAnalysis && !project.selectedAnalysisIds.includes(linkedAnalysis) ? [...project.selectedAnalysisIds, linkedAnalysis] : project.selectedAnalysisIds;
    update({ conditions: { ...project.conditions, [key]: value }, selectedAnalysisIds });
  };
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
      </div></div>
    </div>
  );
}

function ModelsStep({ project, update, knowledge }: { project: GaiaProject; update: (patch: Partial<GaiaProject>) => void; knowledge: KnowledgePackage }) {
  const recommendations = useMemo(() => recommendModels(project, knowledge.payload), [project, knowledge]);
  const contexts = project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => ({ analysisId, unit })));
  const select = (context: string, modelId: string) => update({ confirmedModelIds: { ...project.confirmedModelIds, [context]: [modelId] }, deferredModelContexts: project.deferredModelContexts.filter((item) => item !== context) });
  const defer = (context: string) => {
    const confirmedModelIds = { ...project.confirmedModelIds };
    delete confirmedModelIds[context];
    update({ confirmedModelIds, deferredModelContexts: [...new Set([...project.deferredModelContexts, context])] });
  };
  return (
    <div className="step-content">
      <SectionIntro eyebrow="05 · Malzeme modeli" title="Modeli siz seçin; GAIA gerekçeyi görünür kılsın" text="Öneriler analiz ve jeoteknik birim için ayrı hazırlanır. En yüksek puan otomatik karar değildir; nihai seçimi siz onaylarsınız." />
      {!contexts.length ? <div className="empty-state"><Sparkles size={30} /><h3>Öneri için önce analiz seçin</h3><p>Analiz ve birim bilgileri tamamlandığında uygun modeller burada sıralanır.</p></div> : <div className="model-contexts">
        {contexts.map(({ analysisId, unit }) => {
          const contextKey = `${analysisId}:${unit.id}`;
          const analysis = knowledge.payload.analyses.find((item) => item.id === analysisId);
          const candidates = recommendations.filter((item) => item.analysisId === analysisId && item.unitId === unit.id);
          const hasSelectableCandidate = candidates.some((candidate) => candidate.model.catalogueStatus === "verified-core");
          const selected = project.confirmedModelIds[contextKey]?.[0];
          const deferred = project.deferredModelContexts.includes(contextKey);
          return <article className="model-context" key={contextKey}>
            <header><div><span>{analysis?.nameTr}</span><h3>{unit.name}</h3><small>{soilOptions.find((item) => item.value === unit.soilType)?.label}</small></div>{selected ? <div className="context-status ok"><CheckCircle2 size={16} /> Model kullanıcı tarafından seçildi</div> : deferred ? <div className="context-status ok"><CheckCircle2 size={16} /> Karar verisi talebe eklendi</div> : !hasSelectableCandidate ? <div className="context-status"><AlertTriangle size={16} /> Güvenli ilerleme onayı bekleniyor</div> : <div className="context-status"><AlertTriangle size={16} /> Seçim bekliyor</div>}</header>
            <div className="model-cards">
              {!hasSelectableCandidate && <div className={`locked-model-route ${deferred ? "selected" : ""}`} role="status">
                <div className="locked-route-icon">{deferred ? <CheckCircle2 size={22} /> : <ShieldCheck size={22} />}</div>
                <div><strong>{deferred ? "Karar verisi talebe eklendi" : "Bu koşulda doğrulanmış seçilebilir model yok"}</strong><p>{deferred ? "GAIA model uydurmadı. Bu analiz ve birim için model kararını tamamlatacak temel veriler sonuç paketine bağlandı; şimdi Talep adımına geçebilirsiniz." : "GAIA doğrulanmamış bir modeli kullandırmaz. Model seçmeden ilerleyip sınıflandırma, gerilme geçmişi ve davranış verilerini geoteknik ekipten isteyebilirsiniz."}</p></div>
                <button className={`button ${deferred ? "button-secondary" : "button-primary"}`} onClick={() => defer(contextKey)} aria-pressed={deferred}>{deferred ? <><Check size={17} /> Talebe eklendi</> : <>Karar verisi talebiyle devam et <ArrowRight size={17} /></>}</button>
              </div>}
              {hasSelectableCandidate && candidates.slice(0, 3).map((candidate, index) => {
                const locked = candidate.model.catalogueStatus !== "verified-core";
                return <button key={candidate.model.id} className={`model-card ${selected === candidate.model.id ? "selected" : ""} ${locked ? "locked" : ""}`} disabled={locked} onClick={() => select(contextKey, candidate.model.id)} aria-pressed={selected === candidate.model.id}>
                <div className="model-rank">{locked ? <ShieldCheck size={14} /> : index + 1}</div><div className="model-main"><div className="model-title"><strong>{candidate.model.nameTr}</strong><span>{candidate.model.name}</span>{locked ? <em>Katalog doğrulaması bekleniyor</em> : candidate.model.expertOnly && <em>Uzman kalibrasyonu</em>}</div><p>{candidate.model.behaviour}</p><ul>{(locked ? candidate.model.unverifiedFields : candidate.reasons).slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul><small>{locked ? "Bu model review build’de seçilemez" : `${candidate.model.parameterIds.length} veri girdisi talebe bağlanır`}</small></div><span className="radio-dot">{selected === candidate.model.id && <i />}</span>
              </button>;
              })}
              {hasSelectableCandidate && <button className={`defer-model ${deferred ? "selected" : ""}`} onClick={() => defer(contextKey)} aria-pressed={deferred}><CircleHelp size={18} /><span><strong>Model kararını şimdilik ertele</strong><small>GAIA bir model varsaymayacak; karar verebilmek için gerekli temel verileri isteyecek.</small></span>{deferred && <CheckCircle2 size={18} />}</button>}
              {!hasSelectableCandidate && candidates.length > 0 && <details className="model-catalogue-details locked-model-details"><summary>Kilitli model önerilerini incele <span>{candidates.length}</span></summary><div>{candidates.map((candidate) => <article key={candidate.model.id}><div><strong>{candidate.model.nameTr}</strong><small>{candidate.model.name}</small></div><span className={`catalogue-state ${candidate.model.catalogueStatus}`}>{candidate.model.catalogueStatus === "partial" ? "Kısmi — kilitli" : "Kilitli"}</span><p>{candidate.model.unverifiedFields[0] ?? candidate.reasons[0]}</p></article>)}</div></details>}
              {hasSelectableCandidate && candidates.length > 3 && <details className="model-catalogue-details"><summary>Tüm model alternatiflerini incele <span>{candidates.length}</span></summary><div>{candidates.slice(3).map((candidate) => <article key={candidate.model.id}><div><strong>{candidate.model.nameTr}</strong><small>{candidate.model.name}</small></div><span className={`catalogue-state ${candidate.model.catalogueStatus}`}>{candidate.model.catalogueStatus === "verified-core" ? "Çekirdek doğrulandı" : candidate.model.catalogueStatus === "partial" ? "Kısmi — kilitli" : "Kilitli"}</span><p>{candidate.reasons[0]}</p></article>)}</div></details>}
            </div>
          </article>;
        })}
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

function ResultsStep({ result, project, onExport, onDetail }: { result: CanonicalResult; project: GaiaProject; onExport: () => void; onDetail: (req: ConsolidatedRequirement) => void }) {
  const [view, setView] = useState<"parameters" | "tests" | "models" | "quality">("parameters");
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
  return (
    <div className="step-content result-step">
      <SectionIntro eyebrow="06 · Birleştirilmiş talep" title="Tek proje. Tekrarsız, izlenebilir veri paketi." text={`${rawUses} analiz kullanımından ${result.requirements.length} mühendislik koşulu oluşturuldu; ${mergedCount} tekrar güvenli biçimde birleştirildi.`} aside={<button className="button button-primary" onClick={onExport}><Download size={18} /> {result.engineeringUseAllowed ? "Talep paketini oluştur" : "İnceleme taslağını oluştur"}</button>} />
      {result.warnings.length > 0 && <div className="warning-panel"><AlertTriangle size={20} /><div><strong>Dışa aktarmadan önce dikkat</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
      <div className="metric-grid">
        <div className="metric-card"><span className="metric-icon mint"><ClipboardCheck size={20} /></span><div><strong>{uniqueParameterCount} / {result.requirements.length}</strong><small>parametre / mühendislik koşulu</small></div></div>
        <div className="metric-card"><span className="metric-icon blue"><FlaskConical size={20} /></span><div><strong>{result.tests.length}</strong><small>birleştirilmiş deney satırı</small></div></div>
        <div className="metric-card"><span className="metric-icon gold"><Layers3 size={20} /></span><div><strong>{project.groundUnits.length}</strong><small>jeoteknik birim</small></div></div>
        <div className="metric-card"><span className="metric-icon slate"><FileArchive size={20} /></span><div><strong>3</strong><small>eş içerikli çıktı biçimi</small></div></div>
      </div>
      <div className="result-view-tabs" role="tablist" aria-label="Sonuç bölümleri">
        {[{ id: "parameters", label: "Parametre talepleri", count: result.requirements.length }, { id: "tests", label: "Deney programı", count: result.tests.length }, { id: "models", label: "Model kararları", count: Object.keys(project.confirmedModelIds).length + project.deferredModelContexts.length }, { id: "quality", label: "Kalite ve kaynaklar", count: result.warnings.length }].map((tab) => <button key={tab.id} role="tab" aria-selected={view === tab.id} className={view === tab.id ? "active" : ""} onClick={() => setView(tab.id as typeof view)}>{tab.label}<span>{tab.count}</span></button>)}
      </div>
      {view === "parameters" && <>
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
      </>}
      {view === "tests" && <div className="result-table-wrap"><table className="result-table test-program-table"><thead><tr><th>Deney / standart</th><th>Sağlayacağı parametreler</th><th>Analizler ve durum–birim eşlemesi</th><th>İstenecek ham teslimler</th></tr></thead><tbody>{result.tests.map((item) => <tr key={item.id}>
        <td data-label="Deney / standart"><strong>{item.method.nameTr}</strong><small>{item.method.nameEn}<br />{item.method.standardPrimary}</small></td>
        <td data-label="Sağlayacağı parametreler"><div className="tag-list">{item.parameterIds.map((id) => <span key={id}>{parameters.find((p) => p.id === id)?.nameTr ?? id}</span>)}</div></td>
        <td data-label="Analizler ve durum–birim eşlemesi"><p>{item.analysisIds.map((id) => analyses.find((a) => a.id === id)?.nameTr ?? id).join(" · ")}</p><div className="variant-list">{item.applicability.map((use) => <span key={`${use.requirementId}:${use.level}`}><b>{levelCopy[use.level].label}</b><small>{use.groundUnitIds.map((id) => project.groundUnits.find((u) => u.id === id)?.name ?? id).join(" · ") || "Proje geneli"}</small></span>)}</div></td>
        <td data-label="İstenecek ham teslimler"><ul className="raw-list">{item.method.rawDeliverables.map((raw) => <li key={raw}>{raw}</li>)}</ul></td>
      </tr>)}</tbody></table></div>}
      {view === "models" && <div className="decision-grid">{project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => { const key = `${analysisId}:${unit.id}`; const modelId = project.confirmedModelIds[key]?.[0]; const model = models.find((item) => item.id === modelId); return <article key={key}><span>{analyses.find((item) => item.id === analysisId)?.nameTr}</span><h3>{unit.name}</h3>{model ? <p><CheckCircle2 size={16} /> Kullanıcı seçimi: <strong>{model.nameTr}</strong></p> : <p className="deferred"><CircleHelp size={16} /> Model kararı ertelendi; veri istenecek.</p>}</article>; }))}</div>}
      {view === "quality" && <div className="quality-grid"><section><h3>Kritik uyarılar</h3>{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={15} />{warning}</p>)}</section><section><h3>Kaynak izi</h3>{result.sources.map((source) => <p key={source.id}><BookOpen size={15} /><span><strong>{source.title}</strong><small>{source.locator} · doğrulama {source.verifiedAt}</small></span></p>)}</section></div>}
      <div className="parity-note"><ShieldCheck size={18} /><div><strong>Tek kaynak, üç çıktı</strong><p>DOCX, PDF ve XLSX aynı {result.requirements.length} parametre ile {result.tests.length} deney kimliğinden üretilir. İçerik farkı oluşmasına izin verilmez.</p></div></div>
    </div>
  );
}

function Wizard({ initialProject, knowledge, installedVersion, onHome, onKnowledgeChanged }: { initialProject: GaiaProject; knowledge: KnowledgePackage; installedVersion: string | null; onHome: () => void; onKnowledgeChanged: (knowledge: KnowledgePackage) => void }) {
  const [project, setProject] = useState(initialProject);
  const [active, setActive] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [detail, setDetail] = useState<ConsolidatedRequirement | null>(null);
  const [toast, setToast] = useState("");
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
    const answer = await window.gaia.exportBundle(result);
    setToast(answer.error ?? (answer.canceled ? "Dışa aktarım iptal edildi." : `Paket hazır: ${answer.directory}`));
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
    {active === 3 && <ConditionsStep project={project} update={update} />}
    {active === 4 && <ModelsStep project={project} update={update} knowledge={knowledge} />}
    {active === 5 && <ResultsStep result={result} project={project} onExport={exportBundle} onDetail={setDetail} />}
  </main><footer className="wizard-footer"><button className="button button-quiet" onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0}><ArrowLeft size={17} /> Geri</button><div><span>Adım {active + 1} / {steps.length}</span><div className="footer-progress"><i style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div></div>{active < steps.length - 1 ? <button className="button button-primary" onClick={goNext} disabled={!canNext}>Devam et <ArrowRight size={17} /></button> : <span className="footer-complete"><CheckCircle2 size={16} /> Sonuç hazır</span>}</footer></div>
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
