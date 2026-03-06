import { Command } from "commander";
import { exportPack } from "../core/packer.js";
import type { OutputFormat, PackType } from "../core/types.js";

export const exportCommand = new Command("export")
  .description("Export an OpenClaw instance as a ClawPack package")
  .option("-p, --path <path>", "Path to OpenClaw state directory")
  .option("-o, --output <path>", "Output file path")
  .option("-t, --type <type>", "Pack type: template or instance", "template")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action(async (opts) => {
    const format = opts.format as OutputFormat;
    const packType = opts.type as PackType;

    if (!["template", "instance"].includes(packType)) {
      const msg = `Invalid pack type: ${packType}. Must be "template" or "instance".`;
      if (format === "json") {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exitCode = 1;
      return;
    }

    try {
      const result = await exportPack({
        sourcePath: opts.path,
        outputPath: opts.output,
        packType,
      });

      if (format === "json") {
        console.log(JSON.stringify({
          success: true,
          outputFile: result.outputFile,
          packId: result.manifest.packId,
          packType: result.manifest.packType,
          riskLevel: result.manifest.riskLevel,
          fileCount: result.fileCount,
          totalSize: result.totalSize,
        }, null, 2));
      } else {
        console.log("");
        console.log("=== ClawPack Export ===");
        console.log("");
        console.log(`  Pack type:    ${result.manifest.packType}`);
        console.log(`  Pack ID:      ${result.manifest.packId}`);
        console.log(`  Risk level:   ${result.manifest.riskLevel}`);
        console.log(`  Files:        ${result.fileCount}`);
        console.log(`  Size:         ${formatSize(result.totalSize)}`);
        console.log(`  Output:       ${result.outputFile}`);
        console.log("");
        console.log("Export complete.");
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
