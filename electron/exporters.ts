import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow } from "electron";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import type { CanonicalResult, ConsolidatedRequirement } from "../src/domain/types.js";
import { canonicalJson, sha256 } from "./security.js";

const trLevel: Record<string, string> = { required: "Zorunlu", conditional: "Koşullu", recommended: "Önerilen", "missing-decision": "Karar için veri eksik" };
const plainLevel: Record<string, string> = { required: "Mutlaka yapılmalı", conditional: "Koşula bağlı", recommended: "Kaliteyi artırır", "missing-decision": "İşe başlamadan önce karar gerekli" };
const levelRank: Record<string, number> = { required: 4, "missing-decision": 3, conditional: 2, recommended: 1 };
const fieldTestIds = new Set(["survey-borehole", "spt", "cptu", "scptu", "dmt", "pressuremeter", "field-vane", "piezometer", "geophysics", "pile-load"]);
const safeName = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "GAIA-Projesi";
const safeSpreadsheet = (value: unknown): string | number => {
  if (typeof value === "number") return value;
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};
const text = (value: unknown) => String(value ?? "");
const escapeHtml = (value: unknown) => text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

function contextLabel(requirement: ConsolidatedRequirement): string {
  return [requirement.drainage !== "any" ? requirement.drainage : "", requirement.strengthState !== "any" ? requirement.strengthState : "", requirement.direction !== "any" ? requirement.direction : "", requirement.specimenCondition !== "any" ? requirement.specimenCondition : ""].filter(Boolean).join(" · ") || "Genel";
}

function selectedTestText(result: CanonicalResult, requirementId: string): string {
  const selected = result.tests.filter((item) => item.requirementIds.includes(requirementId));
  return selected.length
    ? selected.map((item) => `${requirementId}=>${item.id} · ${item.method.nameTr}`).join("; ")
    : "Yöntem, model/koşul kararı sonrası belirlenecek";
}

function analysisText(result: CanonicalResult, id: string): string {
  const label = result.analysisLabels[id];
  return label ? `${label.nameTr} / ${label.officialName} [${id}]` : id;
}

function unitText(result: CanonicalResult, id: string): string {
  const unit = result.project.groundUnits.find((item) => item.id === id);
  return unit ? `${unit.name} [${id}]` : id;
}

function parameterText(result: CanonicalResult, id: string): string {
  const parameter = result.requirements.find((item) => item.parameter.id === id)?.parameter;
  return parameter ? `${parameter.nameTr} / ${parameter.officialName} [${id}]` : id;
}

function testApplicabilityText(result: CanonicalResult, test: CanonicalResult["tests"][number]): string {
  return test.applicability.map((use) => {
    const units = use.groundUnitIds.map((id) => unitText(result, id)).join(", ") || "Proje geneli";
    return `${trLevel[use.level]}: ${units}`;
  }).join("; ");
}

function plainUnitText(result: CanonicalResult, id: string): string {
  return result.project.groundUnits.find((item) => item.id === id)?.name ?? "Tanımsız birim";
}

function plainParameterText(result: CanonicalResult, id: string): string {
  return result.requirements.find((item) => item.parameter.id === id)?.parameter.nameTr ?? id;
}

function highestTestLevel(test: CanonicalResult["tests"][number]): string {
  return test.applicability.reduce((highest, use) => (levelRank[use.level] ?? 0) > (levelRank[highest] ?? 0) ? use.level : highest, "recommended");
}

interface WorkOrderRow {
  kind: string;
  level: string;
  name: string;
  standard: string;
  units: string;
  outputs: string;
  raw: string;
}

