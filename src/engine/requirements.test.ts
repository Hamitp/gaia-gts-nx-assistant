import { describe, expect, it } from "vitest";
import { builtInKnowledge, parameters } from "../data/catalogue";
import type { AnalysisDefinition, GaiaProject, GroundUnit, KnowledgePayload, RequirementTemplate } from "../domain/types";
import { assertKnowledgeReferences, KnowledgePackageSchema } from "../domain/schemas";
import { consolidateRequirements, consolidateTests } from "./requirements";

const unitA: GroundUnit = { id: "GU-A", name: "Kum", soilType: "sand", description: "", saturation: "saturated", consolidationState: "unknown", cyclicRisk: "no" };
const unitB: GroundUnit = { ...unitA, id: "GU-B", name: "Kil", soilType: "clay" };
const rockUnit: GroundUnit = { ...unitA, id: "GU-R", name: "Kaya", soilType: "rock-mass" };

function project(selectedAnalysisIds: string[], groundUnits: GroundUnit[] = [unitA, unitB]): GaiaProject {
  return {
    schemaVersion: "1.0", id: "P-1", name: "Test", location: "", client: "", description: "", coordinateSystem: "ITRF", verticalDatum: "TUDKA",
    selectedAnalysisIds, groundUnits, conditions: { groundwater: "static", drainageDecision: "both", constructionStages: false, dynamicLoading: false, interfacePresent: false, pilePresent: false },
    confirmedModelIds: {}, deferredModelContexts: [], createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z", knowledgeVersion: builtInKnowledge.manifest.version, knowledgePackageId: builtInKnowledge.manifest.packageId, knowledgeDigest: builtInKnowledge.manifest.payloadSha256,
  };
}

function payloadFor(parameterId: string, templates: RequirementTemplate[]): KnowledgePayload {
  const definition = parameters.find((item) => item.id === parameterId)!;
  const syntheticAnalyses: AnalysisDefinition[] = templates.map((template, index) => ({ id: `a-${index}`, group: "Test", nameTr: `Analiz ${index}`, officialName: `Analysis ${index}`, summary: "Test", example: "Test", requirements: [{ ...template, parameterId }], sourceIds: ["gts-analysis-v310"] }));
  return { ...builtInKnowledge.payload, analyses: syntheticAnalyses };
}

describe("bilgi paketi bütünlüğü", () => {
  it("yerleşik kataloğu sıkı şema ve referans denetiminden geçirir", () => {
    const parsed = KnowledgePackageSchema.parse(builtInKnowledge);
    expect(() => assertKnowledgeReferences(parsed)).not.toThrow();
  });
});

