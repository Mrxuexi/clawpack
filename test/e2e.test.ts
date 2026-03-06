import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { inspect } from "../src/core/scanner.js";
import { exportPack, importPack } from "../src/core/packer.js";
import { verify } from "../src/core/verifier.js";

function createMockInstance(dir: string) {
  // Create minimal OpenClaw instance structure
  fs.mkdirSync(dir, { recursive: true });

  // Config file
  fs.writeFileSync(
    path.join(dir, "openclaw.json"),
    JSON.stringify({
      identity: { name: "TestBot", emoji: "🦞" },
      gateway: { port: 18789 },
    }, null, 2)
  );

  // Workspace
  const wsDir = path.join(dir, "workspace");
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, "AGENTS.md"), "# Test Agent\nYou are a helpful assistant.");
  fs.writeFileSync(path.join(wsDir, "SOUL.md"), "# Soul\nFriendly and helpful.");
  fs.writeFileSync(path.join(wsDir, "TOOLS.md"), "# Tools\n- search\n- browse");

  // Skills in workspace
  const skillDir = path.join(wsDir, "skills", "greeting");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: greeting\ndescription: Greet the user\n---\nSay hello!"
  );

  return dir;
}

function createMockInstanceWithSensitiveData(dir: string) {
  createMockInstance(dir);

  // Sessions
  fs.writeFileSync(
    path.join(dir, "sessions-agent1.json5"),
    '{ "session1": { "updatedAt": "2026-01-01" } }'
  );

  // Credentials
  const credDir = path.join(dir, "credentials");
  fs.mkdirSync(credDir, { recursive: true });
  fs.writeFileSync(
    path.join(credDir, "oauth.json"),
    '{ "token": "fake-token" }'
  );

  return dir;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawpack-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("inspect", () => {
  it("detects a valid OpenClaw instance", () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "instance"));
    const result = inspect(instanceDir);

    expect(result.detected).toBe(true);
    expect(result.product).toBe("openclaw");
    expect(result.structure.hasConfig).toBe(true);
    expect(result.structure.hasWorkspace).toBe(true);
    expect(result.structure.workspaceFiles).toContain("AGENTS.md");
    expect(result.structure.workspaceFiles).toContain("SOUL.md");
  });

  it("reports non-existent directory", () => {
    const result = inspect(path.join(tmpDir, "nonexistent"));
    expect(result.detected).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("detects sensitive content", () => {
    const instanceDir = createMockInstanceWithSensitiveData(path.join(tmpDir, "sensitive"));
    const result = inspect(instanceDir);

    expect(result.detected).toBe(true);
    expect(result.sensitiveFlags.hasCredentials).toBe(true);
    expect(result.sensitiveFlags.hasOAuthTokens).toBe(true);
    expect(result.sensitiveFlags.hasSessions).toBe(true);
    expect(result.recommendedPackType).toBe("instance");
    expect(result.riskAssessment).toBe("trusted-migration-only");
  });

  it("recommends template for clean instances", () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "clean"));
    const result = inspect(instanceDir);

    expect(result.recommendedPackType).toBe("template");
    expect(result.riskAssessment).toBe("safe-share");
  });
});

describe("export + import", () => {
  it("exports a template pack", async () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "instance"));
    const outputFile = path.join(tmpDir, "test.clawpack");

    const result = await exportPack({
      sourcePath: instanceDir,
      outputPath: outputFile,
      packType: "template",
    });

    expect(result.outputFile).toBe(outputFile);
    expect(result.manifest.packType).toBe("template");
    expect(result.manifest.riskLevel).toBe("safe-share");
    expect(result.fileCount).toBeGreaterThan(0);
    expect(fs.existsSync(outputFile)).toBe(true);
  });

  it("exports an instance pack with sensitive data", async () => {
    const instanceDir = createMockInstanceWithSensitiveData(path.join(tmpDir, "sensitive"));
    const outputFile = path.join(tmpDir, "instance.clawpack");

    const result = await exportPack({
      sourcePath: instanceDir,
      outputPath: outputFile,
      packType: "instance",
    });

    expect(result.manifest.packType).toBe("instance");
    expect(result.manifest.riskLevel).toBe("trusted-migration-only");
    expect(fs.existsSync(outputFile)).toBe(true);
  });

  it("template pack excludes sensitive files", async () => {
    const instanceDir = createMockInstanceWithSensitiveData(path.join(tmpDir, "sensitive"));
    const outputFile = path.join(tmpDir, "template.clawpack");

    const result = await exportPack({
      sourcePath: instanceDir,
      outputPath: outputFile,
      packType: "template",
    });

    // Template should not include sessions or credentials
    const paths = result.manifest.includedPaths;
    expect(paths.some(p => p.startsWith("sessions-"))).toBe(false);
    expect(paths.some(p => p.startsWith("credentials"))).toBe(false);
  });

  it("imports a pack to a new directory", async () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "source"));
    const packFile = path.join(tmpDir, "test.clawpack");
    const targetDir = path.join(tmpDir, "target");

    await exportPack({
      sourcePath: instanceDir,
      outputPath: packFile,
      packType: "template",
    });

    const importResult = await importPack({
      packFile,
      targetPath: targetDir,
    });

    expect(importResult.targetDir).toBe(targetDir);
    expect(importResult.manifest.packType).toBe("template");
    expect(fs.existsSync(path.join(targetDir, "workspace", "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "openclaw.json"))).toBe(true);
  });

  it("full round-trip: export -> import -> verify", async () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "source"));
    const packFile = path.join(tmpDir, "roundtrip.clawpack");
    const targetDir = path.join(tmpDir, "target");

    // Export
    const exportResult = await exportPack({
      sourcePath: instanceDir,
      outputPath: packFile,
      packType: "template",
    });

    // Import
    const importResult = await importPack({
      packFile,
      targetPath: targetDir,
    });

    // Verify
    const verifyResult = verify(targetDir, importResult.manifest);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.errors).toHaveLength(0);
  });
});

describe("verify", () => {
  it("passes for valid instance", () => {
    const instanceDir = createMockInstance(path.join(tmpDir, "valid"));
    const result = verify(instanceDir);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails for non-existent directory", () => {
    const result = verify(path.join(tmpDir, "nonexistent"));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("warns about missing workspace files", () => {
    const dir = path.join(tmpDir, "incomplete");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "openclaw.json"), "{}");
    const wsDir = path.join(dir, "workspace");
    fs.mkdirSync(wsDir);
    // No AGENTS.md

    const result = verify(dir);
    expect(result.warnings.some(w => w.includes("AGENTS.md"))).toBe(true);
  });
});