function buildWorkOrderRows(result: CanonicalResult): WorkOrderRow[] {
  const linkedRequirementIds = new Set(result.tests.flatMap((item) => item.requirementIds));
  const decisions = result.requirements.filter((item) => item.level === "missing-decision").map((item) => ({
    kind: "ÖNCE NETLEŞTİRİN",
    level: plainLevel[item.level],
    name: item.parameter.nameTr,
    standard: "Uzman kararı / ölçüm kanıtı",
    units: item.groundUnitIds.map((id) => plainUnitText(result, id)).join("; ") || "Proje geneli",
    outputs: item.parameter.why,
    raw: item.parameter.rawRequest,
  }));
  const tests = result.tests.map((item) => ({
    kind: fieldTestIds.has(item.method.id) ? "SAHA ÇALIŞMASI" : "LABORATUVAR DENEYİ",
    level: plainLevel[highestTestLevel(item)],
    name: item.method.nameTr,
    standard: item.method.standardPrimary,
    units: item.groundUnitIds.map((id) => plainUnitText(result, id)).join("; ") || "Proje geneli",
    outputs: item.parameterIds.map((id) => plainParameterText(result, id)).join("; "),
    raw: item.method.rawDeliverables.join("; "),
  }));
  const direct = result.requirements.filter((item) => item.level !== "missing-decision" && !linkedRequirementIds.has(item.id)).map((item) => ({
    kind: "DOĞRUDAN VERİ TESLİMİ",
    level: plainLevel[item.level],
    name: item.parameter.nameTr,
    standard: "Proje/saha kaydı",
    units: item.groundUnitIds.map((id) => plainUnitText(result, id)).join("; ") || "Proje geneli",
    outputs: item.parameter.why,
    raw: item.parameter.rawRequest,
  }));
  return [...decisions, ...tests, ...direct];
}

function audit(result: CanonicalResult) {
  const canonicalExport = {
    appVersion: result.appVersion,
    knowledgePackageId: result.knowledgePackageId,
    knowledgeVersion: result.knowledgeVersion,
    knowledgeDigest: result.knowledgeDigest,
    engineeringUseAllowed: result.engineeringUseAllowed,
    analysisLabels: result.analysisLabels,
    project: { id: result.project.id, name: result.project.name, selectedAnalysisIds: [...result.project.selectedAnalysisIds].sort(), groundUnits: result.project.groundUnits.map((unit) => ({ id: unit.id, name: unit.name, soilType: unit.soilType })).sort((a, b) => a.id.localeCompare(b.id)) },
    warnings: [...result.warnings].sort(),
    requirements: result.requirements.map((item) => ({ id: item.id, parameterId: item.parameter.id, nameTr: item.parameter.nameTr, officialName: item.parameter.officialName, symbol: item.parameter.symbol, unit: item.parameter.unit, level: item.level, analysisIds: [...item.analysisIds].sort(), groundUnitIds: [...item.groundUnitIds].sort(), modelIds: [...item.modelIds].sort(), drainage: item.drainage, stiffnessBasis: item.stiffnessBasis, strengthBasis: item.strengthBasis, strengthState: item.strengthState, stressPath: item.stressPath, direction: item.direction, strainRange: item.strainRange, specimenCondition: item.specimenCondition, gtsPath: item.parameter.gtsPath, rawRequest: item.parameter.rawRequest, limitations: [...item.parameter.limitations] })).sort((a, b) => a.id.localeCompare(b.id)),
    tests: result.tests.map((item) => ({ id: item.id, methodId: item.method.id, nameTr: item.method.nameTr, standardPrimary: item.method.standardPrimary, parameterIds: [...item.parameterIds].sort(), requirementIds: [...item.requirementIds].sort(), analysisIds: [...item.analysisIds].sort(), groundUnitIds: [...item.groundUnitIds].sort(), applicability: item.applicability.map((use) => ({ requirementId: use.requirementId, level: use.level, analysisIds: [...use.analysisIds].sort(), groundUnitIds: [...use.groundUnitIds].sort() })).sort((a, b) => a.requirementId.localeCompare(b.requirementId)), rawDeliverables: [...item.method.rawDeliverables] })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const requirementTestLinks = canonicalExport.tests.flatMap((item) => item.requirementIds.map((requirementId) => `${requirementId}=>${item.id}`)).sort();
  const requirementRawRequests = canonicalExport.requirements.map((item) => `${item.id}=>${item.rawRequest}`).sort();
  const requirementPaths = canonicalExport.requirements.map((item) => `${item.id}=>${item.gtsPath}`).sort();
  const requirementLimitations = canonicalExport.requirements.flatMap((item) => item.limitations.map((limitation) => `${item.id}=>${limitation}`)).sort();
  return { requirementIds: canonicalExport.requirements.map((item) => item.id), testIds: canonicalExport.tests.map((item) => item.id), requirementTestLinks, requirementRawRequests, requirementPaths, requirementLimitations, engineeringUseAllowed: result.engineeringUseAllowed, resultSha256: sha256(canonicalJson(canonicalExport)) };
}

function cell(value: string, bold = false): TableCell {
  return new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 17 })] })] });
}

