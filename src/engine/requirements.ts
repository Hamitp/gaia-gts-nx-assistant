import type {
  AnalysisDefinition,
  ConsolidatedRequirement,
  ConsolidatedTestRequest,
  GaiaProject,
  KnowledgePayload,
  RequirementContribution,
  RequirementLevel,
  RequirementTemplate,
} from "../domain/types.js";

const levelPriority: Record<RequirementLevel, number> = {
  recommended: 1,
  conditional: 2,
  required: 3,
  "missing-decision": 4,
};

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const normalized = (value: string | undefined, fallback = "any"): string =>
  (value?.trim().toLocaleLowerCase("tr-TR") || fallback).replace(/\s+/g, " ");

/**
 * Ground-unit id is deliberately not part of this key. When the complete
 * engineering context is identical, one request sentence is created and all
 * applicable units are listed below it. Every qualifier capable of changing
 * the engineering meaning remains in the key.
 */
export function canonicalRequirementKey(template: RequirementTemplate): string {
  return [
    template.parameterId,
    normalized(template.drainage),
    normalized(template.strengthState),
    normalized(template.stressPath),
    normalized(template.direction),
    normalized(template.strainRange),
    normalized(template.specimenCondition),
    normalized(template.stiffnessBasis),
    normalized(template.strengthBasis),
  ].join("|");
}

function mergeContribution(
  map: Map<string, RequirementContribution>,
  incoming: RequirementContribution,
): void {
  const existing = map.get(incoming.canonicalKey);
  if (!existing) {
    map.set(incoming.canonicalKey, incoming);
    return;
  }

  existing.groundUnitIds = unique([...existing.groundUnitIds, ...incoming.groundUnitIds]);
  existing.analysisIds = unique([...existing.analysisIds, ...incoming.analysisIds]);
  existing.modelIds = unique([...existing.modelIds, ...incoming.modelIds]);
  existing.notes = unique([...existing.notes, ...incoming.notes]);
  if (levelPriority[incoming.level] > levelPriority[existing.level]) existing.level = incoming.level;
}

const semanticQualifierKeys = [
  "drainage",
  "strengthState",
  "stressPath",
  "direction",
  "strainRange",
  "specimenCondition",
  "stiffnessBasis",
  "strengthBasis",
] as const;

function sameUnitSet(left: RequirementContribution, right: RequirementContribution): boolean {
  if (left.groundUnitIds.length !== right.groundUnitIds.length) return false;
  const rightIds = new Set(right.groundUnitIds);
  return left.groundUnitIds.every((id) => rightIds.has(id));
}

function isStrictlyMoreSpecific(candidate: RequirementContribution, broad: RequirementContribution): boolean {
  let addsMeaning = false;
  for (const key of semanticQualifierKeys) {
    const broadValue = normalized(broad[key]);
    const candidateValue = normalized(candidate[key]);
    if (broadValue === "any") {
      if (candidateValue !== "any") addsMeaning = true;
      continue;
    }
    if (candidateValue !== broadValue) return false;
  }
  return addsMeaning;
}

/**
 * A model can ask for a parameter without adding an engineering qualifier
 * while one selected analysis already asks for the same parameter in one
 * explicit context. In that unambiguous case the broad contribution is not a
 * second value request: its provenance is attached to the specific row.
 *
 * If two distinct contexts exist (for example peak and residual), the broad
 * request is deliberately retained rather than being assigned to the wrong
 * engineering meaning.
 */
function collapseUniquelySubsumedRequirements(map: Map<string, RequirementContribution>): void {
  let changed = true;
  while (changed) {
    changed = false;
    const contributions = [...map.values()];
    for (const broad of contributions) {
      if (!map.has(broad.canonicalKey)) continue;
      const candidates = contributions.filter((candidate) =>
        candidate.canonicalKey !== broad.canonicalKey
        && map.has(candidate.canonicalKey)
        && candidate.parameter.id === broad.parameter.id
        && sameUnitSet(candidate, broad)
        && isStrictlyMoreSpecific(candidate, broad));
      if (candidates.length !== 1) continue;

      const target = candidates[0];
      target.analysisIds = unique([...target.analysisIds, ...broad.analysisIds]);
      target.modelIds = unique([...target.modelIds, ...broad.modelIds]);
      target.notes = unique([...target.notes, ...broad.notes]);
      if (levelPriority[broad.level] > levelPriority[target.level]) target.level = broad.level;
      map.delete(broad.canonicalKey);
      changed = true;
      break;
    }
  }
}

