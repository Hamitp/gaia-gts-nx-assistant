import { _electron as electron } from "@playwright/test";
import { resolve } from "node:path";

const executablePath = resolve(process.argv[2] ?? "release/win-unpacked/GAIA.exe");
const application = await electron.launch({ executablePath, env: { ...process.env, NODE_ENV: "test" } });
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
  await page.getByRole("button", { name: /Doğrusal olmayan statik/i }).click();
  console.log(`PACKAGED_SMOKE_OK ${executablePath} ${JSON.stringify(boundary)}`);
} finally {
  await application.close();
}
