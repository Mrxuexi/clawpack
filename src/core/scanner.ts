import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import type { InstanceStructure, InspectResult, SensitiveFlags, RiskLevel, PackType } from "./types.js";

const OPENCLAW_DIR_NAMES = ["openclaw", "clawdbot", "moldbot", "moltbot"];
const CONFIG_FILE_NAMES = ["openclaw.json", "clawdbot.json", "moldbot.json", "moltbot.json"];

const WORKSPACE_FILES = [
  "AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md",
  "USER.md", "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md", "memory.md",
];

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
];

export function resolveStateDir(customPath?: string): string {
  if (customPath) return path.resolve(customPath);
  if (process.env.OPENCLAW_STATE_DIR) return path.resolve(process.env.OPENCLAW_STATE_DIR);

  const home = homedir();
  for (const name of OPENCLAW_DIR_NAMES) {
    const candidate = path.join(home, `.${name}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(home, ".openclaw");
}

export function findConfigFile(stateDir: string): string | null {
  if (process.env.OPENCLAW_CONFIG_PATH) {
    const p = path.resolve(process.env.OPENCLAW_CONFIG_PATH);
    return fs.existsSync(p) ? p : null;
  }
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(stateDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function listFiles(dir: string, relativeTo: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(relativeTo, fullPath);
    if (entry.isFile()) {
      results.push(relPath);
    } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...listFiles(fullPath, relativeTo));
    }
  }
  return results;
}

function scanWorkspace(stateDir: string): { files: string[]; hasWorkspace: boolean } {
  const wsDir = path.join(stateDir, "workspace");
  if (!fs.existsSync(wsDir)) return { files: [], hasWorkspace: false };

  const files: string[] = [];
  for (const name of WORKSPACE_FILES) {
    if (fs.existsSync(path.join(wsDir, name))) {
      files.push(name);
    }
  }
  // Also check for custom files in workspace
  const allFiles = listFiles(wsDir, wsDir);
  for (const f of allFiles) {
    if (!files.includes(f)) files.push(f);
  }
  return { files, hasWorkspace: true };
}

function scanSessions(stateDir: string): string[] {
  if (!fs.existsSync(stateDir)) return [];
  return fs.readdirSync(stateDir)
    .filter(f => f.startsWith("sessions-") && f.endsWith(".json5"));
}

function scanSkills(stateDir: string): string[] {
  const skillsDir = path.join(stateDir, "workspace", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function detectSensitiveContent(stateDir: string, configPath: string | null): SensitiveFlags {
  const flags: SensitiveFlags = {
    hasCredentials: false,
    hasApiKeys: false,
    hasOAuthTokens: false,
    hasSessions: false,
    hasMemoryDb: false,
  };

  // Check credentials dir
  const credDir = path.join(stateDir, "credentials");
  flags.hasCredentials = fs.existsSync(credDir);
  flags.hasOAuthTokens = fs.existsSync(path.join(credDir, "oauth.json"));

  // Check sessions
  flags.hasSessions = scanSessions(stateDir).length > 0;

  // Check memory databases
  const memoryPatterns = ["*.db", "*.sqlite", "*.lance"];
  try {
    const files = fs.readdirSync(stateDir);
    flags.hasMemoryDb = files.some(f =>
      f.endsWith(".db") || f.endsWith(".sqlite") || f.endsWith(".lance")
    );
  } catch { /* ignore */ }

  // Check config for API keys
  if (configPath && fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      flags.hasApiKeys = SENSITIVE_PATTERNS.some(p => p.test(content));
    } catch { /* ignore */ }
  }

  // Check .env file
  const envFile = path.join(stateDir, ".env");
  if (fs.existsSync(envFile)) {
    flags.hasApiKeys = true;
  }

  return flags;
}

function detectProductVersion(stateDir: string): string | null {
  // Try to find version from package.json in parent or common install locations
  const candidates = [
    path.join(stateDir, "..", "openclaw", "package.json"),
    path.join(stateDir, "version"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        if (candidate.endsWith("package.json")) {
          const pkg = JSON.parse(fs.readFileSync(candidate, "utf-8"));
          return pkg.version || null;
        }
        return fs.readFileSync(candidate, "utf-8").trim();
      } catch { /* ignore */ }
    }
  }
  return null;
}

function assessRisk(sensitive: SensitiveFlags, packType: PackType): RiskLevel {
  if (packType === "instance") {
    if (sensitive.hasCredentials || sensitive.hasOAuthTokens || sensitive.hasApiKeys) {
      return "trusted-migration-only";
    }
    return "internal-only";
  }
  // template
  if (sensitive.hasApiKeys || sensitive.hasCredentials) {
    return "internal-only";
  }
  return "safe-share";
}

export function inspect(customPath?: string): InspectResult {
  const stateDir = resolveStateDir(customPath);
  const exists = fs.existsSync(stateDir);
  const configPath = exists ? findConfigFile(stateDir) : null;
  const version = exists ? detectProductVersion(stateDir) : null;

  const workspace = exists ? scanWorkspace(stateDir) : { files: [], hasWorkspace: false };
  const sessionFiles = exists ? scanSessions(stateDir) : [];
  const skillDirs = exists ? scanSkills(stateDir) : [];
  const sensitiveFlags = exists ? detectSensitiveContent(stateDir, configPath) : {
    hasCredentials: false, hasApiKeys: false, hasOAuthTokens: false,
    hasSessions: false, hasMemoryDb: false,
  };

  const configFiles: string[] = [];
  if (configPath) configFiles.push(path.basename(configPath));

  const structure: InstanceStructure = {
    hasConfig: configPath !== null,
    hasWorkspace: workspace.hasWorkspace,
    hasSessions: sessionFiles.length > 0,
    hasMemory: sensitiveFlags.hasMemoryDb,
    hasCredentials: sensitiveFlags.hasCredentials,
    hasSkills: skillDirs.length > 0,
    workspaceFiles: workspace.files,
    configFiles,
    sessionFiles,
    skillDirs,
  };

  const warnings: string[] = [];
  if (!exists) warnings.push(`State directory not found: ${stateDir}`);
  if (!configPath && exists) warnings.push("No OpenClaw config file found");
  if (!workspace.hasWorkspace && exists) warnings.push("No workspace directory found");
  if (sensitiveFlags.hasApiKeys) warnings.push("Config contains API keys or tokens");
  if (sensitiveFlags.hasOAuthTokens) warnings.push("OAuth tokens detected in credentials/");
  if (sensitiveFlags.hasCredentials) warnings.push("Credentials directory exists");

  // Recommend pack type
  const hasSensitive = sensitiveFlags.hasCredentials || sensitiveFlags.hasOAuthTokens ||
    sensitiveFlags.hasSessions || sensitiveFlags.hasMemoryDb;
  const recommendedPackType: PackType = hasSensitive ? "instance" : "template";
  const riskAssessment = assessRisk(sensitiveFlags, recommendedPackType);

  return {
    detected: exists && (configPath !== null || workspace.hasWorkspace),
    stateDir,
    configPath,
    product: "openclaw",
    version,
    structure,
    sensitiveFlags,
    recommendedPackType,
    riskAssessment,
    warnings,
  };
}
