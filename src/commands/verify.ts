import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { verify } from "../core/verifier.js";
import { printVerifyResult } from "../utils/output.js";
import { resolveStateDir } from "../core/scanner.js";
import type { Manifest, OutputFormat } from "../core/types.js";

export const verifyCommand = new Command("verify")
  .description("Verify an imported OpenClaw instance is structurally complete")
  .option("-p, --path <path>", "Path to the OpenClaw state directory to verify")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action((opts) => {
    const format = opts.format as OutputFormat;
    const targetDir = opts.path ? path.resolve(opts.path) : resolveStateDir();

    try {
      // Try to find a manifest from a recent import
      let manifest: Manifest | undefined;
      const manifestCandidates = [
        path.join(targetDir, "manifest.json"),
        path.join(targetDir, ".clawpack-manifest.json"),
      ];
      for (const candidate of manifestCandidates) {
        if (fs.existsSync(candidate)) {
          manifest = JSON.parse(fs.readFileSync(candidate, "utf-8"));
          break;
        }
      }

      const result = verify(targetDir, manifest);
      printVerifyResult(result as unknown as Record<string, unknown>, format);

      if (!result.valid) {
        process.exitCode = 1;
      }
    } catch (err) {
      if (format === "json") {
        console.log(JSON.stringify({ error: String(err) }));
      } else {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
      }
      process.exitCode = 1;
    }
  });
