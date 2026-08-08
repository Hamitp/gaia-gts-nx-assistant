const { contextBridge, ipcRenderer } = require("electron");

const api = Object.freeze({
  saveProject: (project) => ipcRenderer.invoke("gaia:project:save", project),
  openProject: () => ipcRenderer.invoke("gaia:project:open"),
  exportBundle: (result) => ipcRenderer.invoke("gaia:export:bundle", result),
  importKnowledge: () => ipcRenderer.invoke("gaia:knowledge:import"),
  getKnowledge: () => ipcRenderer.invoke("gaia:knowledge:get"),
  getInstalledGtsVersion: () => ipcRenderer.invoke("gaia:gts:version"),
});

contextBridge.exposeInMainWorld("gaia", api);

