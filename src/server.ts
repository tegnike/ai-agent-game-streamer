import { execSync } from "node:child_process";
import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk";
import type { Config } from "@opencode-ai/sdk";
import { OPENCODE_CONFIG } from "./config.js";
import { logger } from "./utils/logger.js";

export async function killPort(port: number): Promise<void> {
  try {
    const pidOutput = execSync(`lsof -t -i:${port} 2>/dev/null`).toString().trim();
    if (pidOutput) {
      const pids = pidOutput.split("\n").filter(Boolean);
      logger.info(`Killing existing process on port ${port} (pids: ${pids.join(", ")})`);
      for (const pid of pids) {
        try {
          execSync(`kill ${pid} 2>/dev/null`);
        } catch {
          // Process may already be dead
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {
    // No process on port
  }
}

export async function startServer(configOverride?: Config) {
  logger.info(
    `Starting OpenCode server at ${OPENCODE_CONFIG.hostname}:${OPENCODE_CONFIG.port}...`,
  );

  await killPort(OPENCODE_CONFIG.port);

  const { client } = await createOpencode({
    hostname: OPENCODE_CONFIG.hostname,
    port: OPENCODE_CONFIG.port,
    timeout: OPENCODE_CONFIG.timeout,
    config: configOverride,
  });
  logger.info("OpenCode server started");
  return client;
}

export function connectToServer() {
  const baseUrl = `http://${OPENCODE_CONFIG.hostname}:${OPENCODE_CONFIG.port}`;
  logger.info(`Connecting to existing OpenCode server at ${baseUrl}...`);
  return createOpencodeClient({ baseUrl });
}
