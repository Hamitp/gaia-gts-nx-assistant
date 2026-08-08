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
    requirements: result.requirements.map((item) => ({ id: item.id, parameterId: item.parameter.id, nameTr: item.parameter.nameTr, officialName: item.parameter.officialName, symbol: item.parameter.symbol, unit: item.parameter.unit, level: item.level, analysisIds: [...item.analysisIds].sort(), groundUnitIds: [...item.groundUnitIds].sort(), modelIds: [...item.modelIds].sort(), drainage: item.drainage, stiffnessBasis: item.stiffnessBasis, strengthBasis: item.strengthBasis, strengthState: item.strengthState, stressPath: item.stressPath, direction: item.direction, strainRange: item.strainRange, specimenCondition: item.specimenCondition, rawRequest: item.parameter.rawRequest })).sort((a, b) => a.id.localeCompare(b.id)),
    tests: result.tests.map((item) => ({ id: item.id, methodId: item.method.id, nameTr: item.method.nameTr, standardPrimary: item.method.standardPrimary, parameterIds: [...item.parameterIds].sort(), requirementIds: [...item.requirementIds].sort(), analysisIds: [...item.analysisIds].sort(), groundUnitIds: [...item.groundUnitIds].sort(), applicability: item.applicability.map((use) => ({ requirementId: use.requirementId, level: use.level, analysisIds: [...use.analysisIds].sort(), groundUnitIds: [...use.groundUnitIds].sort() })).sort((a, b) => a.requirementId.localeCompare(b.requirementId)), rawDeliverables: [...item.method.rawDeliverables] })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const requirementTestLinks = canonicalExport.tests.flatMap((item) => item.requirementIds.map((requirementId) => `${requirementId}=>${item.id}`)).sort();
  return { requirementIds: canonicalExport.requirements.map((item) => item.id), testIds: canonicalExport.tests.map((item) => item.id), requirementTestLinks, engineeringUseAllowed: result.engineeringUseAllowed, resultSha256: sha256(canonicalJson(canonicalExport)) };
}

function cell(value: string, bold = false): TableCell {
  return new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 17 })] })] });
}

async function makeDocx(result: CanonicalResult, path: string): Promise<void> {
  const isDraft = !result.engineeringUseAllowed;
  const a = audit(result);
  const title = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [new TextRun({ text: "GAIA", bold: true, color: "123D4A", size: 48 }), new TextRun({ text: "\nGTS NX GEOTEKNİK VERİ TALEBİ", bold: true, color: "2B8179", size: 23 })] });
  const draft = isDraft ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: "İNCELEME TASLAĞI — BAĞIMSIZ GEOTEKNİK UZMAN ONAYI GEREKLİDİR", bold: true, color: "A3484F", size: 19 })] }) : new Paragraph("");
  const requirementRows = [new TableRow({ tableHeader: true, children: [cell("Kimlik", true), cell("Durum / Talep", true), cell("Bağlam", true), cell("Analizler", true), cell("Birimler", true), cell("Seçilen birincil deney", true)] }), ...result.requirements.map((req) => new TableRow({ children: [cell(req.id), cell(`${trLevel[req.level]}\n${req.parameter.nameTr}\n${req.parameter.officialName} · ${req.parameter.symbol} [${req.parameter.unit}]`), cell(contextLabel(req)), cell(req.analysisIds.map((id) => analysisText(result, id)).join("\n")), cell(req.groundUnitIds.map((id) => unitText(result, id)).join("\n") || "Proje geneli"), cell(selectedTestText(result, req.id))] }))];
  const testRows = [new TableRow({ tableHeader: true, children: [cell("Kimlik", true), cell("Deney", true), cell("Standart", true), cell("Sağladığı parametreler", true), cell("Ham teslim", true)] }), ...result.tests.map((item) => new TableRow({ children: [cell(item.id), cell(`${item.method.nameTr}\n${item.method.nameEn}`), cell(`${item.method.standardPrimary}${item.method.standardAlternative ? `\nAlternatif: ${item.method.standardAlternative}` : ""}`), cell(item.parameterIds.map((id) => parameterText(result, id)).join("\n")), cell(item.method.rawDeliverables.join("; "))] }))];
  const doc = new Document({
    styles: { default: { document: { run: { font: "Aptos", size: 20, color: "263F49" }, paragraph: { spacing: { after: 100 } } } } },
    sections: [{
      properties: { page: { margin: { top: 900, right: 720, bottom: 850, left: 720 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${isDraft ? "İNCELEME TASLAĞI · " : ""}GAIA ${result.appVersion} · Bilgi ${result.knowledgeVersion} · ${a.resultSha256}`, bold: isDraft, size: 14, color: isDraft ? "A3484F" : "687B81" })] })] }) },
      children: [
        title, draft,
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "1. Proje kapsamı" }),
        new Paragraph({ children: [new TextRun({ text: "Proje: ", bold: true }), new TextRun(result.project.name), new TextRun({ text: "\nKonum: ", bold: true }), new TextRun(result.project.location || "—"), new TextRun({ text: "\nİşveren: ", bold: true }), new TextRun(result.project.client || "—"), new TextRun({ text: "\nKoordinat / datum: ", bold: true }), new TextRun(`${result.project.coordinateSystem || "EKSİK"} / ${result.project.verticalDatum || "EKSİK"}`)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Kritik uyarılar" }),
        ...result.warnings.map((warning) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: warning, color: "8E4E2C" })] })),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "2. Birleştirilmiş parametre talepleri" }),
        new Paragraph(`${result.requirements.length} benzersiz gereksinim; aynı mühendislik anlamındaki tekrarlar birleştirilmiştir.`),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: requirementRows, borders: { top: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, bottom: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, left: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, right: { style: BorderStyle.SINGLE, color: "CAD3D1", size: 2 }, insideHorizontal: { style: BorderStyle.SINGLE, color: "E2E7E4", size: 1 }, insideVertical: { style: BorderStyle.SINGLE, color: "E2E7E4", size: 1 } } }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "3. Deney programı ve ham veri teslimleri" }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: testRows }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "4. Kaynak ve sürüm izi" }),
        new Paragraph(`Uygulama: ${result.appVersion}\nBilgi paketi: ${result.knowledgeVersion}\nBilgi özeti: ${result.knowledgeDigest}\nKanonik sonuç özeti: ${a.resultSha256}`),
        ...result.sources.map((source) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${source.title} — ${source.locator}${source.url ? ` — ${source.url}` : ""}`, size: 17 })] })),
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "5. İnceleme ve imza" }),
        new Paragraph("Hazırlayan: ____________________    Tarih: __________\nGeoteknik inceleyen: _______________    Tarih: __________\nOnay: _____________________________"),
      ],
    }],
  });
  writeFileSync(path, await Packer.toBuffer(doc));
}

