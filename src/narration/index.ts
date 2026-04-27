import "dotenv/config";
import { NARRATION_SERVER_PORT } from "../config.js";
import { logger } from "../utils/logger.js";
import { NarrationRelayServer } from "./narration-relay-server.js";

function parseArg(args: string[], prefix: string): string | undefined {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg?.split("=")[1];
}

async function main(): Promise<void> {
  const portArg = parseArg(process.argv.slice(2), "--port=");
  const port = portArg
    ? parseInt(portArg, 10)
    : parseInt(process.env.NARRATION_PORT ?? "", 10) || NARRATION_SERVER_PORT;

  const relay = new NarrationRelayServer(port);
  await relay.start();

  const shutdown = async () => {
    logger.info("Shutting down narration relay...");
    await relay.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise(() => {});
}

main().catch((error) => {
  logger.error("Narration relay fatal error:", error);
  process.exit(1);
});
