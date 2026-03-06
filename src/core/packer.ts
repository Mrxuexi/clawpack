import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import type { Manifest, PackType, SensitiveFlags, RiskLevel } from "./types.js";
import { SCHEMA_VERSION } from "./types.js";
import { inspect, resolveStateDir, findConfigFile } from "./scanner.js";

// Files/dirs to exclude from template packs
const TEMPLATE_EXCLUDES = [
  "credentials",
  "oauth.json",
  "sessions-*.json5",
  "*.db",
  "*.sqlite",
  "*.lance",
  ".env",
];

// Files/dirs to always exclude (security)
const ALWAYS_EXCLUDE = [
  "*.log",
  ".git",
  "node_modules",
];

function generatePackId(): string {
  return crypto.randomUUID();
}

function assessRisk(sensitive: SensitiveFlags, packType: PackType): RiskLevel {
  if (packType === "instance") {
    if (sensitive.hasCredentials || sensitive.hasOAuthTokens || sensitive.hasApiKeys) {
      return "trusted-migration-only";
    }
    return "internal-only";
  }
  if (sensitive.hasApiKeys || sensitive.hasCredentials) {
    return "internal-only";
  }
  return "safe-share";
}

function shouldExclude(relativePath: string, packType: PackType): boolean {
  const basename = path.basename(relativePath);

  for (const pattern of ALWAYS_EXCLUDE) {
    if (matchGlob(basename, pattern)) return true;
  }

  if (packType === "template") {
    for (const pattern of TEMPLATE_EXCLUDES) {
      if (matchGlob(basename, pattern) || matchGlob(relativePath, pattern)) {
        return true;
      }
    }
  }

  return false;
}

function matchGlob(str: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
  );
  return regex.test(str);
}

