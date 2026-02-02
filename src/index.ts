import { startServer, connectToServer } from "./server.js";
import { GameOrchestrator } from "./game-orchestrator.js";
import { GAME_REGISTRY, getRandomGame } from "./games/game-registry.js";
import { logger } from "./utils/logger.js";
import type { GameId } from "./types.js";

async function main() {
  const args = process.argv.slice(2);
  const loopMode = args.includes("--loop");
  const connectMode = args.includes("--connect");
  const gameArg = args.find((a) => a.startsWith("--game="));

  // Start or connect to OpenCode server
  const client = connectMode ? connectToServer() : await startServer();

  // Verify connection
  const configResult = await client.config.get();
  logger.info("Server connected:", configResult.data ? "OK" : "FAILED");

  const orchestrator = new GameOrchestrator(client);

  if (loopMode) {
    await orchestrator.startStreamingLoop();
  } else if (gameArg) {
    const gameId = gameArg.split("=")[1] as GameId;
    if (!GAME_REGISTRY[gameId]) {
      logger.error(`Unknown game: ${gameId}`);
      logger.info(`Available: ${Object.keys(GAME_REGISTRY).join(", ")}`);
      process.exit(1);
    }
    await orchestrator.playSingleGame(gameId);
  } else {
    const game = getRandomGame();
    await orchestrator.playSingleGame(game.id);
  }

  logger.info("Done.");
  process.exit(0);
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
