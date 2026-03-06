import { Command } from "commander";
import { inspect } from "../core/scanner.js";
import { printInspectResult } from "../utils/output.js";
import type { OutputFormat } from "../core/types.js";

export const inspectCommand = new Command("inspect")
  .description("Inspect an OpenClaw instance and report its structure and risks")
  .option("-p, --path <path>", "Path to OpenClaw state directory")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action((opts) => {
    const format = opts.format as OutputFormat;
    try {
      const result = inspect(opts.path);
      printInspectResult(result as unknown as Record<string, unknown>, format);
      if (!result.detected) {
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
