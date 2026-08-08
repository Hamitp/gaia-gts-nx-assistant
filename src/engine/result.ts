import type { CanonicalResult, GaiaProject, KnowledgePackage } from "../domain/types.js";
import { consolidateRequirements, consolidateTests } from "./requirements.js";
import { recommendModels } from "./recommend.js";

export const APP_VERSION = "0.1.0-review.1";

export function buildWarnings(project: GaiaProject, knowledge: KnowledgePackage): string[] {
  const warnings: string[] = [];
  if (knowledge.manifest.expertReview.status !== "approved") {
    warnings.push("Bilgi paketi bağımsız geoteknik uzman tarafından onaylanmamıştır. Çıktı yalnız inceleme amaçlıdır.");
  }
  if (!project.coordinateSystem.trim() || !project.verticalDatum.trim()) {
    warnings.push("Koordinat sistemi veya düşey datum eksik; resmî veri talebi yayımlanmadan tamamlanmalıdır.");
  }
  if (project.conditions.groundwater === "unknown") {
    warnings.push("Yeraltı suyu koşulu bilinmiyor; etkin gerilme ve drenaj kararları doğrulanamaz.");
  }
  if (project.conditions.drainageDecision === "unknown") {
    warnings.push("Drenaj kararı bilinmiyor; toplam/efektif gerilme parametreleri uzman tarafından ayrıştırılmalıdır.");
  }
  if (project.groundUnits.some((unit) => unit.soilType === "unknown")) {
    warnings.push("En az bir jeoteknik birimin türü bilinmiyor; model önerileri kesin karar olarak kullanılamaz.");
  }
  if (!project.selectedAnalysisIds.length) warnings.push("Henüz analiz seçilmedi.");
  if (project.deferredModelContexts.length) warnings.push(`${project.deferredModelContexts.length} analiz–birim bağlamında malzeme modeli ertelendi; model seçimine özgü ek girdiler henüz talep paketinde yoktur.`);
  const unresolvedModelContexts = project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => `${analysisId}:${unit.id}`)).filter((context) => !(project.confirmedModelIds[context]?.length) && !project.deferredModelContexts.includes(context));
  if (unresolvedModelContexts.length) warnings.push(`${unresolvedModelContexts.length} analiz–birim bağlamında model seçimi veya açık erteleme kararı yoktur.`);
  const dynamicIds = new Set(["eigenvalue", "response-spectrum", "linear-time-history-modal", "linear-time-history-direct", "nonlinear-time-history", "equivalent-linear-2d", "nonlinear-time-history-srm"]);
  if (project.conditions.dynamicLoading && !project.selectedAnalysisIds.some((id) => dynamicIds.has(id))) warnings.push("Dinamik yükleme işaretlendi fakat dinamik analiz türü seçilmedi; uygun çözüm türü kararı tamamlanmalıdır.");
  if (!project.conditions.dynamicLoading && project.selectedAnalysisIds.some((id) => dynamicIds.has(id))) warnings.push("Dinamik analiz seçildi fakat proje koşullarında dinamik yükleme işaretlenmedi; yükleme kapsamı doğrulanmalıdır.");
  if (project.selectedAnalysisIds.some((id) => dynamicIds.has(id)) && project.groundUnits.some((unit) => unit.cyclicRisk === "unknown")) warnings.push("Dinamik analiz kapsamındaki en az bir birimde çevrimsel risk kararı bilinmiyor; ilgili gereksinimler karar eksik olarak işaretlendi.");
  if (project.groundUnits.some((unit) => unit.saturation === "unknown")) warnings.push("En az bir birimde doygunluk durumu bilinmiyor; doygun birim hacim ağırlık ve doygun olmayan davranış talepleri koşula bağlandı.");
  if (project.conditions.interfacePresent && !project.selectedAnalysisIds.includes("interface")) warnings.push("Arayüz varlığı işaretlendi fakat zemin-yapı arayüzü modelleme kapsamı seçilmedi.");
  if (project.conditions.pilePresent && !project.selectedAnalysisIds.includes("pile-soil")) warnings.push("Kazık sistemi işaretlendi fakat kazık-zemin modelleme kapsamı seçilmedi.");
  return warnings;
}

export function buildCanonicalResult(project: GaiaProject, knowledge: KnowledgePackage): CanonicalResult {
  const requirements = consolidateRequirements(project, knowledge.payload);
  const warnings = buildWarnings(project, knowledge);
  const expectedModelContexts = project.selectedAnalysisIds.length * project.groundUnits.length;
  const decidedModelContexts = new Set([
    ...Object.entries(project.confirmedModelIds).filter(([, ids]) => ids.length).map(([context]) => context),
    ...project.deferredModelContexts,
  ]).size;
  const projectReady = Boolean(
    project.selectedAnalysisIds.length
    && project.groundUnits.length
    && project.coordinateSystem.trim()
    && project.verticalDatum.trim()
    && project.groundUnits.every((unit) => unit.soilType !== "unknown")
    && Object.values(project.confirmedModelIds).every((ids) => ids.length === 1)
    && decidedModelContexts === expectedModelContexts
    && !project.deferredModelContexts.length
    && !requirements.some((item) => item.level === "missing-decision"),
  );
  const dynamicIds = new Set(["eigenvalue", "response-spectrum", "linear-time-history-modal", "linear-time-history-direct", "nonlinear-time-history", "equivalent-linear-2d", "nonlinear-time-history-srm"]);
  const hasDynamicAnalysis = project.selectedAnalysisIds.some((id) => dynamicIds.has(id));
  const engineeringUseAllowed = knowledge.manifest.expertReview.status === "approved"
    && projectReady
    && (!hasDynamicAnalysis || (project.conditions.dynamicLoading && project.groundUnits.every((unit) => unit.cyclicRisk !== "unknown")));
  return {
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    knowledgeVersion: knowledge.manifest.version,
    knowledgeDigest: knowledge.manifest.payloadSha256,
    knowledgePackageId: knowledge.manifest.packageId,
    engineeringUseAllowed,
    analysisLabels: Object.fromEntries(knowledge.payload.analyses.filter((analysis) => project.selectedAnalysisIds.includes(analysis.id)).map((analysis) => [analysis.id, { nameTr: analysis.nameTr, officialName: analysis.officialName }])),
    project,
    requirements,
    tests: consolidateTests(requirements, knowledge.payload, project),
    recommendations: recommendModels(project, knowledge.payload),
    warnings,
    sources: knowledge.payload.sources,
  };
}
