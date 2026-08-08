import { createHash, verify } from "node:crypto";
import type { KnowledgePackage } from "../src/domain/types.js";
import { KnowledgePackageSchema, assertKnowledgeReferences } from "../src/domain/schemas.js";

export const MAX_KNOWLEDGE_BYTES = 25 * 1024 * 1024;

/** Production releases add independently reviewed public keys here. Keeping the
 * list empty is deliberate: no self-declared package can become "approved". */
export const TRUSTED_REVIEWER_KEYS: Readonly<Record<string, string>> = Object.freeze({});
export const CURRENT_APP_VERSION = "0.1.0";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function versionMatches(version: string, min: string, max: string): boolean {
  const parts = (value: string) => value.split(".").map((part) => part.toLowerCase() === "x" ? Number.POSITIVE_INFINITY : Number.parseInt(part, 10) || 0);
  const compare = (left: number[], right: number[]) => {
    for (let index = 0; index < 3; index += 1) { const delta = (left[index] ?? 0) - (right[index] ?? 0); if (delta) return delta; }
    return 0;
  };
  const actual = parts(version);
  const lower = parts(min);
  const upper = parts(max);
  if (max.toLowerCase().includes("x")) {
    const fixed = max.toLowerCase().split(".").findIndex((part) => part === "x");
    for (let index = 0; index < fixed; index += 1) if (actual[index] !== upper[index]) return false;
    return compare(actual, lower) >= 0;
  }
  return compare(actual, lower) >= 0 && compare(actual, upper) <= 0;
}

export function validateKnowledgePackage(raw: unknown, trustedKeys: Readonly<Record<string, string>> = TRUSTED_REVIEWER_KEYS, compatibility: { appVersion?: string; gtsVersion?: string | null } = {}): KnowledgePackage {
  const parsed = KnowledgePackageSchema.parse(raw);
  assertKnowledgeReferences(parsed);
  const appVersion = compatibility.appVersion ?? CURRENT_APP_VERSION;
  if (!versionMatches(appVersion, parsed.manifest.compatibleApp.min, parsed.manifest.compatibleApp.max)) throw new Error(`Bilgi paketi GAIA ${appVersion} ile uyumlu değil.`);
  if (compatibility.gtsVersion && !versionMatches(compatibility.gtsVersion, parsed.manifest.compatibleGts.min, parsed.manifest.compatibleGts.max)) throw new Error(`Bilgi paketi kurulu GTS NX ${compatibility.gtsVersion} sürümüyle uyumlu değil.`);
  if (parsed.manifest.expertReview.status !== "approved") throw new Error("Yalnız bağımsız uzman tarafından onaylanmış bilgi paketleri içe aktarılabilir.");
  const payloadDigest = sha256(canonicalJson(parsed.payload));
  if (payloadDigest !== parsed.manifest.payloadSha256) throw new Error("Bilgi paketi özeti eşleşmiyor; içerik değiştirilmiş olabilir.");
  const publicKey = trustedKeys[parsed.manifest.reviewerKeyId];
  if (!publicKey) throw new Error("Bilgi paketi güvenilen bir bağımsız uzman anahtarıyla imzalanmamış.");
  const unsignedManifest = { ...parsed.manifest, signature: "" };
  const signedData = Buffer.from(canonicalJson({ manifest: unsignedManifest, payload: parsed.payload }), "utf8");
  let signature: Buffer;
  try { signature = Buffer.from(parsed.manifest.signature, "base64"); } catch { throw new Error("Bilgi paketi imza biçimi geçersiz."); }
  if (!verify(null, signedData, publicKey, signature)) throw new Error("Bilgi paketi Ed25519 imzası doğrulanamadı.");
  return parsed as KnowledgePackage;
}
