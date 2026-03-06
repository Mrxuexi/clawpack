import { Command } from "commander";
import { importPack } from "../core/packer.js";
import type { OutputFormat } from "../core/types.js";

export const importCommand = new Command("import")
  .description("Import a ClawPack package into a target environment")
  .argument("<file>", "Path to the .clawpack file")
  .option("-t, --target <path>", "Target directory (defaults to ~/.openclaw)")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action(async (file, opts) => {
    const format = opts.format as OutputFormat;

    try {
      const result = await importPack({
        packFile: file,
        targetPath: opts.target,
      });

      if (format === "json") {
        console.log(JSON.stringify({
          success: true,
          targetDir: result.targetDir,
          packId: result.manifest.packId,
          packType: result.manifest.packType,
          riskLevel: result.manifest.riskLevel,
          fileCount: result.fileCount,
          warnings: result.warnings,
        }, null, 2));
      } else {
        console.log("");
        console.log("=== ClawPack Import ===");
        console.log("");
        console.log(`  Pack type:    ${result.manifest.packType}`);
        console.log(`  Pack ID:      ${result.manifest.packId}`);
        console.log(`  Risk level:   ${result.manifest.riskLevel}`);
        console.log(`  Files:        ${result.fileCount}`);
        console.log(`  Target:       ${result.targetDir}`);

        if (result.warnings.length > 0) {
          console.log("");
          console.log("--- Warnings ---");
          for (const w of result.warnings) {
            console.log(`  ! ${w}`);
          }
        }

        console.log("");
        console.log("Import complete. Run `clawpack verify` to check the result.");
        console.log("");
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
