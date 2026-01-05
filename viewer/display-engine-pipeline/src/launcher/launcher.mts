#!/usr/bin/env node
/**
 * Launcher - CLI entry point for wiring Display ↔ Engine
 * Modes: demo, dev, test
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import type { LauncherConfig } from "../protocol/types.js";
import { RuntimeContext } from "./RuntimeContext.js";

interface CliArgs {
  mode: "demo" | "dev" | "test";
  config?: string;
  scenario?: string;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", short: "m", default: "demo" },
      config: { type: "string", short: "c" },
      scenario: { type: "string", short: "s" },
    },
  });

  const mode = values.mode as CliArgs["mode"];
  if (!["demo", "dev", "test"].includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Use demo, dev, or test.`);
  }

  return {
    mode,
    config: values.config,
    scenario: values.scenario,
  };
}

function loadConfig(args: CliArgs): LauncherConfig {
  let config: Partial<LauncherConfig> = {
    mode: args.mode,
  };

  // Load config file if provided
  if (args.config) {
    if (!fs.existsSync(args.config)) {
      throw new Error(`Config file not found: ${args.config}`);
    }
    const fileConfig = JSON.parse(fs.readFileSync(args.config, "utf8"));
    config = { ...config, ...fileConfig };
  }

  // Override with CLI args
  if (args.scenario) {
    config.testScenario = args.scenario;
  }

  // Apply mode-specific defaults
  if (args.mode === "demo") {
    config.engineAdapter = config.engineAdapter || { mode: "embedded" };
  } else if (args.mode === "dev") {
    config.engineAdapter = config.engineAdapter || { mode: "embedded" };
    config.recorder = config.recorder || {
      outputDir: "./logs",
      sessionPrefix: "dev-session",
      autoFlush: true,
    };
  } else if (args.mode === "test") {
    config.engineAdapter = config.engineAdapter || { mode: "embedded" };
    if (!config.testScenario) {
      throw new Error("Test mode requires --scenario argument");
    }
  }

  return config as LauncherConfig;
}

function printConfig(config: LauncherConfig): void {
  console.log("\n=== Launcher Configuration ===");
  console.log(`Mode: ${config.mode}`);
  console.log(`Engine: ${config.engineAdapter.mode}`);
  if (config.engineAdapter.mode === "http") {
    console.log(`  Endpoint: ${config.engineAdapter.httpEndpoint}`);
  }
  if (config.recorder) {
    console.log(`Recorder: enabled`);
    console.log(`  Output: ${config.recorder.outputDir}`);
  }
  if (config.testScenario) {
    console.log(`Test scenario: ${config.testScenario}`);
  }
  console.log("==============================\n");
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const config = loadConfig(args);
  printConfig(config);

  const ctx = new RuntimeContext(config);

  // Handle shutdown gracefully
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[Launcher] Received ${signal}, shutting down...`);
    await ctx.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await ctx.initialize();

    if (config.mode === "test") {
      // Run test and exit
      const exitCode = await ctx.runTest();
      await ctx.shutdown();
      process.exit(exitCode);
    } else {
      // Demo/dev mode: keep running
      console.log(`[Launcher] Running in ${config.mode} mode. Press Ctrl+C to stop.`);
      
      // In real implementation, you would start a web server here
      // For now, just keep the process alive
      await new Promise(() => {}); // infinite wait
    }
  } catch (err) {
    console.error("[Launcher] Fatal error:", err);
    await ctx.shutdown();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Launcher] Unhandled error:", err);
  process.exit(1);
});