describe("tüm parametrelerde anlamsal tekilleştirme", () => {
  it.each(parameters.map((parameter) => [parameter.id, parameter.group] as const))("%s aynı bağlamdaki üç analiz katkısını tek satıra indirir", (parameterId, group) => {
    const template = { parameterId, level: "required" as const, drainage: "drained" as const, strengthState: "peak" as const, stressPath: "compression", direction: "vertical" as const, strainRange: "working", specimenCondition: "undisturbed" };
    const payload = payloadFor(parameterId, [template, template, template]);
    const units = group === "Kaya" || group === "Anizotropi" ? [rockUnit] : [unitA, unitB];
    const result = consolidateRequirements(project(["a-0", "a-1", "a-2"], units), payload);
    expect(result).toHaveLength(1);
    expect(result[0].analysisIds).toHaveLength(3);
    if (result[0].parameter.scope === "ground-unit") expect(result[0].groundUnitIds).toEqual(units.map((unit) => unit.id));
  });

  it("pik ve rezidüel φ′ değerlerini ayırır", () => {
    const payload = payloadFor("friction-angle-effective", [
      { parameterId: "friction-angle-effective", level: "required", drainage: "drained", strengthState: "peak" },
      { parameterId: "friction-angle-effective", level: "required", drainage: "drained", strengthState: "peak" },
      { parameterId: "friction-angle-effective", level: "conditional", drainage: "drained", strengthState: "residual" },
    ]);
    const result = consolidateRequirements(project(["a-0", "a-1", "a-2"]), payload);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.strengthState === "peak")?.analysisIds).toHaveLength(2);
    expect(result.find((item) => item.strengthState === "residual")?.analysisIds).toHaveLength(1);
  });

  it("analiz ve seçilen model aynı parametreyi isterse ikinci satır üretmez", () => {
    const p = project(["nonlinear-static"], [unitA]);
    p.confirmedModelIds["nonlinear-static:GU-A"] = ["mohr-coulomb"];
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    const peakPhi = result.filter((item) => item.parameter.id === "friction-angle-effective" && item.strengthState === "peak");
    expect(peakPhi).toHaveLength(1);
    expect(peakPhi[0].modelIds).toContain("mohr-coulomb");
  });

  it("aynı ödometre protokolünü bir kez listeler ve tüm çıktıları bağlar", () => {
    const payload = builtInKnowledge.payload;
    const p = project(["consolidation"]);
    const result = consolidateRequirements(p, payload);
    const program = consolidateTests(result, payload, p);
    const oedometer = program.filter((item) => item.method.id === "oedometer");
    expect(oedometer).toHaveLength(1);
    expect(oedometer[0].parameterIds).toEqual(expect.arrayContaining(["compression-index", "swelling-index", "preconsolidation", "cv"]));
  });

  it("bilinmeyen katalog referansını sessizce atmaz", () => {
    const payload = payloadFor("young-modulus", [{ parameterId: "does-not-exist", level: "required" }]);
    payload.analyses[0].requirements[0].parameterId = "does-not-exist";
    expect(() => consolidateRequirements(project(["a-0"]), payload)).toThrow(/bilinmeyen|bulunamadı/i);
  });

  it("drenaj kararı bütün dayanım parametrelerinde zorunluluk durumunu değiştirir", () => {
    const payload = payloadFor("cohesion-effective", [
      { parameterId: "cohesion-effective", level: "required", drainage: "drained", strengthState: "peak" },
      { parameterId: "cohesion-effective", level: "conditional", drainage: "undrained-effective", strengthState: "peak" },
    ]);
    const drainedProject = project(["a-0", "a-1"]);
    drainedProject.conditions.drainageDecision = "drained";
    const undrainedProject = project(["a-0", "a-1"]);
    undrainedProject.conditions.drainageDecision = "undrained";
    const unknownProject = project(["a-0", "a-1"]);
    unknownProject.conditions.drainageDecision = "unknown";
    const drained = consolidateRequirements(drainedProject, payload);
    const undrained = consolidateRequirements(undrainedProject, payload);
    const unknown = consolidateRequirements(unknownProject, payload);
    expect(drained.find((item) => item.drainage === "drained")?.level).toBe("required");
    expect(undrained.find((item) => item.drainage === "undrained-effective")?.level).toBe("required");
    expect(unknown.every((item) => item.level === "missing-decision")).toBe(true);
  });

  it.each([
    ["yes", "required"],
    ["no", "conditional"],
    ["unknown", "missing-decision"],
  ] as const)("çevrimsel risk %s iken sıvılaşma gereksinimi %s olur", (cyclicRisk, level) => {
    const unit: GroundUnit = { ...unitA, cyclicRisk };
    const p = project(["nonlinear-time-history"], [unit]);
    p.conditions.dynamicLoading = true;
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    expect(result.find((item) => item.parameter.id === "liquefaction-resistance")?.level).toBe(level);
  });

  it("doygun olmayan birimde SWCC talebini zorunlu yapar", () => {
    const unit: GroundUnit = { ...unitA, saturation: "unsaturated" };
    const result = consolidateRequirements(project(["transient-seepage"], [unit]), builtInKnowledge.payload);
    expect(result.find((item) => item.parameter.id === "swcc-curve")?.level).toBe("required");
  });

  it("kaya E gereksinimini zemin CIU yerine kaya deformabilite deneyine bağlar", () => {
    const p = project(["linear-static"], [rockUnit]);
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    const program = consolidateTests(result, builtInKnowledge.payload, p);
    const young = program.filter((item) => item.parameterIds.includes("young-modulus"));
    expect(young.some((item) => item.method.id === "rock-ucs")).toBe(true);
    expect(young.some((item) => item.method.id === "triaxial-ciu")).toBe(false);
  });

  it("kum ve kaya için E talebini bir satırda, uygun iki deney hedefinde tutar", () => {
    const p = project(["linear-static"], [unitA, rockUnit]);
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    const youngRequirements = result.filter((item) => item.parameter.id === "young-modulus");
    expect(youngRequirements).toHaveLength(1);
    expect(youngRequirements[0].groundUnitIds).toEqual(["GU-A", "GU-R"]);
    const methods = consolidateTests(result, builtInKnowledge.payload, p)
      .filter((item) => item.parameterIds.includes("young-modulus"))
      .map((item) => item.method.id);
    expect(methods).toEqual(expect.arrayContaining(["triaxial-ciu", "rock-ucs"]));
  });

  it("farklı çevrimsel riskteki birimlerin durum ve birim eşlemesini karıştırmaz", () => {
    const yesUnit: GroundUnit = { ...unitA, id: "GU-YES", cyclicRisk: "yes" };
    const noUnit: GroundUnit = { ...unitB, id: "GU-NO", cyclicRisk: "no" };
    const unknownUnit: GroundUnit = { ...unitB, id: "GU-UNKNOWN", cyclicRisk: "unknown" };
    const p = project(["nonlinear-time-history"], [yesUnit, noUnit, unknownUnit]);
    p.conditions.dynamicLoading = true;
    const variants = consolidateRequirements(p, builtInKnowledge.payload).filter((item) => item.parameter.id === "liquefaction-resistance");
    expect(variants).toHaveLength(3);
    expect(variants.find((item) => item.level === "required")?.groundUnitIds).toEqual(["GU-YES"]);
    expect(variants.find((item) => item.level === "conditional")?.groundUnitIds).toEqual(["GU-NO"]);
    expect(variants.find((item) => item.level === "missing-decision")?.groundUnitIds).toEqual(["GU-UNKNOWN"]);
  });

  it("ertelenen model kararını tekrarsız karar veri paketi talebine dönüştürür", () => {
    const p = project(["linear-static", "nonlinear-static"], [unitA]);
    p.deferredModelContexts = ["linear-static:GU-A", "nonlinear-static:GU-A"];
    const deferred = consolidateRequirements(p, builtInKnowledge.payload).filter((item) => item.parameter.id === "model-decision-basis");
    expect(deferred).toHaveLength(1);
    expect(deferred[0].level).toBe("missing-decision");
    expect(deferred[0].analysisIds).toEqual(["linear-static", "nonlinear-static"]);
    expect(deferred[0].groundUnitIds).toEqual(["GU-A"]);
  });

  it("kaya dinamik rijitliğini SCPTu yerine kaya için uygun jeofizik yönteme bağlar", () => {
    const p = project(["linear-time-history-modal"], [rockUnit]);
    p.conditions.dynamicLoading = true;
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    const methods = consolidateTests(result, builtInKnowledge.payload, p)
      .filter((item) => item.parameterIds.includes("gmax") || item.parameterIds.includes("vs"))
      .map((item) => item.method.id);
    expect(methods).toContain("geophysics");
    expect(methods).not.toContain("scptu");
  });

  it("kaya c′ ve φ′ taleplerini zemin CIU yerine kaya üç eksenli yönteme bağlar", () => {
    const p = project(["nonlinear-static"], [rockUnit]);
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    const methods = consolidateTests(result, builtInKnowledge.payload, p)
      .filter((item) => item.parameterIds.includes("cohesion-effective") || item.parameterIds.includes("friction-angle-effective"))
      .map((item) => item.method.id);
    expect(methods).toContain("rock-triaxial");
    expect(methods).not.toContain("triaxial-ciu");
  });

  it("bilinmeyen malzeme türünde deney uydurmaz ve gereksinimleri karar eksik tutar", () => {
    const unknownUnit: GroundUnit = { ...unitA, id: "GU-UNK", soilType: "unknown" };
    const p = project(["linear-static"], [unknownUnit]);
    const result = consolidateRequirements(p, builtInKnowledge.payload);
    expect(result.filter((item) => item.groundUnitIds.includes("GU-UNK")).every((item) => item.level === "missing-decision")).toBe(true);
    expect(consolidateTests(result, builtInKnowledge.payload, p).some((item) => item.groundUnitIds.includes("GU-UNK"))).toBe(false);
  });
});
