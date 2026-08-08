export type RequirementLevel = "required" | "conditional" | "recommended" | "missing-decision";
export type Drainage = "any" | "drained" | "undrained-effective" | "undrained-total";
export type StiffnessBasis = "any" | "effective" | "undrained";
export type StrengthBasis = "any" | "effective" | "undrained";
export type StrengthState = "any" | "peak" | "critical" | "residual" | "post-cyclic";
export type Direction = "any" | "x" | "y" | "z" | "horizontal" | "vertical";
export type Scope = "project" | "ground-unit" | "interface" | "pile" | "structure";
export type SoilType =
  | "unknown"
  | "fill"
  | "gravel"
  | "sand"
  | "silt"
  | "clay"
  | "organic"
  | "residual"
  | "weak-rock"
  | "rock-mass"
  | "jointed-rock";

export interface SourceRef {
  id: string;
  title: string;
  kind: "gts-manual" | "analysis-reference" | "tutorial" | "standard" | "guidance";
  locator: string;
  url?: string;
  verifiedAt: string;
}

export interface TestMethod {
  id: string;
  nameTr: string;
  nameEn: string;
  standardPrimary: string;
  standardAlternative?: string;
  specimen: string;
  rawDeliverables: string[];
  limitations: string[];
  sourceIds: string[];
}

export interface ParameterDefinition {
  id: string;
  group: string;
  nameTr: string;
  officialName: string;
  symbol: string;
  unit: string;
  scope: Scope;
  meaning: string;
  why: string;
  gtsPath: string;
  preferredTestIds: string[];
  alternativeMethod: string;
  rawRequest: string;
  limitations: string[];
  sourceIds: string[];
}

export interface RequirementTemplate {
  parameterId: string;
  level: RequirementLevel;
  drainage?: Drainage;
  strengthState?: StrengthState;
  stressPath?: string;
  direction?: Direction;
  strainRange?: string;
  specimenCondition?: string;
  note?: string;
  stiffnessBasis?: StiffnessBasis;
  strengthBasis?: StrengthBasis;
}

export interface AnalysisDefinition {
  id: string;
  group: string;
  nameTr: string;
  officialName: string;
  summary: string;
  example: string;
  requirements: RequirementTemplate[];
  sourceIds: string[];
}

export interface ModelDefinition {
  id: string;
  family: string;
  name: string;
  nameTr: string;
  behaviour: string;
  suitableSoils: SoilType[];
  analysisIds: string[];
  parameterIds: string[];
  expertOnly?: boolean;
  catalogueStatus: "verified-core" | "partial" | "blocked";
  verifiedParameterIds: string[];
  unverifiedFields: string[];
  warning?: string;
  sourceIds: string[];
}

export interface GroundUnit {
  id: string;
  name: string;
  soilType: SoilType;
  description: string;
  topElevation?: number;
  bottomElevation?: number;
  saturation: "unknown" | "unsaturated" | "saturated" | "variable";
  consolidationState: "unknown" | "normally-consolidated" | "over-consolidated";
  cyclicRisk: "unknown" | "no" | "yes";
}

export interface ProjectConditions {
  groundwater: "unknown" | "not-relevant" | "static" | "time-varying";
  drainageDecision: "unknown" | "drained" | "undrained" | "both";
  constructionStages: boolean;
  dynamicLoading: boolean;
  interfacePresent: boolean;
  pilePresent: boolean;
}

export interface GaiaProject {
  schemaVersion: "1.0";
  id: string;
  name: string;
  location: string;
  client: string;
  description: string;
  coordinateSystem: string;
  verticalDatum: string;
  selectedAnalysisIds: string[];
  groundUnits: GroundUnit[];
  conditions: ProjectConditions;
  confirmedModelIds: Record<string, string[]>;
  deferredModelContexts: string[];
  createdAt: string;
  updatedAt: string;
  knowledgeVersion: string;
  knowledgePackageId: string;
  knowledgeDigest: string;
}

export interface RequirementContext {
  project: GaiaProject;
  analysis: AnalysisDefinition;
  groundUnit?: GroundUnit;
}

export interface RequirementContribution {
  canonicalKey: string;
  parameter: ParameterDefinition;
  level: RequirementLevel;
  groundUnitIds: string[];
  analysisIds: string[];
  modelIds: string[];
  drainage: Drainage;
  strengthState: StrengthState;
  stressPath: string;
  direction: Direction;
  strainRange: string;
  specimenCondition: string;
  stiffnessBasis: StiffnessBasis;
  strengthBasis: StrengthBasis;
  notes: string[];
}

export interface ConsolidatedRequirement extends RequirementContribution {
  id: string;
}

export interface ConsolidatedTestRequest {
  id: string;
  method: TestMethod;
  parameterIds: string[];
  requirementIds: string[];
  analysisIds: string[];
  groundUnitIds: string[];
}

export interface ModelRecommendation {
  unitId: string;
  analysisId: string;
  model: ModelDefinition;
  status: "recommended" | "possible" | "expert-only";
  score: number;
  reasons: string[];
  missingParameterIds: string[];
}

export interface CanonicalResult {
  generatedAt: string;
  appVersion: string;
  knowledgeVersion: string;
  knowledgeDigest: string;
  knowledgePackageId: string;
  engineeringUseAllowed: boolean;
  analysisLabels: Record<string, { nameTr: string; officialName: string }>;
  project: GaiaProject;
  requirements: ConsolidatedRequirement[];
  tests: ConsolidatedTestRequest[];
  recommendations: ModelRecommendation[];
  warnings: string[];
  sources: SourceRef[];
}

export interface KnowledgeManifest {
  packageId: string;
  version: string;
  schemaVersion: "1.0";
  createdAt: string;
  gtsManualSnapshot: string;
  payloadSha256: string;
  signature: string;
  signatureAlgorithm: "Ed25519";
  reviewerKeyId: string;
  compatibleApp: { min: string; max: string };
  compatibleGts: { min: string; max: string };
  expertReview: {
    status: "review-required" | "approved";
    reviewer: string;
    discipline: string;
    reviewedAt?: string;
    scope?: string;
  };
}

export interface KnowledgePayload {
  sources: SourceRef[];
  tests: TestMethod[];
  parameters: ParameterDefinition[];
  analyses: AnalysisDefinition[];
  models: ModelDefinition[];
}

export interface KnowledgePackage {
  manifest: KnowledgeManifest;
  payload: KnowledgePayload;
}

export interface GaiaDesktopApi {
  saveProject(project: GaiaProject): Promise<{ canceled: boolean; path?: string; error?: string }>;
  openProject(): Promise<{ canceled: boolean; project?: GaiaProject; path?: string; error?: string }>;
  exportBundle(result: CanonicalResult): Promise<{ canceled: boolean; directory?: string; files?: string[]; error?: string }>;
  importKnowledge(): Promise<{ canceled: boolean; manifest?: KnowledgeManifest; error?: string }>;
  getKnowledge(): Promise<KnowledgePackage | null>;
  getInstalledGtsVersion(): Promise<string | null>;
}

declare global {
  interface Window {
    gaia?: GaiaDesktopApi;
  }
}
