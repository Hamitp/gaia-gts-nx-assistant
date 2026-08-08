import { copyFileSync, existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { KnowledgePackage } from "../src/domain/types.js";
import { builtInKnowledge } from "../src/data/catalogue.js";
import { MAX_KNOWLEDGE_BYTES, validateKnowledgePackage } from "./security.js";

export class KnowledgeStore {
  private readonly activePath: string;
  private active: KnowledgePackage = builtInKnowledge;

  constructor(private readonly directory: string) {
    this.activePath = join(directory, "active.gaia-kb");
    if (existsSync(this.activePath)) {
      try { this.active = validateKnowledgePackage(JSON.parse(readFileSync(this.activePath, "utf8"))); } catch { this.active = builtInKnowledge; }
    }
  }

  get(): KnowledgePackage { return structuredClone(this.active); }

  import(path: string, gtsVersion?: string | null): KnowledgePackage {
    if (statSync(path).size > MAX_KNOWLEDGE_BYTES) throw new Error("Bilgi paketi 25 MB sınırını aşıyor.");
    const bytesBefore = existsSync(this.activePath) ? readFileSync(this.activePath) : null;
    const candidate = validateKnowledgePackage(JSON.parse(readFileSync(path, "utf8")), undefined, { gtsVersion });
    const stage = join(this.directory, `knowledge-${process.pid}-${Date.now()}.tmp`);
    const backup = `${this.activePath}.bak`;
    writeFileSync(stage, `${JSON.stringify(candidate, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      validateKnowledgePackage(JSON.parse(readFileSync(stage, "utf8")));
      if (existsSync(this.activePath)) copyFileSync(this.activePath, backup);
      renameSync(stage, this.activePath);
      this.active = candidate;
      return this.get();
    } catch (error) {
      if (existsSync(stage)) unlinkSync(stage);
      if (bytesBefore && existsSync(this.activePath) && !readFileSync(this.activePath).equals(bytesBefore)) writeFileSync(this.activePath, bytesBefore);
      throw error;
    }
  }
}