function collectFiles(
  dir: string,
  relativeTo: string,
  packType: PackType
): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(relativeTo, fullPath);

      if (shouldExclude(relPath, packType)) continue;

      if (entry.isFile()) {
        results.push(relPath);
      } else if (entry.isDirectory()) {
        walk(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

interface ExportOptions {
  sourcePath?: string;
  outputPath?: string;
  packType: PackType;
}

interface ExportResult {
  outputFile: string;
  manifest: Manifest;
  fileCount: number;
  totalSize: number;
}

export async function exportPack(options: ExportOptions): Promise<ExportResult> {
  const stateDir = resolveStateDir(options.sourcePath);
  if (!fs.existsSync(stateDir)) {
    throw new Error(`OpenClaw state directory not found: ${stateDir}`);
  }

  const inspectResult = inspect(options.sourcePath);
  if (!inspectResult.detected) {
    throw new Error("No OpenClaw instance detected at the specified path");
  }

  const packType = options.packType;
  const includedPaths = collectFiles(stateDir, stateDir, packType);

  if (includedPaths.length === 0) {
    throw new Error("No files to export");
  }

  const configPath = findConfigFile(stateDir);
  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    packType,
    packId: generatePackId(),
    createdAt: new Date().toISOString(),
    source: {
      product: "openclaw",
      version: inspectResult.version || "unknown",
      configPath: configPath ? path.relative(stateDir, configPath) : "",
    },
    includedPaths,
    sensitiveFlags: inspectResult.sensitiveFlags,
    riskLevel: assessRisk(inspectResult.sensitiveFlags, packType),
  };

  // Create staging directory
  const stagingDir = path.join(stateDir, ".clawpack-staging");
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    // Write manifest
    fs.writeFileSync(
      path.join(stagingDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    // Create pack directory structure
    const packDirs = ["config", "workspace", "reports"];
    if (packType === "instance") packDirs.push("state");

    for (const dir of packDirs) {
      fs.mkdirSync(path.join(stagingDir, dir), { recursive: true });
    }

    // Copy files into pack structure
    let totalSize = 0;
    for (const relPath of includedPaths) {
      const srcFile = path.join(stateDir, relPath);
      let destDir: string;

      if (relPath.startsWith("workspace")) {
        destDir = path.join(stagingDir, "workspace");
        const subPath = path.relative("workspace", relPath);
        const destFile = path.join(destDir, subPath);
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(srcFile, destFile);
      } else if (relPath.endsWith(".json") || relPath.endsWith(".json5") || relPath === ".env") {
        if (relPath.startsWith("sessions-")) {
          destDir = path.join(stagingDir, "state");
        } else {
          destDir = path.join(stagingDir, "config");
        }
        const destFile = path.join(destDir, path.basename(relPath));
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(srcFile, destFile);
      } else if (relPath.startsWith("credentials")) {
        destDir = path.join(stagingDir, "state", "credentials");
        fs.mkdirSync(destDir, { recursive: true });
        const destFile = path.join(destDir, path.basename(relPath));
        fs.copyFileSync(srcFile, destFile);
      } else {
        // Other files go to state/
        destDir = path.join(stagingDir, "state");
        const destFile = path.join(destDir, relPath);
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(srcFile, destFile);
      }

      totalSize += fs.statSync(srcFile).size;
    }

    // Write export report
    const report = {
      exportedAt: manifest.createdAt,
      packType,
      packId: manifest.packId,
      fileCount: includedPaths.length,
      totalSize,
      riskLevel: manifest.riskLevel,
      sensitiveFlags: manifest.sensitiveFlags,
    };
    fs.writeFileSync(
      path.join(stagingDir, "reports", "export-report.json"),
      JSON.stringify(report, null, 2)
    );

    // Determine output path
    const outputFile = options.outputPath ||
      path.join(process.cwd(), `openclaw-${packType}-${Date.now()}.clawpack`);

    // Create tar.gz archive
    await tar.create(
      {
        gzip: true,
        file: outputFile,
        cwd: stagingDir,
      },
      fs.readdirSync(stagingDir)
    );

    return { outputFile, manifest, fileCount: includedPaths.length, totalSize };
  } finally {
    // Cleanup staging
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

interface ImportOptions {
  packFile: string;
  targetPath?: string;
}

interface ImportResult {
  targetDir: string;
  manifest: Manifest;
  fileCount: number;
  warnings: string[];
}

export async function importPack(options: ImportOptions): Promise<ImportResult> {
  const packFile = path.resolve(options.packFile);
  if (!fs.existsSync(packFile)) {
    throw new Error(`Pack file not found: ${packFile}`);
  }

  // Extract to temp directory first
  const tempDir = path.join(
    path.dirname(packFile),
    `.clawpack-import-${Date.now()}`
  );
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await tar.extract({ file: packFile, cwd: tempDir });

    // Read manifest
    const manifestPath = path.join(tempDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("Invalid ClawPack: manifest.json not found");
    }

    const manifest: Manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );

    // Determine target directory
    const targetDir = options.targetPath
      ? path.resolve(options.targetPath)
      : resolveStateDir();

    const warnings: string[] = [];

    if (manifest.riskLevel === "trusted-migration-only") {
      warnings.push(
        "This is a trusted-migration-only pack. It may contain sensitive data."
      );
    }

    // Check if target already exists
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      warnings.push(
        `Target directory ${targetDir} is not empty. Files may be overwritten.`
      );
    }

    fs.mkdirSync(targetDir, { recursive: true });

    // Restore workspace
    const wsSource = path.join(tempDir, "workspace");
    if (fs.existsSync(wsSource)) {
      copyDirRecursive(wsSource, path.join(targetDir, "workspace"));
    }

    // Restore config
    const configSource = path.join(tempDir, "config");
    if (fs.existsSync(configSource)) {
      const configFiles = fs.readdirSync(configSource);
      for (const file of configFiles) {
        fs.copyFileSync(
          path.join(configSource, file),
          path.join(targetDir, file)
        );
      }
    }

    // Restore state (instance packs only)
    const stateSource = path.join(tempDir, "state");
    if (fs.existsSync(stateSource)) {
      const stateEntries = fs.readdirSync(stateSource, { withFileTypes: true });
      for (const entry of stateEntries) {
        const src = path.join(stateSource, entry.name);
        const dest = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(src, dest);
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Count imported files
    let fileCount = 0;
    function countFiles(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile()) fileCount++;
        else if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
      }
    }
    countFiles(targetDir);

    return { targetDir, manifest, fileCount, warnings };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