function addTemplate(
  map: Map<string, RequirementContribution>,
  payload: KnowledgePayload,
  project: GaiaProject,
  analysis: AnalysisDefinition,
  template: RequirementTemplate,
  groundUnitId?: string,
  modelId?: string,
): void {
  const parameter = payload.parameters.find((item) => item.id === template.parameterId);
  if (!parameter) throw new Error(`Bilgi paketi bozuk: ${analysis.id} bilinmeyen ${template.parameterId} parametresine başvuruyor.`);
  const groundUnit = groundUnitId ? project.groundUnits.find((item) => item.id === groundUnitId) : undefined;
  if (groundUnit && !parameterAppliesToUnit(parameter.id, parameter.group, groundUnit.soilType)) return;
  const effectiveTemplate = contextualizeTemplate(template, project, groundUnit);

  const canonicalKey = canonicalRequirementKey(effectiveTemplate);
  mergeContribution(map, {
    canonicalKey,
    parameter,
    level: effectiveTemplate.level,
    groundUnitIds: groundUnitId ? [groundUnitId] : [],
    analysisIds: [analysis.id],
    modelIds: modelId ? [modelId] : [],
    drainage: effectiveTemplate.drainage ?? "any",
    strengthState: effectiveTemplate.strengthState ?? "any",
    stressPath: effectiveTemplate.stressPath ?? "any",
    direction: effectiveTemplate.direction ?? "any",
    strainRange: effectiveTemplate.strainRange ?? "any",
    specimenCondition: effectiveTemplate.specimenCondition ?? "any",
    stiffnessBasis: effectiveTemplate.stiffnessBasis ?? "any",
    strengthBasis: effectiveTemplate.strengthBasis ?? "any",
    notes: effectiveTemplate.note ? [effectiveTemplate.note] : [],
  });
}

function parameterAppliesToUnit(parameterId: string, group: string, soilType: GaiaProject["groundUnits"][number]["soilType"]): boolean {
  const rockTypes = new Set(["weak-rock", "rock-mass", "jointed-rock"]);
  const isRock = rockTypes.has(soilType);
  if (isRock && [
    "compression-index", "swelling-index", "preconsolidation", "ocr", "cv", "creep-index",
    "mcc-lambda", "mcc-kappa", "critical-state-m", "liquefaction-resistance", "relative-density",
  ].includes(parameterId)) return false;
  if (!isRock && (group === "Kaya" || group === "Anizotropi")) return false;
  return true;
}

function contextualizeTemplate(
  template: RequirementTemplate,
  project: GaiaProject,
  groundUnit?: GaiaProject["groundUnits"][number],
): RequirementTemplate {
  let level = template.level;
  let specimenCondition = template.specimenCondition;
  const drainage = template.drainage ?? "any";
  const decision = project.conditions.drainageDecision;

  if (drainage !== "any") {
    if (decision === "unknown") level = "missing-decision";
    if (decision === "drained" && drainage.startsWith("undrained")) level = "conditional";
    if (decision === "undrained" && drainage === "drained") level = "conditional";
    if (decision === "undrained" && drainage.startsWith("undrained")) level = "required";
  }

  if (template.parameterId === "groundwater") {
    level = project.conditions.groundwater === "unknown" ? "missing-decision" : "required";
  }

  if (groundUnit) {
    if (template.parameterId === "unit-weight-sat") {
      level = groundUnit.saturation === "unknown"
        ? "missing-decision"
        : groundUnit.saturation === "saturated" || groundUnit.saturation === "variable"
          ? "required"
          : "conditional";
      specimenCondition = appendCondition(specimenCondition, `doygunluk durumu: ${groundUnit.saturation}`);
    }
    if (template.parameterId === "swcc-curve") {
      level = groundUnit.saturation === "unknown"
        ? "missing-decision"
        : groundUnit.saturation === "unsaturated" || groundUnit.saturation === "variable"
          ? "required"
          : "conditional";
      specimenCondition = appendCondition(specimenCondition, `doygunluk durumu: ${groundUnit.saturation}`);
    }
    if (template.parameterId === "liquefaction-resistance") {
      level = groundUnit.cyclicRisk === "unknown"
        ? "missing-decision"
        : groundUnit.cyclicRisk === "yes"
          ? "required"
          : "conditional";
      specimenCondition = appendCondition(specimenCondition, `çevrimsel risk: ${groundUnit.cyclicRisk}`);
    }
    if ((template.parameterId === "preconsolidation" || template.parameterId === "ocr") && groundUnit.consolidationState === "unknown") {
      level = "missing-decision";
    }
    if (template.parameterId === "preconsolidation" || template.parameterId === "ocr") {
      specimenCondition = appendCondition(specimenCondition, `konsolidasyon durumu: ${groundUnit.consolidationState}`);
    }
    if ((template.parameterId === "preconsolidation" || template.parameterId === "ocr" || template.parameterId === "compression-index" || template.parameterId === "swelling-index" || template.parameterId === "cv") && (groundUnit.soilType === "sand" || groundUnit.soilType === "gravel")) {
      level = "conditional";
    }
    if (groundUnit.soilType === "unknown") level = "missing-decision";
  }

  return { ...template, level, specimenCondition };
}

