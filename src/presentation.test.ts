import { describe, expect, it } from "vitest";
import { analyses, models } from "./data/catalogue";
import { analysisChoiceCopy, analysisPurposes, modelDecisionCopy } from "./presentation";

describe("sade karar dili kataloğu", () => {
  it("bütün analizleri bir ve yalnız bir kullanıcı amacına bağlar", () => {
    const mapped = analysisPurposes.flatMap((purpose) => purpose.analysisIds);
    expect([...mapped].sort()).toEqual(analyses.map((analysis) => analysis.id).sort());
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(mapped.every((id) => Boolean(analysisChoiceCopy[id]))).toBe(true);
  });

  it("bütün seçilebilir çekirdek modeller için sade karar açıklaması içerir", () => {
    const selectable = models.filter((model) => model.catalogueStatus === "verified-core");
    expect(selectable.length).toBeGreaterThan(0);
    expect(selectable.every((model) => Boolean(modelDecisionCopy[model.id]))).toBe(true);
  });

  it("kazık, arayüz ve donatıyı tek başına analiz değil ek kapsam olarak ayırır", () => {
    const extra = analysisPurposes.find((purpose) => purpose.id === "interaction");
    expect(extra?.extraScope).toBe(true);
    expect(extra?.analysisIds.sort()).toEqual(["interface", "pile-soil", "reinforced-soil"].sort());
  });
});
