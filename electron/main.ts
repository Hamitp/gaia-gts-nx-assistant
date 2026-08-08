import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { CanonicalResult, GaiaProject } from "../src/domain/types.js";
import { GaiaProjectSchema } from "../src/domain/schemas.js";
import { validateProjectReferences } from "../src/domain/validate.js";
import { buildCanonicalResult } from "../src/engine/result.js";
import { exportBundle } from "./exporters.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { readProject, writeProjectAtomic } from "./project-store.js";

const execFileAsync = promisify(execFile);
const directory = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let knowledgeStore: KnowledgeStore;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 520,
    minHeight: 320,
    backgroundColor: "#071827",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), "electron", "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed && !url.startsWith("file://")) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  if (process.env.VITE_DEV_SERVER_URL) void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void mainWindow.loadFile(join(directory, "../../dist/index.html"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

async function detectGtsVersion(): Promise<string | null> {
  const executable = "C:\\Program Files\\midas\\GTS NX\\NXGTmain.exe";
  try {
    const command = `(Get-Item -LiteralPath '${executable.replace(/'/g, "''")}').VersionInfo.FileVersion`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { timeout: 2500, windowsHide: true });
    return stdout.trim() || null;
  } catch { return null; }
}

function registerIpc(): void {
  ipcMain.handle("gaia:project:save", async (_event, raw: unknown) => {
    try {
      const project = GaiaProjectSchema.parse(raw) as GaiaProject;
      validateProjectReferences(project, knowledgeStore.get());
      const answer = await dialog.showSaveDialog(mainWindow!, { title: "GAIA projesini kaydet", defaultPath: `${project.name.replace(/[<>:"/\\|?*]/g, "-")}.gaia`, filters: [{ name: "GAIA Projesi", extensions: ["gaia"] }] });
      if (answer.canceled || !answer.filePath) return { canceled: true };
      writeProjectAtomic(answer.filePath, project);
      return { canceled: false, path: answer.filePath };
    } catch (error) { return { canceled: false, error: errorMessage(error) }; }
  });
  ipcMain.handle("gaia:project:open", async () => {
    const answer = await dialog.showOpenDialog(mainWindow!, { title: "GAIA projesini aç", properties: ["openFile"], filters: [{ name: "GAIA Projesi", extensions: ["gaia"] }] });
    if (answer.canceled || !answer.filePaths[0]) return { canceled: true };
    try { const project = readProject(answer.filePaths[0]); validateProjectReferences(project, knowledgeStore.get()); return { canceled: false, path: answer.filePaths[0], project }; }
    catch (error) { return { canceled: false, error: `Dosya açılamadı. Açık projenizde hiçbir değişiklik yapılmadı. ${errorMessage(error)}` }; }
  });
  ipcMain.handle("gaia:knowledge:get", () => knowledgeStore.get());
  ipcMain.handle("gaia:knowledge:import", async () => {
    const answer = await dialog.showOpenDialog(mainWindow!, { title: "Uzman onaylı GAIA bilgi paketini seçin", properties: ["openFile"], filters: [{ name: "GAIA Bilgi Paketi", extensions: ["gaia-kb"] }] });
    if (answer.canceled || !answer.filePaths[0]) return { canceled: true };
    try { const knowledge = knowledgeStore.import(answer.filePaths[0], await detectGtsVersion()); return { canceled: false, manifest: knowledge.manifest }; }
    catch (error) { return { canceled: false, error: `Yeni bilgi paketi doğrulanamadı. Çalışan mevcut paket korunuyor. ${errorMessage(error)}` }; }
  });
  ipcMain.handle("gaia:export:bundle", async (_event, raw: unknown) => {
    try {
      const submitted = raw as CanonicalResult;
      const project = GaiaProjectSchema.parse(submitted?.project) as GaiaProject;
      validateProjectReferences(project, knowledgeStore.get());
      const result = buildCanonicalResult(project, knowledgeStore.get());
      const answer = await dialog.showOpenDialog(mainWindow!, { title: "Talep paketinin kaydedileceği klasörü seçin", properties: ["openDirectory", "createDirectory"] });
      if (answer.canceled || !answer.filePaths[0]) return { canceled: true };
      const exported = await exportBundle(result, answer.filePaths[0]);
      return { canceled: false, ...exported };
    } catch (error) { return { canceled: false, error: `Dışa aktarım tamamlanamadı; yarım paket bırakılmadı. ${errorMessage(error)}` }; }
  });
  ipcMain.handle("gaia:gts:version", () => detectGtsVersion());
}

app.whenReady().then(() => {
  const knowledgeDirectory = join(app.getPath("userData"), "knowledge");
  mkdirSync(knowledgeDirectory, { recursive: true });
  knowledgeStore = new KnowledgeStore(knowledgeDirectory);
  if (process.env.GAIA_SAMPLE_EXPORT_DIR) {
    void import("./sample-export.js").then(({ runSampleExport }) => runSampleExport(process.env.GAIA_SAMPLE_EXPORT_DIR!)).then(() => app.quit()).catch((error) => { const message = error instanceof Error ? error.stack ?? error.message : errorMessage(error); writeFileSync(join(process.env.GAIA_SAMPLE_EXPORT_DIR!, "sample-error.log"), message, "utf8"); process.stderr.write(`${message}\n`); app.exit(1); });
    return;
  }
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [process.env.VITE_DEV_SERVER_URL ? "default-src 'self' http://127.0.0.1:5173; script-src 'self' http://127.0.0.1:5173; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173; img-src 'self' data:" : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'"] } }));
  registerIpc();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (!process.env.GAIA_SAMPLE_EXPORT_DIR && process.platform !== "darwin") app.quit(); });