function workCell(value: string, bold = false): TableCell {
  return new TableCell({ margins: { top: 95, bottom: 95, left: 95, right: 95 }, children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 19 })] })] });
}

async function makeDocx(result: CanonicalResult, path: string): Promise<void> {
  const isDraft = !result.engineeringUseAllowed;
  const a = audit(result);
  const title = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [new TextRun({ text: "GAIA", bold: true, color: "123D4A", size: 48 }), new TextRun({ text: "\nGTS NX GEOTEKNİK VERİ TALEBİ", bold: true, color: "2B8179", size: 23 })] });
  const draft = isDraft ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: "İNCELEME TASLAĞI — BAĞIMSIZ GEOTEKNİK UZMAN ONAYI GEREKLİDİR", bold: true, color: "A3484F", size: 19 })] }) : new Paragraph("");
  const requirementRows = [new TableRow({ tableHeader: true, cantSplit: true, children: [cell("Kimlik", true), cell("Durum / Talep", true), cell("Bağlam", true), cell("Analizler", true), cell("Birimler", true), cell("Seçilen birincil deney", true)] }), ...result.requirements.map((req) => new TableRow({ cantSplit: true, children: [cell(req.id), cell(`${trLevel[req.level]}\n${req.parameter.nameTr}\n${req.parameter.officialName} · ${req.parameter.symbol} [${req.parameter.unit}]`), cell(contextLabel(req)), cell(req.analysisIds.map((id) => analysisText(result, id)).join("\n")), cell(req.groundUnitIds.map((id) => unitText(result, id)).join("\n") || "Proje geneli"), cell(selectedTestText(result, req.id))] }))];
  const rawRequestParagraphs = result.requirements.map((req) => new Paragraph({ keepNext: false, spacing: { after: 110 }, children: [new TextRun({ text: `${req.id} · ${req.parameter.nameTr}\n`, bold: true, color: "154B57", size: 18 }), new TextRun({ text: `Kullanım yeri: ${req.parameter.gtsPath}\n`, italics: true, color: "4B6871", size: 17 }), new TextRun({ text: `Ham teslim talebi: ${req.parameter.rawRequest}`, size: 18 }), ...(req.parameter.limitations.length ? [new TextRun({ text: `\nDikkat: ${req.parameter.limitations.join(" ")}`, color: "8E4E2C", size: 17 })] : [])] }));
  const testRows = [new TableRow({ tableHeader: true, cantSplit: true, children: [cell("Kimlik", true), cell("Deney", true), cell("Standart", true), cell("Sağladığı parametreler", true), cell("Durum / birimler", true), cell("Ham teslim", true)] }), ...result.tests.map((item) => new TableRow({ cantSplit: true, children: [cell(item.id), cell(`${item.method.nameTr}\n${item.method.nameEn}`), cell(`${item.method.standardPrimary}${item.method.standardAlternative ? `\nAlternatif: ${item.method.standardAlternative}` : ""}`), cell(item.parameterIds.map((id) => parameterText(result, id)).join("\n")), cell(testApplicabilityText(result, item)), cell(item.method.rawDeliverables.join("; "))] }))];
  const workOrderRows = [new TableRow({ tableHeader: true, cantSplit: true, children: [workCell("Öncelik / yapılacak iş", true), workCell("Uygulanacak birimler", true), workCell("Beklenen çıktılar", true), workCell("Ham kayıt ve dosyalar", true)] }), ...buildWorkOrderRows(result).map((item) => new TableRow({ cantSplit: true, children: [workCell(`${item.kind}\n${item.level}\n${item.name}\n${item.standard}`), workCell(item.units), workCell(item.outputs), workCell(item.raw)] }))];
  const doc = new Document({
    styles: { default: { document: { run: { font: "Aptos", size: 20, color: "263F49" }, paragraph: { spacing: { after: 100 } } } } },
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 650, bottom: 760, left: 650 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${isDraft ? "İNCELEME TASLAĞI · " : ""}GAIA ${result.appVersion} · Bilgi ${result.knowledgeVersion} · ${a.resultSha256}`, bold: isDraft, size: 14, color: isDraft ? "A3484F" : "687B81" })] })] }) },
      children: [
        title, draft,
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "1. Proje kapsamı" }),
        new Paragraph({ children: [new TextRun({ text: "Proje: ", bold: true }), new TextRun(result.project.name), new TextRun({ text: "\nKonum: ", bold: true }), new TextRun(result.project.location || "—"), new TextRun({ text: "\nİşveren: ", bold: true }), new TextRun(result.project.client || "—"), new TextRun({ text: "\nKoordinat / datum: ", bold: true }), new TextRun(`${result.project.coordinateSystem || "EKSİK"} / ${result.project.verticalDatum || "EKSİK"}`)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Kritik uyarılar" }),
        ...result.warnings.map((warning) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: warning, color: "8E4E2C" })] })),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "2. Geoteknik ekip için iş emri" }),
        new Paragraph({ children: [new TextRun({ text: "Uygulama sırası: ", bold: true }), new TextRun("Önce açık kararları netleştirin; ardından saha ve laboratuvar çalışmalarını planlayın; yorumlanmış sonuçlarla birlikte ham kayıtları teslim edin.")] }),
        new Paragraph("GAIA deney adedi veya sondaj derinliği uydurmaz. Geoteknik ekip; hedef birimler ve tasarım etki derinliğine göre adet/derinlik programını teklif etmelidir."),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: workOrderRows, borders: { top: { style: BorderStyle.SINGLE, color: "AFCAC5", size: 2 }, bottom: { style: BorderStyle.SINGLE, color: "AFCAC5", size: 2 }, left: { style: BorderStyle.SINGLE, color: "AFCAC5", size: 2 }, right: { style: BorderStyle.SINGLE, color: "AFCAC5", size: 2 }, insideHorizontal: { style: BorderStyle.SINGLE, color: "DCE4E1", size: 1 }, insideVertical: { style: BorderStyle.SINGLE, color: "DCE4E1", size: 1 } } }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "3. Teknik ek — birleştirilmiş parametre talepleri" }),
        new Paragraph(`${result.requirements.length} benzersiz gereksinim; aynı mühendislik anlamındaki tekrarlar birleştirilmiştir.`),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: requirementRows, borders: { top: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, bottom: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, left: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, right: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, insideHorizontal: { style: BorderStyle.SINGLE, color: "E2E7E4", size: 1 }, insideVertical: { style: BorderStyle.SINGLE, color: "E2E7E4", size: 1 } } }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Ham veri teslim kapsamı" }),
        new Paragraph("Aşağıdaki ham kayıtlar, yalnız yorumlanmış sonuçlar yerine denetlenebilir veri iziyle birlikte teslim edilmelidir."),
        ...rawRequestParagraphs,
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "4. Teknik deney matrisi ve ham veri teslimleri" }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: testRows }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "5. Kaynak ve sürüm izi" }),
        new Paragraph(`Uygulama: ${result.appVersion}\nBilgi paketi: ${result.knowledgeVersion}\nBilgi özeti: ${result.knowledgeDigest}\nKanonik sonuç özeti: ${a.resultSha256}`),
        ...result.sources.map((source) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${source.title} — ${source.locator}${source.url ? ` — ${source.url}` : ""}`, size: 17 })] })),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "6. İnceleme ve imza" }),
        new Paragraph("Hazırlayan: ____________________    Tarih: __________\nGeoteknik inceleyen: _______________    Tarih: __________\nOnay: _____________________________"),
      ],
    }],
  });
  writeFileSync(path, await Packer.toBuffer(doc));
}

