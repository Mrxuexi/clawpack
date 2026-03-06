export const SCHEMA_VERSION = "0.1.0";

export type PackType = "template" | "instance";

export type RiskLevel = "safe-share" | "internal-only" | "trusted-migration-only";

export type OutputFormat = "text" | "json";

export interface Manifest {
  schemaVersion: string;
  packType: PackType;
  packId: string;
  createdAt: string;
  source: {
    product: string;
    version: string;
    configPath: string;
  };
  includedPaths: string[];
  sensitiveFlags: SensitiveFlags;
  riskLevel: RiskLevel;
}

export interface SensitiveFlags {
  hasCredentials: boolean;
  hasApiKeys: boolean;
  hasOAuthTokens: boolean;
  hasSessions: boolean;
  hasMemoryDb: boolean;
}

export interface InspectResult {
  detected: boolean;
  stateDir: string;
  configPath: string | null;
  product: string;
  version: string | null;
  structure: InstanceStructure;
  sensitiveFlags: SensitiveFlags;
  recommendedPackType: PackType;
  riskAssessment: RiskLevel;
  warnings: string[];
}

export interface InstanceStructure {
  hasConfig: boolean;
  hasWorkspace: boolean;
  hasSessions: boolean;
  hasMemory: boolean;
  hasCredentials: boolean;
  hasSkills: boolean;
  workspaceFiles: string[];
  configFiles: string[];
  sessionFiles: string[];
  skillDirs: string[];
}

export interface VerifyResult {
  valid: boolean;
  checks: VerifyCheck[];
  warnings: string[];
  errors: string[];
}

export interface VerifyCheck {
  name: string;
  passed: boolean;
  message: string;
}