function appendCondition(existing: string | undefined, condition: string): string {
  return existing ? `${existing}; ${condition}` : condition;
}

export function consolidateRequirements(project: GaiaProject, payload: KnowledgePayload): ConsolidatedRequirement[] {
  const map = new Map<string, RequirementContribution>();
  const selectedAnalyses = project.selectedAnalysisIds.map((id) => {
    const found = payload.analyses.find((analysis) => analysis.id === id);
    if (!found) throw new Error(`Bilgi paketi/proje uyumsuz: ${id} analiz kimliği bulunamadı.`);
    return found;
  });

  for (const analysis of selectedAnalyses) {
    for (const template of analysis.requirements) {
      const parameter = payload.parameters.find((item) => item.id === template.parameterId);
      if (!parameter) throw new Error(`Bilgi paketi bozuk: ${template.parameterId} parametresi bulunamadı.`);
      if (parameter.scope === "ground-unit") {
        for (const unit of project.groundUnits) addTemplate(map, payload, project, analysis, template, unit.id);
      } else {
        addTemplate(map, payload, project, analysis, template);
      }
    }

    for (const unit of project.groundUnits) {
      const contextKey = `${analysis.id}:${unit.id}`;
      if (project.deferredModelContexts.includes(contextKey)) {
        addTemplate(map, payload, project, analysis, {
          parameterId: "model-decision-basis",
          level: "missing-decision",
          specimenCondition: "malzeme modeli seçimi kullanıcı tarafından ertelendi",
          note: "Model-özel nihai girdiler, bu karar veri paketi değerlendirilmeden kapatılamaz.",
        }, unit.id);
      }
      const confirmedIds = project.confirmedModelIds[contextKey] ?? [];
      for (const modelId of confirmedIds) {
        const model = payload.models.find((item) => item.id === modelId);
        if (!model) throw new Error(`Bilgi paketi/proje uyumsuz: ${modelId} model kimliği bulunamadı.`);
        for (const parameterId of model.parameterIds) {
          const parameter = payload.parameters.find((item) => item.id === parameterId);
          if (!parameter) throw new Error(`Bilgi paketi bozuk: ${model.id} modelindeki ${parameterId} parametresi bulunamadı.`);
          const matching = [...map.values()].filter((item) => item.parameter.id === parameterId && item.analysisIds.includes(analysis.id) && (item.groundUnitIds.length === 0 || item.groundUnitIds.includes(unit.id)));
          if (matching.length) {
            for (const item of matching) item.modelIds = unique([...item.modelIds, model.id]);
            continue;
          }
          const template: RequirementTemplate = { parameterId, level: "required" };
          addTemplate(
            map,
            payload,
            project,
            analysis,
            template,
            parameter.scope === "ground-unit" ? unit.id : undefined,
            model.id,
          );
        }
      }
    }
  }

  collapseUniquelySubsumedRequirements(map);

  return [...map.values()]
    .sort((a, b) => {
      const priority = levelPriority[b.level] - levelPriority[a.level];
      if (priority) return priority;
      const group = a.parameter.group.localeCompare(b.parameter.group, "tr");
      return group || a.parameter.nameTr.localeCompare(b.parameter.nameTr, "tr");
    })
    .map((item) => ({ ...item, id: `REQ-${stableId(item.canonicalKey)}` }));
}

