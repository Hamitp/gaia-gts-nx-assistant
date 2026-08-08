import type { GaiaProject, KnowledgePayload, ModelRecommendation } from "../domain/types.js";

export function recommendModels(project: GaiaProject, payload: KnowledgePayload): ModelRecommendation[] {
  const recommendations: ModelRecommendation[] = [];

  for (const analysisId of project.selectedAnalysisIds) {
    for (const unit of project.groundUnits) {
      if (unit.soilType === "unknown") continue;
      const candidates = payload.models
        .filter((model) => model.analysisIds.includes(analysisId))
        .map((model) => {
          const soilMatch = model.suitableSoils.includes(unit.soilType);
          let score = 40;
          const reasons: string[] = [];
          if (soilMatch) {
            score += 40;
            reasons.push(`${unit.name} için seçilen zemin/kaya türüyle uyumlu.`);
          } else {
            score -= 30;
            reasons.push("Katalogdaki tipik kullanım alanı bu jeoteknik birimle eşleşmiyor.");
          }
          if (model.expertOnly) {
            score -= 10;
            reasons.push("İleri kalibrasyon ve bağımsız uzman kontrolü gerektirir.");
          } else {
            reasons.push("Parametre seti standart veri talep akışıyla izlenebilir.");
          }
          if (model.catalogueStatus === "verified-core") {
            score += 100;
            reasons.push("Çekirdek GTS NX alan seti review build kapsamında doğrulandı.");
          } else if (model.catalogueStatus === "partial") {
            score -= 30;
            reasons.push("Model alan matrisi kısmen doğrulandı; bu sürümde seçime kapalıdır.");
          } else {
            score -= 100;
            reasons.push("Model alan matrisi bağımsız uzman incelemesi tamamlanana kadar kilitlidir.");
          }
          if (model.warning) reasons.push(model.warning);

          return {
            unitId: unit.id,
            analysisId,
            model,
            status: model.catalogueStatus !== "verified-core" || model.expertOnly ? "expert-only" as const : soilMatch ? "recommended" as const : "possible" as const,
            score,
            reasons,
            missingParameterIds: [...model.parameterIds],
          };
        })
        .sort((a, b) => b.score - a.score || a.model.name.localeCompare(b.model.name));

      recommendations.push(...candidates);
    }
  }

  return recommendations;
}
