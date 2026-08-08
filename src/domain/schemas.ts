import { z } from "zod";

const SafeId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/, "Kimlik yalnız ASCII harf, sayı ve ._:- içerebilir.");
const UniqueIds = <T extends z.ZodTypeAny>(array: z.ZodArray<T>) => array.superRefine((items: unknown[], ctx) => {
  const ids = items.map((item) => (item as { id?: string }).id).filter(Boolean);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Yinelenen kimlik bulundu." });
});

const GroundUnitSchema = z.object({
  id: SafeId,
  name: z.string().min(1).max(160),
  soilType: z.enum(["unknown", "fill", "gravel", "sand", "silt", "clay", "organic", "residual", "weak-rock", "rock-mass", "jointed-rock"]),
  description: z.string().max(4000),
  topElevation: z.number().finite().optional(),
  bottomElevation: z.number().finite().optional(),
  saturation: z.enum(["unknown", "unsaturated", "saturated", "variable"]),
  consolidationState: z.enum(["unknown", "normally-consolidated", "over-consolidated"]),
  cyclicRisk: z.enum(["unknown", "no", "yes"]),
}).strict().refine((unit) => unit.topElevation === undefined || unit.bottomElevation === undefined || unit.topElevation >= unit.bottomElevation, "Üst kot alt kottan küçük olamaz.");

export const GaiaProjectSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: SafeId,
  name: z.string().min(1).max(240),
  location: z.string().max(500),
  client: z.string().max(500),
  description: z.string().max(10000),
  coordinateSystem: z.string().max(500),
  verticalDatum: z.string().max(500),
  selectedAnalysisIds: z.array(SafeId).max(100).refine((items) => new Set(items).size === items.length, "Analiz kimlikleri yinelenemez."),
  groundUnits: UniqueIds(z.array(GroundUnitSchema).min(1).max(250)),
  conditions: z.object({
    groundwater: z.enum(["unknown", "not-relevant", "static", "time-varying"]),
    drainageDecision: z.enum(["unknown", "drained", "undrained", "both"]),
    constructionStages: z.boolean(),
    dynamicLoading: z.boolean(),
    interfacePresent: z.boolean(),
    pilePresent: z.boolean(),
  }).strict(),
  confirmedModelIds: z.record(z.string().max(240), z.array(SafeId).max(5)),
  deferredModelContexts: z.array(z.string().min(3).max(240)).max(10000).refine((items) => new Set(items).size === items.length, "Ertelenen model bağlamları yinelenemez."),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  knowledgeVersion: z.string().min(1).max(100),
  knowledgePackageId: SafeId,
  knowledgeDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const SourceSchema = z.object({
  id: SafeId,
  title: z.string().min(1).max(500),
  kind: z.enum(["gts-manual", "analysis-reference", "tutorial", "standard", "guidance"]),
  locator: z.string().min(1).max(2000),
  url: z.string().url().max(2000).optional(),
  verifiedAt: z.string().date(),
}).strict();

const TestSchema = z.object({
  id: SafeId,
  nameTr: z.string().min(1).max(300),
  nameEn: z.string().min(1).max(300),
  standardPrimary: z.string().min(1).max(500),
  standardAlternative: z.string().max(500).optional(),
  specimen: z.string().min(1).max(1000),
  rawDeliverables: z.array(z.string().min(1).max(2000)).min(1).max(100),
  limitations: z.array(z.string().min(1).max(2000)).max(100),
  sourceIds: z.array(SafeId).min(1).max(50),
}).strict();

const ParameterSchema = z.object({
  id: SafeId,
  group: z.string().min(1).max(200),
  nameTr: z.string().min(1).max(300),
  officialName: z.string().min(1).max(300),
  symbol: z.string().max(100),
  unit: z.string().max(100),
  scope: z.enum(["project", "ground-unit", "interface", "pile", "structure"]),
  meaning: z.string().min(1).max(5000),
  why: z.string().min(1).max(5000),
  gtsPath: z.string().min(1).max(1000),
  preferredTestIds: z.array(SafeId).max(50),
  alternativeMethod: z.string().max(5000),
  rawRequest: z.string().min(1).max(5000),
  limitations: z.array(z.string().min(1).max(2000)).max(100),
  sourceIds: z.array(SafeId).min(1).max(50),
}).strict();

const RequirementSchema = z.object({
  parameterId: SafeId,
  level: z.enum(["required", "conditional", "recommended", "missing-decision"]),
  drainage: z.enum(["any", "drained", "undrained-effective", "undrained-total"]).optional(),
  strengthState: z.enum(["any", "peak", "critical", "residual", "post-cyclic"]).optional(),
  stressPath: z.string().max(500).optional(),
  direction: z.enum(["any", "x", "y", "z", "horizontal", "vertical"]).optional(),
  strainRange: z.string().max(500).optional(),
  specimenCondition: z.string().max(1000).optional(),
  note: z.string().max(2000).optional(),
  stiffnessBasis: z.enum(["any", "effective", "undrained"]).optional(),
  strengthBasis: z.enum(["any", "effective", "undrained"]).optional(),
}).strict();

