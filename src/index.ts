import { startServer, connectToServer } from "./server.js";
import { GameOrchestrator } from "./game-orchestrator.js";
import { GAME_REGISTRY, getRandomGame } from "./games/game-registry.js";
import { logger } from "./utils/logger.js";
import { buildModelConfig, STREAM_SERVER_PORT } from "./config.js";
import type { GameId } from "./types.js";
import { EventHub } from "./stream/event-hub.js";
import { StreamManager } from "./stream/stream-manager.js";
import { StreamServer } from "./stream/stream-server.js";

function parseArg(args: string[], prefix: string): string | undefined {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg?.split("=")[1];
}

async function main() {
  const args = process.argv.slice(2);
  const loopMode = args.includes("--loop");
  const connectMode = args.includes("--connect");
  const adminMode = args.includes("--admin");

  const gameArg = parseArg(args, "--game=");
  const providerName = parseArg(args, "--provider=");
  const modelName = parseArg(args, "--model=");
  const adminPortArg = parseArg(args, "--admin-port=");
  const visualEndpoint = parseArg(args, "--visual-endpoint=");
  const visualInterval = parseArg(args, "--visual-interval=");

  const modelConfig = buildModelConfig(providerName, modelName);
  if (modelConfig) {
    logger.info(`Using model: ${modelConfig.model}`);
  }

  // Start or connect to OpenCode server
  const client = connectMode
    ? connectToServer()
    : await startServer(modelConfig);

  // Verify connection
  const configResult = await client.config.get();
  logger.info("Server connected:", configResult.data ? "OK" : "FAILED");

  // Initialize EventHub + StreamManager if admin mode
  let eventHub: EventHub | undefined;
  let streamManager: StreamManager | undefined;
  let streamServer: StreamServer | undefined;

  if (adminMode) {
    eventHub = new EventHub();
    streamManager = new StreamManager(eventHub);

    const port = adminPortArg
      ? parseInt(adminPortArg, 10)
      : parseInt(process.env.STREAM_PORT ?? "", 10) || STREAM_SERVER_PORT;

    const orchestratorRef = { current: null as GameOrchestrator | null };

    // Comment ingester + YouTube adapter (lazy-initialized on connect)
    type _CommentIngester = import("./stream/comment-ingester.js").CommentIngester;
    type _YouTubeAdapter = import("./stream/comments/youtube-adapter.js").YouTubeAdapter;
    type _VisualBridge = import("./stream/visual-bridge.js").VisualBridge;

    let commentIngester: _CommentIngester | null = null;
    let youtubeAdapter: _YouTubeAdapter | null = null;
    let visualBridge: _VisualBridge | null = null;

    streamServer = new StreamServer(eventHub, streamManager, {
      port,
      onAdminMessage: async (text) => {
        const sessionMgr = orchestratorRef.current?.getSessionManager();
        if (sessionMgr) {
          eventHub!.emit("admin:message", { text });
          await sessionMgr.injectMessage(`[管理者メッセージ] ${text}`);
        }
      },
      onCommentQueue: (commentId) => {
        eventHub!.updateCommentStatus(commentId, "queued");
      },
      onCommentDismiss: (commentId) => {
        eventHub!.updateCommentStatus(commentId, "dismissed");
      },
      onYouTubeConnect: async (config) => {
        try {
          const { YouTubeAdapter } = await import("./stream/comments/youtube-adapter.js");
          const { CommentIngester } = await import("./stream/comment-ingester.js");
          youtubeAdapter = new YouTubeAdapter();
          await youtubeAdapter.connect(config);
          commentIngester = new CommentIngester(eventHub!);
          commentIngester.addAdapter(youtubeAdapter);
          await commentIngester.start();
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      onYouTubeDisconnect: async () => {
        commentIngester?.stop();
        commentIngester = null;
        if (youtubeAdapter) {
          await youtubeAdapter.disconnect();
          youtubeAdapter = null;
        }
      },
      onVisualConfigure: async (config) => {
        // Stop existing bridge if any
        visualBridge?.stop();
        const { VisualBridge } = await import("./stream/visual-bridge.js");
        visualBridge = new VisualBridge(eventHub!, config);
        visualBridge.start();
      },
    });

    await streamServer.start();

    const orchestrator = new GameOrchestrator(client, eventHub);
    orchestrator.setStreamManager(streamManager);
    orchestratorRef.current = orchestrator;

    // Setup visual bridge if endpoint specified
    if (visualEndpoint) {
      const { VisualBridge } = await import("./stream/visual-bridge.js");
      const bridge = new VisualBridge(eventHub, {
        endpoint: visualEndpoint,
        batchInterval: visualInterval ? parseInt(visualInterval, 10) : undefined,
      });
      bridge.start();
    }

    // Setup graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      streamManager!.transition("stopped");
      orchestrator.getEventMonitor().stopMonitoring();
      await orchestrator.getProcessManager().stopGameServer();
      await streamServer!.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    if (loopMode) {
      // Wait for admin to start stream via UI/API
      // The stream will be started when StreamManager transitions to "starting"
      logger.info("Admin mode active. Waiting for stream commands...");
      logger.info(`Admin UI: http://localhost:${port}`);
      logger.info(`REST API: http://localhost:${port}/api/status`);

      // Listen for stream start events
      eventHub.on("stream:started", async () => {
        try {
          await orchestrator.startManagedStream();
        } catch (error) {
          logger.error("Managed stream error:", error);
          streamManager!.transition("stopped");
        }
      });

      // Keep process alive
      await new Promise(() => {});
    } else if (gameArg) {
      const gameId = gameArg as GameId;
      if (!GAME_REGISTRY[gameId]) {
        logger.error(`Unknown game: ${gameId}`);
        logger.info(`Available: ${Object.keys(GAME_REGISTRY).join(", ")}`);
        process.exit(1);
      }
      streamManager.configure({ mode: "single", selectedGames: [gameId] });
      streamManager.transition("starting");
      await orchestrator.startManagedStream();
    } else {
      const game = getRandomGame();
      streamManager.configure({ mode: "single", selectedGames: [game.id] });
      streamManager.transition("starting");
      await orchestrator.startManagedStream();
    }
  } else {
    // Non-admin mode: original behavior
    const orchestrator = new GameOrchestrator(client);

    if (loopMode) {
      await orchestrator.startStreamingLoop();
    } else if (gameArg) {
      const gameId = gameArg as GameId;
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
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
