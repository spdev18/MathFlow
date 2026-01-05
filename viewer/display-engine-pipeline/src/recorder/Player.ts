/**
 * Player - replays JSONL scenarios through FileBus (for testing)
 */

import * as fs from "node:fs";
import * as readline from "node:readline";
import type { BusMessage } from "../protocol/types.js";
import { isBusMessage } from "../protocol/guards.js";
import type { FileBus } from "../filebus/FileBus.js";

export interface PlayerConfig {
  scenarioPath: string;
  realtimeDelay?: boolean; // if true, respect original timestamps
  speedMultiplier?: number; // 1.0 = normal, 2.0 = 2x speed
}

export interface PlayerStats {
  totalMessages: number;
  clientEvents: number;
  engineRequests: number;
  engineResponses: number;
  errors: number;
}

export class Player {
  private stats: PlayerStats = {
    totalMessages: 0,
    clientEvents: 0,
    engineRequests: 0,
    engineResponses: 0,
    errors: 0,
  };

  constructor(
    private bus: FileBus,
    private config: PlayerConfig
  ) {}

  async play(): Promise<PlayerStats> {
    const { scenarioPath } = this.config;

    if (!fs.existsSync(scenarioPath)) {
      throw new Error(`Scenario file not found: ${scenarioPath}`);
    }

    const messages = await this.loadMessages(scenarioPath);
    console.log(`[Player] Loaded ${messages.length} messages from ${scenarioPath}`);

    await this.replayMessages(messages);

    console.log(`[Player] Replay complete. Stats:`, this.stats);
    return this.stats;
  }

  private async loadMessages(filePath: string): Promise<BusMessage[]> {
    const messages: BusMessage[] = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      try {
        const obj = JSON.parse(trimmed);
        if (isBusMessage(obj)) {
          messages.push(obj);
        } else {
          console.warn(`[Player] Invalid message shape, skipping line`);
          this.stats.errors++;
        }
      } catch (err) {
        console.warn(`[Player] JSON parse error, skipping line:`, err);
        this.stats.errors++;
      }
    }

    return messages;
  }

  private async replayMessages(messages: BusMessage[]): Promise<void> {
    if (messages.length === 0) return;

    let prevTimestamp = messages[0].timestamp;

    for (const msg of messages) {
      this.stats.totalMessages++;

      // Handle timing
      if (this.config.realtimeDelay && prevTimestamp) {
        const delay = msg.timestamp - prevTimestamp;
        const adjustedDelay = delay / (this.config.speedMultiplier || 1.0);
        if (adjustedDelay > 0) {
          await this.sleep(adjustedDelay);
        }
      }
      prevTimestamp = msg.timestamp;

      // Publish message
      try {
        this.publishMessage(msg);
      } catch (err) {
        console.error(`[Player] Error publishing message:`, err);
        this.stats.errors++;
      }
    }
  }

  private publishMessage(msg: BusMessage): void {
    switch (msg.messageType) {
      case "ClientEvent":
        this.stats.clientEvents++;
        this.bus.publishClientEvent(msg.payload as any);
        break;
      case "EngineRequest":
        this.stats.engineRequests++;
        this.bus.publishEngineRequest(msg.payload as any);
        break;
      case "EngineResponse":
        this.stats.engineResponses++;
        this.bus.publishEngineResponse(msg.payload as any);
        break;
      default:
        console.warn(`[Player] Unknown message type: ${msg.messageType}`);
        this.stats.errors++;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats(): PlayerStats {
    return { ...this.stats };
  }
}
