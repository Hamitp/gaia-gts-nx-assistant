import { _electron as electron } from "@playwright/test";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const executablePath = resolve(process.argv[2] ?? "release/win-unpacked/GAIA.exe");
const userDataDir = resolve("test-results", `packaged-smoke-${Date.now()}`);
rmSync(userDataDir, { recursive: true, force: true });
const application = await electron.launch({ executablePath, args: [`--user-data-dir=${userDataDir}`], env: { ...process.env, NODE_ENV: "test" } });
try {
  const page = await application.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const boundary = await page.evaluate(async () => {
    const api = globalThis.gaia;
    if (!api) return { gaia: false, requireType: typeof globalThis.require, processType: typeof globalThis.process };
    const knowledge = await api.getKnowledge();
    const gtsVersion = await api.getInstalledGtsVersion();
    return {
      gaia: true,
      requireType: typeof globalThis.require,
      processType: typeof globalThis.process,
      packageId: knowledge?.manifest?.packageId,
      payloadDigest: knowledge?.manifest?.payloadSha256,
      gtsVersionType: gtsVersion === null ? "null" : typeof gtsVersion,
    };
  });
  if (!boundary.gaia) throw new Error(`Preload API yüklenmedi: ${JSON.stringify(boundary)}`);
  if (boundary.requireType !== "undefined" || boundary.processType !== "undefined") throw new Error(`Renderer güven sınırı ihlal edildi: ${JSON.stringify(boundary)}`);
  if (boundary.packageId !== "gaia-built-in-review") throw new Error(`Beklenmeyen bilgi paketi: ${JSON.stringify(boundary)}`);
  if (!/^[a-f0-9]{64}$/.test(boundary.payloadDigest ?? "")) throw new Error(`Bilgi özeti geçersiz: ${JSON.stringify(boundary)}`);
  await page.getByRole("button", { name: /Yeni proje/i }).click();
  await page.getByRole("textbox", { name: /^Proje adı/i }).fill("Paketli EXE doğrulaması");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Zamana bağlı oturma/i }).click();
  await page.getByRole("button", { name: /Konsolidasyon ve oturma süresi/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByLabel("1. birim adı").fill("Kum Birimi");
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  const safeAction = page.getByRole("button", { name: /Karar için veri iste/i });
  if (!await safeAction.isVisible()) throw new Error("Kilitli model bağlamında güvenli ilerleme eylemi görünmüyor.");
  if (await page.locator(".simple-model-card").count()) throw new Error("Kilitli model bağlamında seçilebilir model kartı gösterildi.");
  const footer = page.locator(".wizard-footer");
  const footerBox = await footer.boundingBox();
  const innerHeight = await page.evaluate(() => window.innerHeight);
  if (!footerBox || footerBox.y + footerBox.height > innerHeight + 1) throw new Error("Sihirbaz alt gezinmesi görünür alan dışında.");
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2));
  const scaledFooterBox = await footer.boundingBox();
  const scaledInnerHeight = await page.evaluate(() => window.innerHeight);
  if (!scaledFooterBox || scaledFooterBox.y + scaledFooterBox.height > scaledInnerHeight + 1) throw new Error("%200 ölçekte sihirbaz alt gezinmesi görünür alan dışında.");
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1));
  await safeAction.click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  const modelDecisionRequests = page.getByTestId("geotechnical-work-order").getByText("Malzeme modeli karar veri paketi", { exact: true });
  if (await modelDecisionRequests.count() !== 1) throw new Error("Kilitli model yolu tam bir adet model karar veri talebi üretmedi.");
  console.log(`PACKAGED_SMOKE_OK ${executablePath} ${JSON.stringify(boundary)}`);
} finally {
  await application.close();
}
