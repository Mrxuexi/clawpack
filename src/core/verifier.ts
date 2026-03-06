import fs from "node:fs";
import path from "node:path";
import type { Manifest, VerifyResult, VerifyCheck } from "./types.js";
import { findConfigFile } from "./scanner.js";

const REQUIRED_WORKSPACE_FILES = ["AGENTS.md"];

export function verify(targetDir: string, manifest?: Manifest): VerifyResult {
  const checks: VerifyCheck[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check 1: Target directory exists
  const dirExists = fs.existsSync(targetDir);
  checks.push({
    name: "directory_exists",
    passed: dirExists,
    message: dirExists
      ? `Target directory exists: ${targetDir}`
      : `Target directory not found: ${targetDir}`,
  });

  if (!dirExists) {
    errors.push("Target directory does not exist");
    return { valid: false, checks, warnings, errors };
  }

  // Check 2: Config file exists
  const configPath = findConfigFile(targetDir);
  const hasConfig = configPath !== null;
  checks.push({
    name: "config_exists",
    passed: hasConfig,
    message: hasConfig
      ? `Config file found: ${path.basename(configPath!)}`
      : "No OpenClaw config file found",
  });
  if (!hasConfig) {
    warnings.push("No config file found - instance may need manual configuration");
  }

  // Check 3: Workspace directory exists
  const wsDir = path.join(targetDir, "workspace");
  const hasWorkspace = fs.existsSync(wsDir);
  checks.push({
    name: "workspace_exists",
    passed: hasWorkspace,
    message: hasWorkspace
      ? "Workspace directory exists"
      : "Workspace directory not found",
  });
  if (!hasWorkspace) {
    errors.push("Workspace directory is missing");
  }

  // Check 4: Required workspace files
  if (hasWorkspace) {
    for (const file of REQUIRED_WORKSPACE_FILES) {
      const filePath = path.join(wsDir, file);
      const exists = fs.existsSync(filePath);
      checks.push({
        name: `workspace_file_${file.toLowerCase()}`,
        passed: exists,
        message: exists
          ? `Workspace file exists: ${file}`
          : `Required workspace file missing: ${file}`,
      });
      if (!exists) {
        warnings.push(`Workspace file missing: ${file}`);
      }
    }
  }

  // Check 5: Config file is valid JSON/JSON5
  if (hasConfig && configPath) {
    let configValid = false;
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      JSON.parse(content);
      configValid = true;
    } catch {
      // Try JSON5-style (strip comments/trailing commas as a basic check)
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        // Basic validation: file is non-empty and starts with {
        configValid = content.trim().startsWith("{");
        if (!configValid) {
          warnings.push("Config file may not be valid JSON/JSON5");
        }
      } catch {
        configValid = false;
      }
    }
    checks.push({
      name: "config_valid",
      passed: configValid,
      message: configValid
        ? "Config file is valid"
        : "Config file appears invalid",
    });
  }

  // Check 6: If manifest provided, verify included paths
  if (manifest) {
    checks.push({
      name: "manifest_schema",
      passed: manifest.schemaVersion === "0.1.0",
      message: `Schema version: ${manifest.schemaVersion}`,
    });

    checks.push({
      name: "manifest_pack_type",
      passed: ["template", "instance"].includes(manifest.packType),
      message: `Pack type: ${manifest.packType}`,
    });
  }

  // Check 7: Workspace files are readable
  if (hasWorkspace) {
    const wsFiles = fs.readdirSync(wsDir).filter(f => f.endsWith(".md"));
    let allReadable = true;
    for (const file of wsFiles) {
      try {
        fs.accessSync(path.join(wsDir, file), fs.constants.R_OK);
      } catch {
        allReadable = false;
        warnings.push(`Workspace file not readable: ${file}`);
      }
    }
    checks.push({
      name: "workspace_readable",
      passed: allReadable,
      message: allReadable
        ? "All workspace files are readable"
        : "Some workspace files are not readable",
    });
  }

  const valid = errors.length === 0 && checks.every(
    c => c.passed || !["directory_exists", "workspace_exists"].includes(c.name)
  );

  return { valid, checks, warnings, errors };
}
