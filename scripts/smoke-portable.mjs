import { chromium } from "@playwright/test";
import { rmSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const executablePath = resolve(process.argv[2] ?? "release/GAIA-Portable-0.1.0-review.3-x64.exe");
const userDataDir = resolve("test-results", `portable-smoke-${Date.now()}`);
rmSync(userDataDir, { recursive: true, force: true });

const port = await new Promise((resolvePort, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("Boş CDP portu bulunamadı."));
    server.close(() => resolvePort(address.port));
  });
});

const launcher = spawn(executablePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`], { detached: false, stdio: "ignore", windowsHide: true });
let browser;
let page;
try {
  const endpoint = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) { ready = true; break; }
    } catch { /* portable paket çıkarılırken bağlantı henüz hazır değildir */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  if (!ready) throw new Error("Taşınabilir GAIA CDP uç noktası 30 saniye içinde açılmadı.");

  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  page = context.pages().find((candidate) => candidate.url().startsWith("file:")) ?? context.pages()[0];
  await page.waitForLoadState("domcontentloaded");
  const boundary = await page.evaluate(async () => {
    const api = globalThis.gaia;
    const knowledge = api ? await api.getKnowledge() : null;
    return { gaia: Boolean(api), requireType: typeof globalThis.require, processType: typeof globalThis.process, payloadDigest: knowledge?.manifest?.payloadSha256 };
  });
  if (!boundary.gaia || boundary.requireType !== "undefined" || boundary.processType !== "undefined") throw new Error(`Taşınabilir renderer güven sınırı başarısız: ${JSON.stringify(boundary)}`);

  await page.getByRole("button", { name: /Yeni proje/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Zamana bağlı oturma/i }).click();
  await page.getByRole("button", { name: /Konsolidasyon ve oturma süresi/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.locator("select").first().selectOption("sand");
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Devam et/i }).click();
  await page.getByRole("button", { name: /Karar için veri iste/i }).click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  if (await page.getByTestId("geotechnical-work-order").getByText("Malzeme modeli karar veri paketi", { exact: true }).count() !== 1) throw new Error("Taşınabilir paket kilitli model yolunu doğru sonuçlandıramadı.");
  console.log(`PORTABLE_SMOKE_OK ${executablePath} ${JSON.stringify(boundary)}`);
} finally {
  if (page && !page.isClosed()) await page.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  if (!launcher.killed) launcher.kill();
}
