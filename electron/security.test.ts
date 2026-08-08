// @vitest-environment node
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { builtInKnowledge } from "../src/data/catalogue";
import type { KnowledgePackage } from "../src/domain/types";
import { canonicalJson, sha256, validateKnowledgePackage } from "./security";

function signedPackage() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const candidate = structuredClone(builtInKnowledge) as KnowledgePackage;
  candidate.manifest.payloadSha256 = sha256(canonicalJson(candidate.payload));
  candidate.manifest.reviewerKeyId = "reviewer-1";
  candidate.manifest.expertReview = { status: "approved", reviewer: "Dr. Test", discipline: "Geotechnical Engineering", reviewedAt: "2026-08-08T00:00:00.000Z", scope: "All catalogue rows" };
  const unsigned = { ...candidate.manifest, signature: "" };
  candidate.manifest.signature = sign(null, Buffer.from(canonicalJson({ manifest: unsigned, payload: candidate.payload })), privateKey).toString("base64");
  return { candidate, publicKey: publicKey.export({ type: "spki", format: "pem" }).toString() };
}

describe(".gaia-kb güven zinciri", () => {
  it("yerleşik bilgi paketinin manifest özeti gerçek canonical payload ile eşleşir", () => {
    expect(builtInKnowledge.manifest.payloadSha256).toBe(sha256(canonicalJson(builtInKnowledge.payload)));
  });

  it("güvenilen Ed25519 anahtarıyla geçerli paketi kabul eder", () => {
    const { candidate, publicKey } = signedPackage();
    expect(validateKnowledgePackage(candidate, { "reviewer-1": publicKey }).manifest.expertReview.status).toBe("approved");
  });

  it("self-declared approval ve bilinmeyen anahtarı reddeder", () => {
    const { candidate } = signedPackage();
    expect(() => validateKnowledgePackage(candidate, {})).toThrow(/güvenilen/i);
  });

  it("payload tek byte değiştiğinde reddeder", () => {
    const { candidate, publicKey } = signedPackage();
    candidate.payload.parameters[0].nameTr += " değişti";
    expect(() => validateKnowledgePackage(candidate, { "reviewer-1": publicKey })).toThrow(/özeti eşleşmiyor/i);
  });

  it("ASCII dışı homograph kimliğini şemada reddeder", () => {
    const { candidate, publicKey } = signedPackage();
    candidate.payload.parameters[0].id = "hoек-brown-mi";
    candidate.manifest.payloadSha256 = sha256(canonicalJson(candidate.payload));
    expect(() => validateKnowledgePackage(candidate, { "reviewer-1": publicKey })).toThrow(/ASCII|Kimlik/i);
  });
});
