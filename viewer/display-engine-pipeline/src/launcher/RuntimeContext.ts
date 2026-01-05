/**
 * RuntimeContext - wiring helper for Launcher
 * Connects Display → DisplayAdapter → FileBus → EngineAdapter → NGIN
 */

import type { LauncherConfig } from "../protocol/types.js";
import { DisplayPublicApi } from "../display-adapter/DisplayPublicApi.js";
import { DisplayAdapter } from "../display-adapter/DisplayAdapter.js";
import { FileBus } from "../filebus/FileBus.js";
import { EngineAdapter } from "../engine-adapter/EngineAdapter.js";
import { Recorder } from "../recorder/Recorder.js";
import { Player } from "../recorder/Player.js";

export class RuntimeContext {
  displayApi: DisplayPublicApi;
  bus: FileBus;
  displayAdapter: DisplayAdapter | null = null;
  engineAdapter: EngineAdapter | null = null;
  recorder: Recorder | null = null;
  player: Player | null = null;

  constructor(private config: LauncherConfig) {
    this.displayApi = new DisplayPublicApi();
    this.bus = new FileBus(config.fileBus || { name: "main" });
  }

  async initialize(): Promise<void> {
    console.log(`[RuntimeContext] Initializing in ${this.config.mode} mode...`);

    // Always create DisplayAdapter (except in test mode without UI)
    if (this.config.mode !== "test") {
      this.displayAdapter = new DisplayAdapter(this.displayApi, this.bus);
    }

    // Create EngineAdapter
    this.engineAdapter = new EngineAdapter(this.bus, this.config.engineAdapter);
    this.engineAdapter.start();

    // Create Recorder in dev mode
    if (this.config.mode === "dev" && this.config.recorder) {
      this.recorder = new Recorder(this.bus, this.config.recorder);
      this.recorder.start();
    }

    // Create Player in test mode
    if (this.config.mode === "test" && this.config.testScenario) {
      this.player = new Player(this.bus, {
        scenarioPath: this.config.testScenario,
        realtimeDelay: false,
        speedMultiplier: 1.0,
      });
    }

    console.log("[RuntimeContext] Initialized successfully");
  }

  async shutdown(): Promise<void> {
    console.log("[RuntimeContext] Shutting down...");

    if (this.displayAdapter) {
      this.displayAdapter.detach();
    }

    if (this.engineAdapter) {
      this.engineAdapter.stop();
    }

    if (this.recorder) {
      await this.recorder.stop();
    }

    this.bus.clear();
    console.log("[RuntimeContext] Shutdown complete");
  }

  async runTest(): Promise<number> {
    if (!this.player) {
      throw new Error("Player not initialized for test mode");
    }

    console.log("[RuntimeContext] Running test scenario...");
    const stats = await this.player.play();

    // Simple success criteria: no errors
    const exitCode = stats.errors === 0 ? 0 : 1;
    console.log(`[RuntimeContext] Test ${exitCode === 0 ? "PASSED" : "FAILED"}`);

    return exitCode;
  }
}
