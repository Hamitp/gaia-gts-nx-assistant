import type { GaiaProject, KnowledgePackage } from "./types.js";

export function validateProjectReferences(project: GaiaProject, knowledge: KnowledgePackage): void {
  if (project.knowledgeVersion !== knowledge.manifest.version || project.knowledgePackageId !== knowledge.manifest.packageId || project.knowledgeDigest !== knowledge.manifest.payloadSha256) {
    throw new Error(`Proje ${project.knowledgeVersion} bilgi paketiyle oluşturulmuş; aktif paket ${knowledge.manifest.version}. Otomatik dönüştürme yapılmadı.`);
  }
  const analysisIds = new Set(knowledge.payload.analyses.map((item) => item.id));
  const unitById = new Map(project.groundUnits.map((unit) => [unit.id, unit]));
  const modelById = new Map(knowledge.payload.models.map((model) => [model.id, model]));
  for (const id of project.selectedAnalysisIds) if (!analysisIds.has(id)) throw new Error(`Projede aktif bilgi paketinde bulunmayan analiz var: ${id}`);
  const knownContexts = new Set(project.selectedAnalysisIds.flatMap((analysisId) => project.groundUnits.map((unit) => `${analysisId}:${unit.id}`)));
  for (const [context, modelIds] of Object.entries(project.confirmedModelIds)) {
    if (!knownContexts.has(context)) throw new Error(`Geçersiz analiz–birim model bağlamı: ${context}`);
    const analysisId = project.selectedAnalysisIds.find((id) => context.startsWith(`${id}:`));
    const unitId = analysisId ? context.slice(analysisId.length + 1) : "";
    const unit = unitById.get(unitId);
    if (modelIds.length !== 1) throw new Error(`${context} bağlamında tam olarak bir malzeme modeli seçilmelidir.`);
    if (project.deferredModelContexts.includes(context)) throw new Error(`${context} bağlamı hem seçilmiş hem ertelenmiş olamaz.`);
    if (unit?.soilType === "unknown") throw new Error(`${unit.name} biriminin türü bilinmeden malzeme modeli seçilemez; karar açıkça ertelenmelidir.`);
    for (const modelId of modelIds) {
      const model = modelById.get(modelId);
      if (!model) throw new Error(`Projede aktif bilgi paketinde bulunmayan model var: ${modelId}`);
      if (model.catalogueStatus !== "verified-core") throw new Error(`${model.name} modeli bu review build'de seçime açık değildir.`);
      if (!analysisId || !model.analysisIds.includes(analysisId)) throw new Error(`${model.name}, ${analysisId} analiziyle uyumlu değildir.`);
      if (unit && !model.suitableSoils.includes(unit.soilType)) throw new Error(`${model.name}, ${unit.name} birim türüyle katalog kapsamında uyumlu değildir.`);
    }
  }
  for (const context of project.deferredModelContexts) if (!knownContexts.has(context)) throw new Error(`Geçersiz ertelenmiş model bağlamı: ${context}`);
}
