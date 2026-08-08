import { constants, copyFileSync, existsSync, fsyncSync, openSync, closeSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import type { GaiaProject } from "../src/domain/types.js";
import { GaiaProjectSchema } from "../src/domain/schemas.js";

const sleepSync = (milliseconds: number) => {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, milliseconds);
};

function retryRename(source: string, destination: string): void {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { renameSync(source, destination); return; } catch (error) { lastError = error; sleepSync(40 * (attempt + 1)); }
  }
  throw lastError;
}

export function readProject(path: string): GaiaProject {
  const raw = readFileSync(path, "utf8");
  if (Buffer.byteLength(raw, "utf8") > 10 * 1024 * 1024) throw new Error("Proje dosyası izin verilen boyutu aşıyor.");
  return GaiaProjectSchema.parse(JSON.parse(raw)) as GaiaProject;
}

export function writeProjectAtomic(path: string, project: GaiaProject): void {
  const checked = GaiaProjectSchema.parse(project);
  const folder = dirname(path);
  const temp = join(folder, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  const backup = `${path}.bak`;
  const json = `${JSON.stringify(checked, null, 2)}\n`;
  const descriptor = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    writeFileSync(descriptor, json, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  GaiaProjectSchema.parse(JSON.parse(readFileSync(temp, "utf8")));
  if (existsSync(path)) copyFileSync(path, backup, constants.COPYFILE_FICLONE);
  try {
    retryRename(temp, path);
  } catch (error) {
    if (existsSync(temp)) unlinkSync(temp);
    throw error;
  }
  GaiaProjectSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