async function makeXlsx(result: CanonicalResult, path: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GAIA"; workbook.created = new Date(result.generatedAt);
  const workSheet = workbook.addWorksheet(`${!result.engineeringUseAllowed ? "TASLAK_" : ""}01_IS_EMRI`);
  workSheet.columns = [
    { header: "İş grubu", key: "kind", width: 23 }, { header: "Öncelik", key: "level", width: 25 }, { header: "Yapılacak iş / deney", key: "name", width: 37 }, { header: "Standart / karar yolu", key: "standard", width: 36 }, { header: "Uygulanacak birimler", key: "units", width: 31 }, { header: "Beklenen çıktılar", key: "outputs", width: 52 }, { header: "Teslim edilecek ham kayıtlar", key: "raw", width: 70 }, { header: "Sorumlu", key: "owner", width: 20 }, { header: "Teslim tarihi", key: "due", width: 16 }, { header: "Dosya / QA", key: "qa", width: 25 },
  ];
  buildWorkOrderRows(result).forEach((item) => workSheet.addRow({ kind: item.kind, level: item.level, name: safeSpreadsheet(item.name), standard: safeSpreadsheet(item.standard), units: safeSpreadsheet(item.units), outputs: safeSpreadsheet(item.outputs), raw: safeSpreadsheet(item.raw), owner: "", due: "", qa: "" }));
  workSheet.insertRow(1, ["GEOTEKNİK EKİP İÇİN İŞ EMRİ", "Önce açık kararları netleştirin; saha ve laboratuvarı planlayın; ham kayıtları yorumlanmış raporla birlikte teslim edin."]);
  workSheet.mergeCells("B1:J1");
  workSheet.insertRow(2, ["Program notu", "GAIA deney adedi veya sondaj derinliği uydurmaz. Geoteknik ekip, hedef birimler ve tasarım etki derinliğine göre adet/derinlik programını teklif etmelidir."]);
  workSheet.mergeCells("B2:J2");
  workSheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; workSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123D4A" } }; workSheet.getRow(1).height = 30;
  workSheet.getRow(2).font = { bold: true, color: { argb: "FF355C62" } }; workSheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F3F0" } }; workSheet.getRow(2).height = 34;
  workSheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } }; workSheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C746D" } }; workSheet.getRow(3).height = 28;
  workSheet.views = [{ state: "frozen", ySplit: 3 }]; workSheet.autoFilter = { from: "A3", to: "J3" };
  workSheet.eachRow((row, number) => { row.alignment = { vertical: "top", wrapText: true }; if (number > 3 && number % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F1EA" } }; });
  const cover = workbook.addWorksheet("00_OKU");
  cover.columns = [{ width: 27 }, { width: 88 }];
  [["GAIA", "GTS NX Geoteknik Veri Talebi"], ["Durum", !result.engineeringUseAllowed ? "İNCELEME TASLAĞI — UZMAN ONAYI GEREKLİ" : "UZMAN ONAYLI"], ["Proje", result.project.name], ["Uygulama", result.appVersion], ["Bilgi paketi", `${result.knowledgePackageId} / ${result.knowledgeVersion}`], ["Bilgi özeti", result.knowledgeDigest], ["Kanonik sonuç özeti", audit(result).resultSha256]].forEach((row) => cover.addRow(row.map(safeSpreadsheet)));
  cover.getRow(1).font = { bold: true, size: 18, color: { argb: "FF123D4A" } };
  const reqSheet = workbook.addWorksheet(`${!result.engineeringUseAllowed ? "TASLAK_" : ""}02_PARAMETRELER`);
  reqSheet.columns = [
    { header: "Gereksinim ID", key: "id", width: 17 }, { header: "Durum", key: "level", width: 21 }, { header: "Grup", key: "group", width: 18 }, { header: "Parametre (TR)", key: "tr", width: 28 }, { header: "GTS NX resmi alan adı / GAIA iş akışı", key: "en", width: 36 }, { header: "Sembol", key: "symbol", width: 12 }, { header: "Birim", key: "unit", width: 12 }, { header: "Kullanım yeri", key: "path", width: 45 }, { header: "Bağlam", key: "context", width: 33 }, { header: "Analizler", key: "analyses", width: 34 }, { header: "Jeoteknik birimler", key: "units", width: 31 }, { header: "Deney yolu", key: "method", width: 34 }, { header: "Ham teslim talebi", key: "raw", width: 65 }, { header: "Sınırlamalar / dikkat", key: "limitations", width: 55 }, { header: "Sorumlu", key: "owner", width: 18 }, { header: "Teslim tarihi", key: "due", width: 16 }, { header: "Dosya / QA", key: "qa", width: 24 },
  ];
  result.requirements.forEach((req) => reqSheet.addRow({ id: req.id, level: trLevel[req.level], group: req.parameter.group, tr: safeSpreadsheet(req.parameter.nameTr), en: safeSpreadsheet(req.parameter.officialName), symbol: req.parameter.symbol, unit: req.parameter.unit, path: safeSpreadsheet(req.parameter.gtsPath), context: contextLabel(req), analyses: safeSpreadsheet(req.analysisIds.map((id) => analysisText(result, id)).join("; ")), units: safeSpreadsheet(req.groundUnitIds.map((id) => unitText(result, id)).join("; ") || "Proje geneli"), method: safeSpreadsheet(selectedTestText(result, req.id)), raw: safeSpreadsheet(req.parameter.rawRequest), limitations: safeSpreadsheet(req.parameter.limitations.join("; ")), owner: "", due: "", qa: "" }));
  const testSheet = workbook.addWorksheet(`${!result.engineeringUseAllowed ? "TASLAK_" : ""}03_DENEY_MATRISI`);
  testSheet.columns = [{ header: "Deney ID", key: "id", width: 17 }, { header: "Deney", key: "name", width: 34 }, { header: "İngilizce ad", key: "nameEn", width: 35 }, { header: "Birincil standart", key: "primary", width: 34 }, { header: "Alternatif", key: "alternative", width: 34 }, { header: "Parametreler", key: "parameters", width: 40 }, { header: "Analizler", key: "analyses", width: 40 }, { header: "Birimler", key: "units", width: 35 }, { header: "Durum / birim eşlemesi", key: "applicability", width: 45 }, { header: "Ham teslimler", key: "raw", width: 70 }];
  result.tests.forEach((item) => testSheet.addRow({ id: item.id, name: safeSpreadsheet(item.method.nameTr), nameEn: safeSpreadsheet(item.method.nameEn), primary: item.method.standardPrimary, alternative: item.method.standardAlternative ?? "", parameters: safeSpreadsheet(item.parameterIds.map((id) => parameterText(result, id)).join("; ")), analyses: safeSpreadsheet(item.analysisIds.map((id) => analysisText(result, id)).join("; ")), units: safeSpreadsheet(item.groundUnitIds.map((id) => unitText(result, id)).join("; ")), applicability: safeSpreadsheet(testApplicabilityText(result, item)), raw: safeSpreadsheet(item.method.rawDeliverables.join("; ")) }));
  const auditSheet = workbook.addWorksheet("99_AUDIT");
  auditSheet.state = "veryHidden";
  auditSheet.columns = [{ header: "Tür", width: 23 }, { header: "Kimlik / Değer", width: 80 }];
  const a = audit(result);
  Object.entries(a).forEach(([key, value]) => Array.isArray(value) ? value.forEach((item) => auditSheet.addRow([key, item])) : auditSheet.addRow([key, value]));
  for (const sheet of [reqSheet, testSheet]) {
    sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: sheet.getRow(1).getCell(sheet.columnCount).address };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123D4A" } }; sheet.getRow(1).height = 28;
    sheet.eachRow((row, number) => { if (number > 1) { row.alignment = { vertical: "top", wrapText: true }; if (number % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F1EA" } }; } });
  }
  await workbook.xlsx.writeFile(path);
}

function pdfHtml(result: CanonicalResult): string {
  const a = audit(result);
  const isDraft = !result.engineeringUseAllowed;
  const rows = result.requirements.map((req) => `<tr><td>${escapeHtml(req.id)}</td><td><b>${escapeHtml(req.parameter.nameTr)}</b><small>${escapeHtml(req.parameter.officialName)} · ${escapeHtml(req.parameter.symbol)} [${escapeHtml(req.parameter.unit)}]<br>Birincil deney: ${escapeHtml(selectedTestText(result, req.id))}</small></td><td>${escapeHtml(trLevel[req.level])}</td><td>${escapeHtml(contextLabel(req))}</td><td>${escapeHtml(req.analysisIds.map((id) => analysisText(result, id)).join("; "))}</td><td>${escapeHtml(req.groundUnitIds.map((id) => unitText(result, id)).join("; ") || "Proje geneli")}</td></tr>`).join("");
  const rawRequests = result.requirements.map((req) => `<div class="raw-request"><b>${escapeHtml(req.id)} · ${escapeHtml(req.parameter.nameTr)}</b><small>Kullanım yeri: ${escapeHtml(req.parameter.gtsPath)}</small><p><b>Ham teslim talebi:</b> ${escapeHtml(req.parameter.rawRequest)}</p>${req.parameter.limitations.length ? `<p class="caution"><b>Dikkat:</b> ${escapeHtml(req.parameter.limitations.join(" "))}</p>` : ""}</div>`).join("");
  const testRows = result.tests.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td><b>${escapeHtml(item.method.nameTr)}</b><small>${escapeHtml(item.method.nameEn)}</small></td><td>${escapeHtml(item.method.standardPrimary)}</td><td>${escapeHtml(item.parameterIds.map((id) => parameterText(result, id)).join("; "))}<small>Durum / birimler: ${escapeHtml(testApplicabilityText(result, item))}</small></td><td>${escapeHtml(item.method.rawDeliverables.join("; "))}</td></tr>`).join("");
  const workRows = buildWorkOrderRows(result).map((item) => `<tr><td><b>${escapeHtml(item.kind)}</b><small>${escapeHtml(item.level)}</small></td><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.standard)}</small></td><td>${escapeHtml(item.units)}</td><td>${escapeHtml(item.outputs)}</td><td>${escapeHtml(item.raw)}</td></tr>`).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:14mm 12mm 16mm}*{box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;color:#203c47;font-size:8.5px;margin:0}h1{font-family:Georgia,serif;font-size:28px;letter-spacing:4px;color:#123d4a;margin:0}h2{font-family:Georgia,serif;color:#154b57;font-size:17px;margin:22px 0 8px}.cover{height:155mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.subtitle{color:#258f84;font-size:13px;letter-spacing:2px}.draft{margin:20px;padding:9px 14px;border:1px solid #b8565c;color:#9b3f47;font-weight:700}.meta{line-height:1.8}.work-lead{font-size:11px;line-height:1.5;padding:10px 13px;border-left:4px solid #2e9f94;background:#eaf5f2}.work-note{font-size:10px;padding:8px 10px;background:#fff2dd}.work-order{font-size:10px;line-height:1.35}.work-order th{font-size:10px;padding:8px}.work-order td{padding:7px}.work-order th:nth-child(1){width:15%}.work-order th:nth-child(2){width:19%}.work-order th:nth-child(3){width:15%}.work-order th:nth-child(4){width:22%}.work-order th:nth-child(5){width:29%}.warnings{padding:10px 16px;background:#fff2dd;border-left:4px solid #c08b37}.warnings p{margin:3px 0}.page{break-before:page}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#123d4a;color:white;padding:6px;text-align:left}td{border:1px solid #d7dedb;padding:5px;vertical-align:top;word-break:break-word}tr:nth-child(even){background:#f3f1ea}td small,.raw-request small{display:block;color:#5d747a;margin-top:3px}.raw-request{break-inside:avoid;margin:0 0 5px;padding:6px 8px;border-left:3px solid #57a99f;background:#f1f7f5}.raw-request b{color:#154b57}.raw-request p{margin:3px 0 0;line-height:1.45}.raw-request .caution{color:#83472b}.footer{position:fixed;bottom:-10mm;left:0;right:0;text-align:center;color:${isDraft ? "#9b3f47" : "#77888b"};font-weight:${isDraft ? "700" : "400"};font-size:7px}</style></head><body><div class="footer">${isDraft ? "İNCELEME TASLAĞI · " : ""}GAIA ${escapeHtml(result.appVersion)} · ${escapeHtml(result.knowledgeVersion)} · ${escapeHtml(a.resultSha256)}</div><section class="cover"><h1>GAIA</h1><p class="subtitle">GTS NX GEOTEKNİK VERİ TALEBİ</p>${isDraft ? '<p class="draft">İNCELEME TASLAĞI — BAĞIMSIZ GEOTEKNİK UZMAN ONAYI GEREKLİDİR</p>' : ""}<div class="meta"><b>${escapeHtml(result.project.name)}</b><br>${escapeHtml(result.project.location || "—")}<br>${escapeHtml(result.project.client || "—")}</div></section><section class="page"><h2>GEOTEKNİK EKİP İÇİN İŞ EMRİ</h2><p class="work-lead"><b>Uygulama sırası:</b> Önce açık kararları netleştirin; ardından saha ve laboratuvar çalışmalarını planlayın; yorumlanmış sonuçlarla birlikte ham kayıtları teslim edin.</p><p class="work-note"><b>Program notu:</b> GAIA deney adedi veya sondaj derinliği uydurmaz. Geoteknik ekip, hedef birimler ve tasarım etki derinliğine göre adet/derinlik programını teklif etmelidir.</p><table class="work-order"><thead><tr><th>İş grubu / öncelik</th><th>Yapılacak iş</th><th>Uygulanacak birimler</th><th>Beklenen çıktılar</th><th>Ham kayıt ve dosyalar</th></tr></thead><tbody>${workRows}</tbody></table></section><section class="page"><h2>1. Kritik uyarılar</h2><div class="warnings">${result.warnings.map((w) => `<p>• ${escapeHtml(w)}</p>`).join("")}</div><h2>2. Teknik ek — birleştirilmiş parametre talepleri</h2><p>${result.requirements.length} benzersiz gereksinim; aynı mühendislik anlamındaki tekrarlar birleştirilmiştir.</p><table><thead><tr><th>ID</th><th>Talep</th><th>Durum</th><th>Bağlam</th><th>Analizler</th><th>Birimler</th></tr></thead><tbody>${rows}</tbody></table><h2>2.1 Ham veri teslim kapsamı</h2><p>Aşağıdaki ham kayıtlar, yalnız yorumlanmış sonuçlar yerine denetlenebilir veri iziyle birlikte teslim edilmelidir.</p>${rawRequests}</section><section class="page"><h2>3. Teknik deney matrisi ve ham teslimler</h2><table><thead><tr><th>ID</th><th>Deney</th><th>Standart</th><th>Parametreler</th><th>Ham teslim</th></tr></thead><tbody>${testRows}</tbody></table><h2>4. Kaynak ve sürüm izi</h2><p>Uygulama: ${escapeHtml(result.appVersion)}<br>Bilgi paketi: ${escapeHtml(result.knowledgeVersion)}<br>Bilgi özeti: ${escapeHtml(result.knowledgeDigest)}<br>Kanonik sonuç özeti: ${escapeHtml(a.resultSha256)}</p><h2>5. İnceleme ve imza</h2><p>Hazırlayan: ____________________ &nbsp; Tarih: __________<br><br>Geoteknik inceleyen: _______________ &nbsp; Tarih: __________<br><br>Onay: _____________________________</p></section></body></html>`;
}

async function makePdf(result: CanonicalResult, path: string): Promise<void> {
  const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml(result))}`);
    await window.webContents.executeJavaScript('document.querySelector(".footer")?.remove()');
    const draftLabel = !result.engineeringUseAllowed ? "İNCELEME TASLAĞI · " : "";
    const data = await window.webContents.printToPDF({
      printBackground: true,
      landscape: true,
      pageSize: "A4",
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;text-align:center;font-family:Segoe UI,Arial,sans-serif;font-size:7px;color:${!result.engineeringUseAllowed ? "#9b3f47" : "#77888b"};font-weight:${!result.engineeringUseAllowed ? "700" : "400"}">${escapeHtml(draftLabel)}GAIA ${escapeHtml(result.appVersion)} · ${escapeHtml(result.knowledgeVersion)} · ${escapeHtml(audit(result).resultSha256)}</div>`,
      margins: { top: 0.3, bottom: 0.55, left: 0.25, right: 0.25 },
    });
    writeFileSync(path, data);
  } finally { window.destroy(); }
}

