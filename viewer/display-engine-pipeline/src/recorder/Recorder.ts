/**
 * Recorder - subscribes to FileBus and writes JSONL logs
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { BusMessage, RecorderConfig } from "../protocol/types.js";
import type { FileBus } from "../filebus/FileBus.js";

export class Recorder {
  private stream: fs.WriteStream | null = null;
  private unsubscribe: (() => void) | null = null;
  private sessionId: string;
  private logPath: string;

  constructor(
    private bus: FileBus,
    private config: RecorderConfig
  ) {
    this.sessionId = this.generateSessionId();
    this.logPath = this.createLogPath();
  }

  private generateSessionId(): string {
    const prefix = this.config.sessionPrefix || "session";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${prefix}-${timestamp}`;
  }

  private createLogPath(): string {
    const dir = this.config.outputDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, `${this.sessionId}.jsonl`);
  }

  start(): void {
    if (this.stream) {
      throw new Error("Recorder already started");
    }

    this.stream = fs.createWriteStream(this.logPath, { flags: "a", encoding: "utf8" });
    this.unsubscribe = this.bus.subscribe(this.handleMessage);

    console.log(`[Recorder] Started logging to: ${this.logPath}`);
  }

  private handleMessage = (message: BusMessage): void => {
    if (!this.stream) return;

    const line = JSON.stringify(message) + "\n";
    this.stream.write(line, (err) => {
      if (err) {
        console.error("[Recorder] Write error:", err);
      }
    });

    if (this.config.autoFlush) {
      this.stream.cork();
      process.nextTick(() => this.stream?.uncork());
    }
  };

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }

      if (!this.stream) {
        resolve();
        return;
      }

      this.stream.end((err?: Error) => {
        this.stream = null;
        if (err) {
          reject(err);
        } else {
          console.log(`[Recorder] Stopped. Log: ${this.logPath}`);
          resolve();
        }
      });
    });
  }

  getLogPath(): string {
    return this.logPath;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
