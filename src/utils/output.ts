import type { OutputFormat } from "../core/types.js";

export function formatOutput(data: unknown, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatText(data);
}

function formatText(data: unknown, indent = 0): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);

  if (Array.isArray(data)) {
    if (data.length === 0) return "(none)";
    return data.map(item => {
      if (typeof item === "string") return `${"  ".repeat(indent)}- ${item}`;
      return formatText(item, indent + 1);
    }).join("\n");
  }

  if (typeof data === "object") {
    return formatObject(data as Record<string, unknown>, indent);
  }

  return String(data);
}

function formatObject(obj: Record<string, unknown>, indent = 0): string {
  const lines: string[] = [];
  const pad = "  ".repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    const label = humanizeKey(key);

    if (typeof value === "boolean") {
      lines.push(`${pad}${label}: ${value ? "yes" : "no"}`);
    } else if (typeof value === "string" || typeof value === "number") {
      lines.push(`${pad}${label}: ${value}`);
    } else if (value === null || value === undefined) {
      lines.push(`${pad}${label}: -`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${label}: (none)`);
      } else if (typeof value[0] === "string") {
        lines.push(`${pad}${label}:`);
        for (const item of value) {
          lines.push(`${pad}  - ${item}`);
        }
      } else {
        lines.push(`${pad}${label}:`);
        lines.push(formatText(value, indent + 1));
      }
    } else if (typeof value === "object") {
      lines.push(`${pad}${label}:`);
      lines.push(formatObject(value as Record<string, unknown>, indent + 1));
    }
  }

  return lines.join("\n");
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\s/, "")
    .split(" ")
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase())
    .join(" ");
}

export function printInspectResult(result: Record<string, unknown>, format: OutputFormat): void {
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const r = result as any;
  console.log("");
  console.log("=== ClawPack Inspect ===");
  console.log("");
  console.log(`  Detected:     ${r.detected ? "yes" : "no"}`);
  console.log(`  State dir:    ${r.stateDir}`);
  console.log(`  Config:       ${r.configPath || "(none)"}`);
  console.log(`  Product:      ${r.product}`);
  console.log(`  Version:      ${r.version || "unknown"}`);
  console.log("");
  console.log("--- Structure ---");
  console.log(`  Config:       ${r.structure.hasConfig ? "found" : "missing"}`);
  console.log(`  Workspace:    ${r.structure.hasWorkspace ? "found" : "missing"}`);
  console.log(`  Sessions:     ${r.structure.hasSessions ? `found (${r.structure.sessionFiles.length} files)` : "none"}`);
  console.log(`  Memory DB:    ${r.structure.hasMemory ? "found" : "none"}`);
  console.log(`  Credentials:  ${r.structure.hasCredentials ? "found" : "none"}`);
  console.log(`  Skills:       ${r.structure.hasSkills ? `found (${r.structure.skillDirs.length} dirs)` : "none"}`);

  if (r.structure.workspaceFiles.length > 0) {
    console.log("");
    console.log("--- Workspace files ---");
    for (const f of r.structure.workspaceFiles.slice(0, 20)) {
      console.log(`  - ${f}`);
    }
    if (r.structure.workspaceFiles.length > 20) {
      console.log(`  ... and ${r.structure.workspaceFiles.length - 20} more`);
    }
  }

  console.log("");
  console.log("--- Sensitive flags ---");
  console.log(`  API keys:     ${r.sensitiveFlags.hasApiKeys ? "detected" : "none"}`);
  console.log(`  Credentials:  ${r.sensitiveFlags.hasCredentials ? "detected" : "none"}`);
  console.log(`  OAuth tokens: ${r.sensitiveFlags.hasOAuthTokens ? "detected" : "none"}`);
  console.log(`  Sessions:     ${r.sensitiveFlags.hasSessions ? "detected" : "none"}`);
  console.log(`  Memory DB:    ${r.sensitiveFlags.hasMemoryDb ? "detected" : "none"}`);

  console.log("");
  console.log("--- Recommendation ---");
  console.log(`  Pack type:    ${r.recommendedPackType}`);
  console.log(`  Risk level:   ${r.riskAssessment}`);

  if (r.warnings.length > 0) {
    console.log("");
    console.log("--- Warnings ---");
    for (const w of r.warnings) {
      console.log(`  ! ${w}`);
    }
  }
  console.log("");
}

export function printVerifyResult(result: Record<string, unknown>, format: OutputFormat): void {
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const r = result as any;
  console.log("");
  console.log("=== ClawPack Verify ===");
  console.log("");
  console.log(`  Valid: ${r.valid ? "YES" : "NO"}`);
  console.log("");

  if (r.checks.length > 0) {
    console.log("--- Checks ---");
    for (const check of r.checks) {
      const icon = check.passed ? "+" : "-";
      console.log(`  [${icon}] ${check.message}`);
    }
  }

  if (r.warnings.length > 0) {
    console.log("");
    console.log("--- Warnings ---");
    for (const w of r.warnings) {
      console.log(`  ! ${w}`);
    }
  }

  if (r.errors.length > 0) {
    console.log("");
    console.log("--- Errors ---");
    for (const e of r.errors) {
      console.log(`  X ${e}`);
    }
  }
  console.log("");
}