function stableId(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

function specimenClass(requirement: ConsolidatedRequirement): string {
  if (requirement.parameter.scope === "interface") return "interface-specimen";
  if (requirement.parameter.scope === "pile") return "pile-system";
  if (requirement.parameter.scope === "structure") return "structural-product";
  return "ground-material";
}

export function consolidateTests(
  requirements: ConsolidatedRequirement[],
  payload: KnowledgePayload,
  project?: GaiaProject,
): ConsolidatedTestRequest[] {
  const map = new Map<string, ConsolidatedTestRequest>();

  for (const requirement of requirements) {
    const unitGroups = groupUnits(requirement, project);
    for (const unitGroup of unitGroups) {
      const selectedMethodIds = selectTestMethods(requirement, unitGroup.materialClass);
      for (const testId of selectedMethodIds) {
      const method = payload.tests.find((item) => item.id === testId);
      if (!method) throw new Error(`Bilgi paketi bozuk: ${requirement.parameter.id} için ${testId} deney kimliği bulunamadı.`);
      const condition = testSpecimenCondition(requirement.specimenCondition);
      // One physical protocol is requested once. Engineering qualifiers remain
      // traceable on each linked requirement/applicability item instead of
      // duplicating the laboratory or field work-order row.
      const key = [testId, specimenClass(requirement), condition].join("|");
      const existing = map.get(key);
      if (existing) {
        existing.parameterIds = unique([...existing.parameterIds, requirement.parameter.id]);
        existing.requirementIds = unique([...existing.requirementIds, requirement.id]);
        existing.analysisIds = unique([...existing.analysisIds, ...requirement.analysisIds]);
        existing.groundUnitIds = unique([...existing.groundUnitIds, ...unitGroup.unitIds]);
        const use = existing.applicability.find((item) => item.requirementId === requirement.id && item.level === requirement.level);
        if (use) {
          use.analysisIds = unique([...use.analysisIds, ...requirement.analysisIds]);
          use.groundUnitIds = unique([...use.groundUnitIds, ...unitGroup.unitIds]);
        } else {
          existing.applicability.push({ requirementId: requirement.id, level: requirement.level, analysisIds: [...requirement.analysisIds], groundUnitIds: [...unitGroup.unitIds] });
        }
      } else {
        map.set(key, {
          id: `TST-${stableId(key)}`,
          method,
          parameterIds: [requirement.parameter.id],
          requirementIds: [requirement.id],
          analysisIds: [...requirement.analysisIds],
          groundUnitIds: [...unitGroup.unitIds],
          applicability: [{ requirementId: requirement.id, level: requirement.level, analysisIds: [...requirement.analysisIds], groundUnitIds: [...unitGroup.unitIds] }],
        });
      }
      }
    }
  }

  return [...map.values()].sort((a, b) => a.method.nameTr.localeCompare(b.method.nameTr, "tr"));
}

function testSpecimenCondition(value: string): string {
  const projectStatePrefixes = ["doygunluk durumu:", "çevrimsel risk:", "konsolidasyon durumu:"];
  const physicalConditions = value.split(";").map((item) => item.trim()).filter((item) => item && item !== "any" && !projectStatePrefixes.some((prefix) => item.startsWith(prefix)));
  return normalized(physicalConditions.join("; "));
}

function groupUnits(requirement: ConsolidatedRequirement, project?: GaiaProject): { materialClass: "soil" | "rock" | "unknown" | "project"; unitIds: string[] }[] {
  if (!project || !requirement.groundUnitIds.length) return [{ materialClass: "project", unitIds: [...requirement.groundUnitIds] }];
  const rockTypes = new Set(["weak-rock", "rock-mass", "jointed-rock"]);
  const rock = requirement.groundUnitIds.filter((id) => rockTypes.has(project.groundUnits.find((unit) => unit.id === id)?.soilType ?? ""));
  const unknown = requirement.groundUnitIds.filter((id) => project.groundUnits.find((unit) => unit.id === id)?.soilType === "unknown");
  const soil = requirement.groundUnitIds.filter((id) => !rock.includes(id) && !unknown.includes(id));
  return [
    ...(soil.length ? [{ materialClass: "soil" as const, unitIds: soil }] : []),
    ...(rock.length ? [{ materialClass: "rock" as const, unitIds: rock }] : []),
    ...(unknown.length ? [{ materialClass: "unknown" as const, unitIds: unknown }] : []),
  ];
}

const methodProfiles: Record<string, {
  materials: Array<"soil" | "rock" | "project">;
  drainage?: string[];
  strengthStates?: string[];
}> = {
  "survey-borehole": { materials: ["soil", "rock", "project"] },
  spt: { materials: ["soil"] },
  cptu: { materials: ["soil", "project"] },
  scptu: { materials: ["soil"] },
  dmt: { materials: ["soil"] },
  pressuremeter: { materials: ["soil", "rock", "project"] },
  "field-vane": { materials: ["soil"] },
  piezometer: { materials: ["soil", "rock", "project"] },
  geophysics: { materials: ["soil", "rock", "project"] },
  index: { materials: ["soil"] },
  density: { materials: ["soil", "rock"] },
  "particle-density": { materials: ["soil"] },
  "relative-density": { materials: ["soil"] },
  "triaxial-ciu": { materials: ["soil"], drainage: ["undrained-effective"], strengthStates: ["peak", "critical", "post-cyclic"] },
  "triaxial-cd": { materials: ["soil"], drainage: ["drained"], strengthStates: ["peak", "critical"] },
  "triaxial-uu": { materials: ["soil"], drainage: ["undrained-total"], strengthStates: ["peak"] },
  "direct-shear": { materials: ["soil", "project"], drainage: ["drained"], strengthStates: ["peak", "critical", "residual"] },
  "ring-shear": { materials: ["soil"], drainage: ["drained"], strengthStates: ["residual"] },
  dss: { materials: ["soil"], drainage: ["undrained-total"], strengthStates: ["peak", "critical", "post-cyclic"] },
  "cyclic-triaxial": { materials: ["soil"] },
  "resonant-column": { materials: ["soil"] },
  oedometer: { materials: ["soil"] },
  "creep-oedometer": { materials: ["soil"] },
  crs: { materials: ["soil"] },
  permeability: { materials: ["soil"] },
  swcc: { materials: ["soil"] },
  "rock-ucs": { materials: ["rock"] },
  "rock-tensile": { materials: ["rock"] },
  "rock-triaxial": { materials: ["rock"] },
  "joint-shear": { materials: ["rock"] },
  "pile-load": { materials: ["project"] },
  reinforcement: { materials: ["project"] },
};

/** Picks one primary protocol from data-driven method applicability. Other
 * preferred methods remain alternatives; none is silently made mandatory. */
function selectTestMethods(requirement: ConsolidatedRequirement, materialClass: "soil" | "rock" | "unknown" | "project"): string[] {
  const ids = requirement.parameter.preferredTestIds;
  if (!ids.length) return [];
  const candidates = ids.filter((id) => {
    const profile = methodProfiles[id];
    if (!profile || materialClass === "unknown" || !profile.materials.includes(materialClass)) return false;
    if (requirement.drainage !== "any" && profile.drainage && !profile.drainage.includes(requirement.drainage)) return false;
    if (requirement.strengthState !== "any" && profile.strengthStates && !profile.strengthStates.includes(requirement.strengthState)) return false;
    return true;
  });
  if (!candidates.length) return [];
  const usable = candidates;
  const scored = usable.map((id, index) => {
    const profile = methodProfiles[id];
    let score = -index;
    if (materialClass !== "unknown" && profile?.materials.includes(materialClass)) score += 30;
    if (materialClass === "rock" && (id.startsWith("rock-") || id === "joint-shear")) score += 70;
    if (requirement.drainage !== "any" && profile?.drainage?.includes(requirement.drainage)) score += 80;
    if (requirement.strengthState !== "any" && profile?.strengthStates?.includes(requirement.strengthState)) score += 100;
    if (requirement.strengthState !== "any" && profile?.strengthStates && !profile.strengthStates.includes(requirement.strengthState)) score -= 60;
    if (requirement.drainage !== "any" && profile?.drainage && !profile.drainage.includes(requirement.drainage)) score -= 40;
    return { id, score };
  });
  scored.sort((a, b) => b.score - a.score || ids.indexOf(a.id) - ids.indexOf(b.id));
  return [scored[0].id];
}