const AnalysisSchema = z.object({
  id: SafeId,
  group: z.string().min(1).max(200),
  nameTr: z.string().min(1).max(300),
  officialName: z.string().min(1).max(300),
  summary: z.string().min(1).max(3000),
  example: z.string().min(1).max(2000),
  requirements: z.array(RequirementSchema).max(500),
  sourceIds: z.array(SafeId).min(1).max(50),
}).strict();

const ModelSchema = z.object({
  id: SafeId,
  family: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  nameTr: z.string().min(1).max(300),
  behaviour: z.string().min(1).max(5000),
  suitableSoils: z.array(z.enum(["unknown", "fill", "gravel", "sand", "silt", "clay", "organic", "residual", "weak-rock", "rock-mass", "jointed-rock"])).min(1),
  analysisIds: z.array(SafeId).max(200),
  parameterIds: z.array(SafeId).max(500),
  expertOnly: z.boolean().optional(),
  catalogueStatus: z.enum(["verified-core", "partial", "blocked"]),
  verifiedParameterIds: z.array(SafeId).max(500),
  unverifiedFields: z.array(z.string().min(1).max(1000)).max(500),
  warning: z.string().max(3000).optional(),
  sourceIds: z.array(SafeId).min(1).max(50),
}).strict();

const ManifestSchema = z.object({
  packageId: SafeId,
  version: z.string().min(1).max(100),
  schemaVersion: z.literal("1.0"),
  createdAt: z.string().datetime(),
  gtsManualSnapshot: z.string().min(1).max(1000),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.string().max(512),
  signatureAlgorithm: z.literal("Ed25519"),
  reviewerKeyId: SafeId.or(z.literal("")),
  compatibleApp: z.object({ min: z.string().min(1).max(50), max: z.string().min(1).max(50) }).strict(),
  compatibleGts: z.object({ min: z.string().min(1).max(50), max: z.string().min(1).max(50) }).strict(),
  expertReview: z.object({
    status: z.enum(["review-required", "approved"]),
    reviewer: z.string().max(300),
    discipline: z.string().max(500),
    reviewedAt: z.string().datetime().optional(),
    scope: z.string().max(2000).optional(),
  }).strict(),
}).strict().superRefine((manifest, ctx) => {
  if (manifest.expertReview.status === "approved") {
    if (!manifest.expertReview.reviewer.trim() || !manifest.expertReview.discipline.trim() || !manifest.expertReview.reviewedAt || !manifest.expertReview.scope?.trim() || !manifest.reviewerKeyId || !manifest.signature) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Onaylı paket; uzman, uzmanlık, tarih, kapsam, anahtar ve gerçek imza içermelidir." });
    }
  }
});

export const KnowledgePackageSchema = z.object({
  manifest: ManifestSchema,
  payload: z.object({
    sources: UniqueIds(z.array(SourceSchema).max(2000)),
    tests: UniqueIds(z.array(TestSchema).max(2000)),
    parameters: UniqueIds(z.array(ParameterSchema).max(10000)),
    analyses: UniqueIds(z.array(AnalysisSchema).max(2000)),
    models: UniqueIds(z.array(ModelSchema).max(5000)),
  }).strict(),
}).strict();

export function assertKnowledgeReferences(value: z.infer<typeof KnowledgePackageSchema>): void {
  const sourceIds = new Set(value.payload.sources.map((item) => item.id));
  const testIds = new Set(value.payload.tests.map((item) => item.id));
  const parameterIds = new Set(value.payload.parameters.map((item) => item.id));
  const analysisIds = new Set(value.payload.analyses.map((item) => item.id));
  const failures: string[] = [];
  const check = (ids: string[], known: Set<string>, owner: string) => ids.forEach((id) => { if (!known.has(id)) failures.push(`${owner} → bilinmeyen kimlik: ${id}`); });
  value.payload.tests.forEach((item) => check(item.sourceIds, sourceIds, `test:${item.id}`));
  value.payload.parameters.forEach((item) => { check(item.sourceIds, sourceIds, `parameter:${item.id}`); check(item.preferredTestIds, testIds, `parameter:${item.id}`); });
  value.payload.analyses.forEach((item) => { check(item.sourceIds, sourceIds, `analysis:${item.id}`); check(item.requirements.map((req) => req.parameterId), parameterIds, `analysis:${item.id}`); });
  value.payload.models.forEach((item) => { check(item.sourceIds, sourceIds, `model:${item.id}`); check(item.parameterIds, parameterIds, `model:${item.id}`); check(item.analysisIds, analysisIds, `model:${item.id}`); });
  if (failures.length) throw new Error(`Bilgi paketi referans bütünlüğü başarısız:\n${failures.slice(0, 30).join("\n")}`);
}
