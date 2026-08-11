import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { builtInKnowledge } from "../src/data/catalogue.js";
import type { GaiaProject } from "../src/domain/types.js";
import { buildCanonicalResult } from "../src/engine/result.js";
import { exportBundle } from "./exporters.js";

const now = "2026-08-08T00:00:00.000Z";
const project: GaiaProject = {
  schemaVersion: "1.0",
  id: "GAIA-VERIFY-001",
  name: "GAIA Doğrulama Projesi",
  location: "İstanbul",
  client: "GAIA QA",
  description: "Dört analiz, iki jeoteknik birim ve kilitli model karar yoluyla kanonik çıktı parite doğrulaması.",
  coordinateSystem: "ITRF96 / TM30",
  verticalDatum: "TUDKA",
  selectedAnalysisIds: ["nonlinear-static", "construction-stage", "strength-reduction", "consolidation"],
  groundUnits: [
    { id: "GU-SAND", name: "Kum Birimi", soilType: "sand", description: "Orta sıkı kum", saturation: "saturated", consolidationState: "unknown", cyclicRisk: "no" },
    { id: "GU-CLAY", name: "Kil Birimi", soilType: "clay", description: "Katı kil", saturation: "saturated", consolidationState: "over-consolidated", cyclicRisk: "no" },
  ],
  conditions: { groundwater: "static", drainageDecision: "both", constructionStages: true, dynamicLoading: false, interfacePresent: false, pilePresent: false },
  confirmedModelIds: Object.fromEntries(["nonlinear-static", "construction-stage", "strength-reduction"].flatMap((analysis) => ["GU-SAND", "GU-CLAY"].map((unit) => [`${analysis}:${unit}`, ["mohr-coulomb"]]))),
  deferredModelContexts: ["consolidation:GU-SAND", "consolidation:GU-CLAY"],
  createdAt: now,
  updatedAt: now,
  knowledgeVersion: builtInKnowledge.manifest.version,
  knowledgePackageId: builtInKnowledge.manifest.packageId,
  knowledgeDigest: builtInKnowledge.manifest.payloadSha256,
};

export async function runSampleExport(destinationInput: string): Promise<void> {
  const destination = resolve(destinationInput);
  mkdirSync(destination, { recursive: true });
  const result = buildCanonicalResult(project, builtInKnowledge);
  const exported = await exportBundle(result, destination);
  process.stdout.write(`${JSON.stringify(exported)}\n`);
}
