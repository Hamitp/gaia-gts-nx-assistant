import { contextBridge, ipcRenderer } from "electron";
import type { CanonicalResult, GaiaDesktopApi, GaiaProject } from "../src/domain/types.js";

const api: GaiaDesktopApi = {
  saveProject: (project: GaiaProject) => ipcRenderer.invoke("gaia:project:save", project),
  openProject: () => ipcRenderer.invoke("gaia:project:open"),
  exportBundle: (result: CanonicalResult) => ipcRenderer.invoke("gaia:export:bundle", result),
  importKnowledge: () => ipcRenderer.invoke("gaia:knowledge:import"),
  getKnowledge: () => ipcRenderer.invoke("gaia:knowledge:get"),
  getInstalledGtsVersion: () => ipcRenderer.invoke("gaia:gts:version"),
};

contextBridge.exposeInMainWorld("gaia", Object.freeze(api));

