import { _electron as electron, expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function launchGaia(profileName: string) {
  const userDataDir = path.resolve("test-results", profileName);
  fs.rmSync(userDataDir, { recursive: true, force: true });
  return electron.launch({ args: [".", "--force-device-scale-factor=1", `--user-data-dir=${userDataDir}`], cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" } });
}

test("yeni projeden tekrarsız sonuç ekranına kesintisiz ilerler", async () => {
  const application = await launchGaia("e2e-normal-model-profile");
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("heading", { name: /Zemini doğru anlamak/i })).toBeVisible();
  await expect(page.locator(".gaia-hero")).toBeVisible();
  await expect.poll(() => page.locator(".gaia-hero").evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe("none");
  await page.screenshot({ path: "test-results/gaia-landing.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2));
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator(".landing-visual")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /Yeni proje/i }).click();
  await page.getByRole("textbox", { name: /^Proje adı/i }).fill("E2E Liman Projesi");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Gerçekçi kalıcı deformasyon/i }).click();
  await page.getByRole("button", { name: /Kazı ve yapım sırası/i }).click();
  await page.getByRole("button", { name: /Yapım aşamalarını sırayla incele/i }).click();
  await page.getByRole("button", { name: /Göçme ve stabilite güvenliği/i }).click();
  await page.getByRole("button", { name: /Güvenlik katsayısını doğrudan bul/i }).click();
  await expect(page.locator(".selection-count").getByText("3", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/gaia-analyses.png", fullPage: true });
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByLabel("1. birim adı").fill("Kum Tabakası");
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Yaklaşık sabit/i }).click();
  await page.getByRole("button", { name: /Her ikisi/i }).click();
  const constructionToggle = page.getByRole("checkbox", { name: /Yapım aşamaları/i });
  const constructionToggleCard = page.locator("label.toggle-card").filter({ hasText: "Yapım aşamaları" });
  await expect(constructionToggle).toBeChecked();
  await constructionToggleCard.click();
  await expect(constructionToggle).not.toBeChecked();
  await constructionToggleCard.click();
  await expect(constructionToggle).toBeChecked();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await expect(page.getByText(/0 \/ 3/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/gaia-models.png", fullPage: true });
  for (let index = 0; index < 3; index += 1) {
    const openDecision = page.locator(".model-decision.open");
    await expect(openDecision).toHaveCount(1);
    await openDecision.locator(".simple-model-card").first().click();
  }
  await expect(page.getByText(/3 \/ 3/)).toBeVisible();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await expect(page.getByRole("heading", { name: /Uzman incelemesi için tekrarsız/i })).toBeVisible();
  await expect(page.getByTestId("geotechnical-work-order")).toBeVisible();
  await expect(page.getByText(/parametre \/ mühendislik koşulu/i)).toBeVisible();
  await expect(page.getByText("Efektif içsel sürtünme açısı").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/gaia-work-order.png", fullPage: true });
  const exportRoot = path.resolve("test-results", "interactive-export");
  fs.rmSync(exportRoot, { recursive: true, force: true });
  fs.mkdirSync(exportRoot, { recursive: true });
  await application.evaluate(({ dialog, shell }, destination) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [destination] });
    shell.showItemInFolder = () => undefined;
  }, exportRoot);
  await page.getByRole("button", { name: /Taslak DOCX, PDF ve Excel oluştur/i }).click();
  await expect(page.getByRole("status")).toContainText(/DOCX, PDF ve Excel hazır/i);
  await expect.poll(() => {
    const folders = fs.readdirSync(exportRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    return folders.length === 1 ? fs.readdirSync(path.join(exportRoot, folders[0].name)).length : 0;
  }).toBe(4);
  await page.getByRole("tab", { name: /Deney matrisi/i }).click();
  await expect(page.locator(".test-program-table .variant-list small").filter({ hasText: /Mutlaka gerekli: Kum Tabakası/i }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/gaia-result.png", fullPage: true });
  await application.close();
});

test("tümü kilitli konsolidasyon modellerinde karar verisi talebiyle ilerler", async () => {
  const application = await launchGaia("e2e-locked-model-profile");
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: /Yeni proje/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Zamana bağlı oturma/i }).click();
  await page.getByRole("button", { name: /Konsolidasyon ve oturma süresi/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByLabel("1. birim adı").fill("Kum Birimi");
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();

  const safeRoute = page.locator(".model-data-route").last();
  await expect(safeRoute.getByText(/Henüz güvenli model kararı veremiyorum/i)).toBeVisible();
  await expect(page.locator(".simple-model-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Karar için veri iste/i })).toBeVisible();

  const footer = page.locator(".wizard-footer");
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight + 1));

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2));
  const scaledFooterBox = await footer.boundingBox();
  expect(scaledFooterBox).not.toBeNull();
  expect(scaledFooterBox!.y + scaledFooterBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight + 1));
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1));

  await page.getByRole("button", { name: /Karar için veri iste/i }).click();
  await expect(page.getByText(/Model seçilmedi; karar verileri talebe eklendi/i)).toBeVisible();
  const nextButton = page.getByRole("button", { name: "Devam et", exact: true });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByRole("heading", { name: /Uzman incelemesi için tekrarsız/i })).toBeVisible();
  await expect(page.getByTestId("geotechnical-work-order").getByText("Malzeme modeli karar veri paketi", { exact: true })).toHaveCount(1);
  await page.getByRole("tab", { name: /Model kararları/i }).click();
  await expect(page.getByText(/Model seçilmedi; karar verisi istendi/i)).toBeVisible();
  await application.close();
});