export async function exportBundle(result: CanonicalResult, parentDirectory: string): Promise<{ directory: string; files: string[] }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = !result.engineeringUseAllowed ? "TASLAK-" : "";
  const base = `${prefix}GAIA-${safeName(result.project.name)}-${stamp}`;
  const stage = join(parentDirectory, `.${base}.tmp`);
  const target = join(parentDirectory, base);
  mkdirSync(stage, { recursive: false });
  const names = [`${base}.docx`, `${base}.pdf`, `${base}.xlsx`, `${base}.manifest.json`];
  try {
    await makeDocx(result, join(stage, names[0]));
    await makePdf(result, join(stage, names[1]));
    await makeXlsx(result, join(stage, names[2]));
    const a = audit(result);
    const fileSha256 = Object.fromEntries(names.slice(0, 3).map((name) => [name, sha256(readFileSync(join(stage, name)))]));
    writeFileSync(join(stage, names[3]), `${JSON.stringify({ ...a, generatedAt: result.generatedAt, projectId: result.project.id, knowledgePackageId: result.knowledgePackageId, engineeringUseAllowed: result.engineeringUseAllowed, files: names.slice(0, 3), fileSha256 }, null, 2)}\n`, "utf8");
    renameSync(stage, target);
    return { directory: target, files: names.map((name) => join(target, name)) };
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
