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
  await page.getByRole("button", { name: /Doğrusal olmayan statik/i }).click();
  await page.getByRole("button", { name: /Yapım aşamalı analiz/i }).click();
  await page.getByRole("button", { name: /^Dayanım azaltma yöntemi/i }).click();
  await expect(page.locator(".selection-count").getByText("3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByLabel("1. birim adı").fill("Kum Tabakası");
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Yaklaşık sabit/i }).click();
  await page.getByRole("button", { name: /Her ikisi/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  const modelContexts = page.locator(".model-context");
  for (let index = 0; index < await modelContexts.count(); index += 1) await modelContexts.nth(index).locator(".model-card").first().click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await expect(page.getByRole("heading", { name: /Tek proje. Tekrarsız/i })).toBeVisible();
  await expect(page.getByText(/parametre \/ mühendislik koşulu/i)).toBeVisible();
  await expect(page.getByText("Efektif içsel sürtünme açısı").first()).toBeVisible();
  await page.getByRole("tab", { name: /Deney programı/i }).click();
  await expect(page.locator(".test-program-table .variant-list b").filter({ hasText: /^Zorunlu$/ }).first()).toBeVisible();
  await expect(page.locator(".test-program-table .variant-list small").filter({ hasText: /^Kum Tabakası$/ }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/gaia-result.png", fullPage: true });
  await application.close();
});

test("tümü kilitli konsolidasyon modellerinde karar verisi talebiyle ilerler", async () => {
  const application = await launchGaia("e2e-locked-model-profile");
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: /Yeni proje/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /^Konsolidasyon/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByLabel("1. birim adı").fill("Kum Birimi");
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();

  const safeRoute = page.locator(".locked-model-route");
  await expect(safeRoute.getByText(/doğrulanmış seçilebilir model yok/i)).toBeVisible();
  await expect(page.locator(".model-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Karar verisi talebiyle devam et/i })).toBeVisible();

  const footer = page.locator(".wizard-footer");
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight + 1));

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2));
  const scaledFooterBox = await footer.boundingBox();
  expect(scaledFooterBox).not.toBeNull();
  expect(scaledFooterBox!.y + scaledFooterBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight + 1));
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1));

  await page.getByRole("button", { name: /Karar verisi talebiyle devam et/i }).click();
  await expect(safeRoute.getByText(/Karar verisi talebe eklendi/i)).toBeVisible();
  const nextButton = page.getByRole("button", { name: "Devam et", exact: true });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByRole("heading", { name: /Tek proje. Tekrarsız/i })).toBeVisible();
  await expect(page.locator(".result-table td").getByText("Malzeme modeli karar veri paketi", { exact: true })).toHaveCount(1);
  await page.getByRole("tab", { name: /Model kararları/i }).click();
  await expect(page.getByText(/Model kararı ertelendi; veri istenecek/i)).toBeVisible();
  await application.close();
});