async function makeXlsx(result: CanonicalResult, path: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GAIA"; workbook.created = new Date(result.generatedAt);
  const cover = workbook.addWorksheet("00_OKU");
  cover.columns = [{ width: 27 }, { width: 88 }];
  [["GAIA", "GTS NX Geoteknik Veri Talebi"], ["Durum", !result.engineeringUseAllowed ? "İNCELEME TASLAĞI — UZMAN ONAYI GEREKLİ" : "UZMAN ONAYLI"], ["Proje", result.project.name], ["Uygulama", result.appVersion], ["Bilgi paketi", `${result.knowledgePackageId} / ${result.knowledgeVersion}`], ["Bilgi özeti", result.knowledgeDigest], ["Kanonik sonuç özeti", audit(result).resultSha256]].forEach((row) => cover.addRow(row.map(safeSpreadsheet)));
  cover.getRow(1).font = { bold: true, size: 18, color: { argb: "FF123D4A" } };
  const reqSheet = workbook.addWorksheet(`${!result.engineeringUseAllowed ? "TASLAK_" : ""}01_PARAMETRELER`);
  reqSheet.columns = [
    { header: "Gereksinim ID", key: "id", width: 17 }, { header: "Durum", key: "level", width: 21 }, { header: "Grup", key: "group", width: 18 }, { header: "Parametre (TR)", key: "tr", width: 28 }, { header: "GTS NX resmi alan adı", key: "en", width: 28 }, { header: "Sembol", key: "symbol", width: 12 }, { header: "Birim", key: "unit", width: 12 }, { header: "Bağlam", key: "context", width: 33 }, { header: "Analizler", key: "analyses", width: 34 }, { header: "Jeoteknik birimler", key: "units", width: 31 }, { header: "Deney yolu", key: "method", width: 34 }, { header: "Ham teslim talebi", key: "raw", width: 65 }, { header: "Sorumlu", key: "owner", width: 18 }, { header: "Teslim tarihi", key: "due", width: 16 }, { header: "Dosya / QA", key: "qa", width: 24 },
  ];
  result.requirements.forEach((req) => reqSheet.addRow({ id: req.id, level: trLevel[req.level], group: req.parameter.group, tr: safeSpreadsheet(req.parameter.nameTr), en: safeSpreadsheet(req.parameter.officialName), symbol: req.parameter.symbol, unit: req.parameter.unit, context: contextLabel(req), analyses: safeSpreadsheet(req.analysisIds.map((id) => analysisText(result, id)).join("; ")), units: safeSpreadsheet(req.groundUnitIds.map((id) => unitText(result, id)).join("; ") || "Proje geneli"), method: safeSpreadsheet(selectedTestText(result, req.id)), raw: safeSpreadsheet(req.parameter.rawRequest), owner: "", due: "", qa: "" }));
  const testSheet = workbook.addWorksheet(`${!result.engineeringUseAllowed ? "TASLAK_" : ""}02_DENEY_PROGRAMI`);
  testSheet.columns = [{ header: "Deney ID", key: "id", width: 17 }, { header: "Deney", key: "name", width: 34 }, { header: "İngilizce ad", key: "nameEn", width: 35 }, { header: "Birincil standart", key: "primary", width: 34 }, { header: "Alternatif", key: "alternative", width: 34 }, { header: "Parametreler", key: "parameters", width: 40 }, { header: "Analizler", key: "analyses", width: 40 }, { header: "Birimler", key: "units", width: 35 }, { header: "Ham teslimler", key: "raw", width: 70 }];
  result.tests.forEach((item) => testSheet.addRow({ id: item.id, name: safeSpreadsheet(item.method.nameTr), nameEn: safeSpreadsheet(item.method.nameEn), primary: item.method.standardPrimary, alternative: item.method.standardAlternative ?? "", parameters: safeSpreadsheet(item.parameterIds.map((id) => parameterText(result, id)).join("; ")), analyses: safeSpreadsheet(item.analysisIds.map((id) => analysisText(result, id)).join("; ")), units: safeSpreadsheet(item.groundUnitIds.map((id) => unitText(result, id)).join("; ")), raw: safeSpreadsheet(item.method.rawDeliverables.join("; ")) }));
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
  const testRows = result.tests.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td><b>${escapeHtml(item.method.nameTr)}</b><small>${escapeHtml(item.method.nameEn)}</small></td><td>${escapeHtml(item.method.standardPrimary)}</td><td>${escapeHtml(item.parameterIds.map((id) => parameterText(result, id)).join("; "))}</td><td>${escapeHtml(item.method.rawDeliverables.join("; "))}</td></tr>`).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:14mm 12mm 16mm}*{box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;color:#203c47;font-size:8.5px;margin:0}h1{font-family:Georgia,serif;font-size:28px;letter-spacing:4px;color:#123d4a;margin:0}h2{font-family:Georgia,serif;color:#154b57;font-size:17px;margin:22px 0 8px}.cover{height:155mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.subtitle{color:#258f84;font-size:13px;letter-spacing:2px}.draft{margin:20px;padding:9px 14px;border:1px solid #b8565c;color:#9b3f47;font-weight:700}.meta{line-height:1.8}.warnings{padding:10px 16px;background:#fff2dd;border-left:4px solid #c08b37}.warnings p{margin:3px 0}.page{break-before:page}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#123d4a;color:white;padding:6px;text-align:left}td{border:1px solid #d7dedb;padding:5px;vertical-align:top;word-break:break-word}tr:nth-child(even){background:#f3f1ea}td small{display:block;color:#6e8186;margin-top:3px}.footer{position:fixed;bottom:-10mm;left:0;right:0;text-align:center;color:${isDraft ? "#9b3f47" : "#77888b"};font-weight:${isDraft ? "700" : "400"};font-size:7px}</style></head><body><div class="footer">${isDraft ? "İNCELEME TASLAĞI · " : ""}GAIA ${escapeHtml(result.appVersion)} · ${escapeHtml(result.knowledgeVersion)} · ${escapeHtml(a.resultSha256)}</div><section class="cover"><h1>GAIA</h1><p class="subtitle">GTS NX GEOTEKNİK VERİ TALEBİ</p>${isDraft ? '<p class="draft">İNCELEME TASLAĞI — BAĞIMSIZ GEOTEKNİK UZMAN ONAYI GEREKLİDİR</p>' : ""}<div class="meta"><b>${escapeHtml(result.project.name)}</b><br>${escapeHtml(result.project.location || "—")}<br>${escapeHtml(result.project.client || "—")}</div></section><section class="page"><h2>1. Kritik uyarılar</h2><div class="warnings">${result.warnings.map((w) => `<p>• ${escapeHtml(w)}</p>`).join("")}</div><h2>2. Birleştirilmiş parametre talepleri</h2><p>${result.requirements.length} benzersiz gereksinim; aynı mühendislik anlamındaki tekrarlar birleştirilmiştir.</p><table><thead><tr><th>ID</th><th>Talep</th><th>Durum</th><th>Bağlam</th><th>Analizler</th><th>Birimler</th></tr></thead><tbody>${rows}</tbody></table></section><section class="page"><h2>3. Deney programı ve ham teslimler</h2><table><thead><tr><th>ID</th><th>Deney</th><th>Standart</th><th>Parametreler</th><th>Ham teslim</th></tr></thead><tbody>${testRows}</tbody></table><h2>4. Kaynak ve sürüm izi</h2><p>Uygulama: ${escapeHtml(result.appVersion)}<br>Bilgi paketi: ${escapeHtml(result.knowledgeVersion)}<br>Bilgi özeti: ${escapeHtml(result.knowledgeDigest)}<br>Kanonik sonuç özeti: ${escapeHtml(a.resultSha256)}</p><h2>5. İnceleme ve imza</h2><p>Hazırlayan: ____________________ &nbsp; Tarih: __________<br><br>Geoteknik inceleyen: _______________ &nbsp; Tarih: __________<br><br>Onay: _____________________________</p></section></body></html>`;
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
