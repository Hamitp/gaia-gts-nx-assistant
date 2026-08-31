import { describe, expect, it } from "vitest";
import { builtInKnowledge } from "../data/catalogue";
import type { GaiaProject, GroundUnit } from "./types";
import { validateProjectReferences } from "./validate";

const unit = (soilType: GroundUnit["soilType"] = "sand"): GroundUnit => ({ id: "GU-1", name: "Birim", soilType, description: "", saturation: "saturated", consolidationState: "normally-consolidated", cyclicRisk: "no" });
const project = (groundUnit = unit()): GaiaProject => ({
  schemaVersion: "1.0", id: "P-1", name: "Test", location: "", client: "", description: "", coordinateSystem: "ITRF", verticalDatum: "TUDKA",
  selectedAnalysisIds: ["linear-static"], groundUnits: [groundUnit], conditions: { groundwater: "static", drainageDecision: "drained", constructionStages: false, dynamicLoading: false, interfacePresent: false, pilePresent: false },
  confirmedModelIds: { "linear-static:GU-1": ["elastic"] }, deferredModelContexts: [], createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
  knowledgeVersion: builtInKnowledge.manifest.version, knowledgePackageId: builtInKnowledge.manifest.packageId, knowledgeDigest: builtInKnowledge.manifest.payloadSha256,
});

describe("proje–bilgi paketi bağ doğrulaması", () => {
  it("aynı bağlamda çoklu modeli reddeder", () => {
    const p = project();
    p.confirmedModelIds["linear-static:GU-1"] = ["elastic", "mohr-coulomb"];
    expect(() => validateProjectReferences(p, builtInKnowledge)).toThrow(/tam olarak bir/i);
  });

  it("aynı bağlamın hem seçilmiş hem ertelenmiş olmasını reddeder", () => {
    const p = project();
    p.deferredModelContexts = ["linear-static:GU-1"];
    expect(() => validateProjectReferences(p, builtInKnowledge)).toThrow(/hem seçilmiş hem ertelenmiş/i);
  });

  it("bilinmeyen birimde model seçimini reddeder", () => {
    expect(() => validateProjectReferences(project(unit("unknown")), builtInKnowledge)).toThrow(/türü bilinmeden/i);
  });

  it("kısmi doğrulanmış modeli hazırlanmış proje dosyasından dahi reddeder", () => {
    const p = project(unit("clay"));
    p.confirmedModelIds["linear-static:GU-1"] = ["tresca"];
    expect(() => validateProjectReferences(p, builtInKnowledge)).toThrow(/seçime açık değildir/i);
  });

  it("bloke modeli hazırlanmış proje dosyasından dahi reddeder", () => {
    const p = project();
    p.confirmedModelIds["linear-static:GU-1"] = ["drucker-prager"];
    expect(() => validateProjectReferences(p, builtInKnowledge)).toThrow(/seçime açık değildir/i);
  });
});
