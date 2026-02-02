import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");

export const OPENCODE_CONFIG = {
  hostname: "127.0.0.1",
  port: 4096,
  timeout: 10_000,
} as const;

export const GAME_SERVER_PORT = 8888;
export const DEFAULT_MOVE_DELAY_MS = 500;
export const AGENT_NAME = "game-streamer";
