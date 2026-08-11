import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";

const root = resolve(process.argv[2] ?? "artifacts/verification");
const folders = readdirSync(root).map((name) => join(root, name)).filter((path) => statSync(path).isDirectory()).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!folders.length) throw new Error("Doğrulanacak çıktı klasörü bulunamadı.");
const folder = folders[0];
const files = readdirSync(folder);
const find = (extension) => join(folder, files.find((name) => name.endsWith(extension)) ?? "");
const manifest = JSON.parse(readFileSync(find(".manifest.json"), "utf8"));
const expectedRequirements = [...manifest.requirementIds].sort();
const expectedTests = [...manifest.testIds].sort();
const expectedRawRequests = [...manifest.requirementRawRequests].map((item) => item.slice(item.indexOf("=>") + 2));
const expectedPaths = [...manifest.requirementPaths].map((item) => item.slice(item.indexOf("=>") + 2));
const expectedLimitations = [...manifest.requirementLimitations].map((item) => item.slice(item.indexOf("=>") + 2));
const modelDecisionRawRequest = "Birim sınıflandırmasını, numune kalitesini, doygunluk ve drenaj koşullarını, gerilme geçmişini ve mevcut tüm gerilme–şekil değiştirme / hacim değişimi ham eğrilerini birlikte iletin.";
const modelDecisionBoundary = "Bu bir sayısal GTS NX parametresi değildir; açık model kararını tamamlamak için kullanılan GAIA veri teslim paketidir.";
if (!expectedRawRequests.includes(modelDecisionRawRequest) || !expectedLimitations.includes(modelDecisionBoundary)) throw new Error("Kilitli model karar veri paketi dışa aktarım doğrulama örneğinde bulunmuyor.");
const ids = (content, prefix) => [...new Set(content.match(new RegExp(`${prefix}-[A-F0-9]{8}`, "g")) ?? [])].sort();
const links = (content) => [...new Set(content.match(/REQ-[A-F0-9]{8}=&gt;TST-[A-F0-9]{8}|REQ-[A-F0-9]{8}=>TST-[A-F0-9]{8}/g) ?? [])].map((item) => item.replace("=&gt;", "=>")).sort();

const docx = new AdmZip(find(".docx"));
const documentXml = docx.readAsText("word/document.xml");
const docxRequirements = ids(documentXml, "REQ");
const docxTests = ids(documentXml, "TST");
const docxLinks = links(documentXml);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(find(".xlsx"));
const workbookText = workbook.worksheets.flatMap((sheet) => sheet.getSheetValues()).flat(Infinity).map(String).join(" ");
const xlsxRequirements = ids(workbookText, "REQ");
const xlsxTests = ids(workbookText, "TST");
const xlsxLinks = links(workbookText);

const parser = new PDFParse({ data: readFileSync(find(".pdf")) });
const pdfResult = await parser.getText();
await parser.destroy();
const pdfRequirements = ids(pdfResult.text, "REQ");
const pdfTests = ids(pdfResult.text, "TST");
const pdfLinks = links(pdfResult.text);

const normalizeVisibleText = (value) => value.normalize("NFC").replace(/\s+/g, " ").trim();
const docxVisibleText = normalizeVisibleText(documentXml.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&quot;/g, '"'));
const xlsxVisibleText = normalizeVisibleText(workbookText);
const pdfVisibleText = normalizeVisibleText(pdfResult.text);

const assertEqual = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} paritesi başarısız. Beklenen ${expected.length}, bulunan ${actual.length}.`);
};
assertEqual("DOCX gereksinim", docxRequirements, expectedRequirements);
assertEqual("DOCX deney", docxTests, expectedTests);
assertEqual("XLSX gereksinim", xlsxRequirements, expectedRequirements);
assertEqual("XLSX deney", xlsxTests, expectedTests);
assertEqual("PDF gereksinim", pdfRequirements, expectedRequirements);
assertEqual("PDF deney", pdfTests, expectedTests);
assertEqual("DOCX gereksinim-deney bağı", docxLinks, [...manifest.requirementTestLinks].sort());
assertEqual("XLSX gereksinim-deney bağı", xlsxLinks, [...manifest.requirementTestLinks].sort());
assertEqual("PDF gereksinim-deney bağı", pdfLinks, [...manifest.requirementTestLinks].sort());
for (const rawRequest of expectedRawRequests) {
  const expected = normalizeVisibleText(rawRequest);
  if (!docxVisibleText.includes(expected)) throw new Error(`DOCX ham teslim talebi eksik: ${expected.slice(0, 80)}`);
  if (!xlsxVisibleText.includes(expected)) throw new Error(`XLSX ham teslim talebi eksik: ${expected.slice(0, 80)}`);
  if (!pdfVisibleText.includes(expected)) throw new Error(`PDF ham teslim talebi eksik: ${expected.slice(0, 80)}`);
}
for (const guidance of [...expectedPaths, ...expectedLimitations]) {
  const expected = normalizeVisibleText(guidance);
  if (!docxVisibleText.includes(expected)) throw new Error(`DOCX kullanım/sınırlama açıklaması eksik: ${expected.slice(0, 80)}`);
  if (!xlsxVisibleText.includes(expected)) throw new Error(`XLSX kullanım/sınırlama açıklaması eksik: ${expected.slice(0, 80)}`);
  if (!pdfVisibleText.includes(expected)) throw new Error(`PDF kullanım/sınırlama açıklaması eksik: ${expected.slice(0, 80)}`);
}
if (manifest.engineeringUseAllowed !== false) throw new Error("Review build manifesti mühendislik kullanımına yanlışlıkla izin veriyor.");
if (!documentXml.includes("İNCELEME TASLAĞI") || !pdfResult.text.includes("İNCELEME TASLAĞI") || !workbook.worksheets.some((sheet) => sheet.name.startsWith("TASLAK_"))) throw new Error("Taslak işaretleri bütün formatlarda bulunamadı.");
process.stdout.write(`PARITY_OK requirements=${expectedRequirements.length} tests=${expectedTests.length} result=${manifest.resultSha256}\n`);
