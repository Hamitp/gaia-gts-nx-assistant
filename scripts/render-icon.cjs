const { app, BrowserWindow } = require("electron");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

app.whenReady().then(async () => {
  const svg = readFileSync(resolve("assets/gaia-icon.svg"), "utf8");
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { sandbox: true } });
  await window.loadURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  await new Promise((resolveReady) => setTimeout(resolveReady, 100));
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  require("node:fs").writeFileSync(resolve("assets/gaia-icon.png"), image.toPNG());
  window.destroy();
  app.quit();
});
