import "dotenv/config";
import { startServer, connectToServer } from "./server.js";
import { GameOrchestrator } from "./game-orchestrator.js";
import { GAME_REGISTRY, getRandomGame } from "./games/game-registry.js";
import { logger } from "./utils/logger.js";
import { buildModelConfig, STREAM_SERVER_PORT, GAME_SERVER_PORT, OPENCODE_CONFIG, NARRATION_SERVER_PORT } from "./config.js";
import type { GameId } from "./types.js";
import type { ReasoningEffort } from "./stream/types.js";
import { EventHub } from "./stream/event-hub.js";
import { StreamManager } from "./stream/stream-manager.js";
import { StreamServer } from "./stream/stream-server.js";
import { BrowserManager } from "./utils/browser-manager.js";
import { LLMConfigManager } from "./stream/llm-config-manager.js";
import { NarrationRelayServer } from "./narration/narration-relay-server.js";
import { NarrationEventBridge } from "./narration/narration-event-bridge.js";
import type { OpencodeClient } from "@opencode-ai/sdk";

function parseArg(args: string[], prefix: string): string | undefined {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg?.split("=")[1];
}

async function main() {
  const args = process.argv.slice(2);
  const loopMode = args.includes("--loop");
  const connectMode = args.includes("--connect");
  const adminMode = args.includes("--admin");

  // Enable debug logging with --debug flag
  if (args.includes("--debug")) {
    process.env.DEBUG = "1";
  }

  const gameArg = parseArg(args, "--game=");
  const providerName = parseArg(args, "--provider=");
  const modelName = parseArg(args, "--model=");
  const reasoningEffort = parseArg(args, "--reasoning-effort=");
  const adminPortArg = parseArg(args, "--admin-port=");
  const narrationPortArg = parseArg(args, "--narration-port=");
  const visualEndpoint = parseArg(args, "--visual-endpoint=");
  const visualInterval = parseArg(args, "--visual-interval=");

  // Initialize LLM config manager
  const llmConfigManager = new LLMConfigManager();
  llmConfigManager.initialize(providerName, modelName, reasoningEffort);

  const validEfforts = ["low", "medium", "high"] as const;
  const effort: ReasoningEffort | undefined =
    reasoningEffort && validEfforts.includes(reasoningEffort as ReasoningEffort)
      ? (reasoningEffort as ReasoningEffort)
      : undefined;

  const modelConfig = buildModelConfig(providerName, modelName, effort);
  if (modelConfig) {
    logger.info(`Using model: ${modelConfig.model}`);
  }

  // Start or connect to OpenCode server
  // Use ref pattern to allow hot-swapping the client on LLM restart
  const clientRef: { current: OpencodeClient } = {
    current: connectMode
      ? connectToServer()
      : await startServer(modelConfig),
  };

  // Verify connection
  const configResult = await clientRef.current.config.get();
  logger.info("Server connected:", configResult.data ? "OK" : "FAILED");

  // Initialize EventHub + StreamManager if admin mode
  let eventHub: EventHub | undefined;
  let streamManager: StreamManager | undefined;
  let streamServer: StreamServer | undefined;
  let narrationRelay: NarrationRelayServer | undefined;
  let narrationBridge: NarrationEventBridge | undefined;

  if (adminMode) {
    eventHub = new EventHub();
    streamManager = new StreamManager(eventHub);

    const port = adminPortArg
      ? parseInt(adminPortArg, 10)
      : parseInt(process.env.STREAM_PORT ?? "", 10) || STREAM_SERVER_PORT;

    const browserManager = new BrowserManager();
    const orchestratorRef = { current: null as GameOrchestrator | null };

    // Comment ingester + adapters (lazy-initialized on connect)
    type _CommentIngester = import("./stream/comment-ingester.js").CommentIngester;
    type _YouTubeAdapter = import("./stream/comments/youtube-adapter.js").YouTubeAdapter;
    type _OneCommeAdapter = import("./stream/comments/onecomme-adapter.js").OneCommeAdapter;
    type _VisualBridge = import("./stream/visual-bridge.js").VisualBridge;

    let commentIngester: _CommentIngester | null = null;
    let youtubeAdapter: _YouTubeAdapter | null = null;
    let onecommeAdapter: _OneCommeAdapter | null = null;
    let visualBridge: _VisualBridge | null = null;

    const ensureIngester = async () => {
      if (!commentIngester) {
        const { CommentIngester } = await import("./stream/comment-ingester.js");
        commentIngester = new CommentIngester(eventHub!);
        await commentIngester.start();
      }
      return commentIngester;
    };

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
        const comment = eventHub!.updateCommentStatus(commentId, "queued");
        if (comment) {
          const sessionMgr = orchestratorRef.current?.getSessionManager();
          if (sessionMgr) {
            sessionMgr
              .injectMessage(`[視聴者コメント] ${comment.authorName}: "${comment.text}"`)
              .then(() => eventHub!.updateCommentStatus(commentId, "answered"))
              .catch((err) => logger.error("Failed to inject comment:", err));
          }
        }
      },
      onCommentDismiss: (commentId) => {
        eventHub!.updateCommentStatus(commentId, "dismissed");
      },
      onYouTubeConnect: async (config) => {
        try {
          const { YouTubeAdapter } = await import("./stream/comments/youtube-adapter.js");
          youtubeAdapter = new YouTubeAdapter();
          await youtubeAdapter.connect(config);
          const ingester = await ensureIngester();
          ingester.addAdapter(youtubeAdapter);
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      onYouTubeDisconnect: async () => {
        if (youtubeAdapter) {
          commentIngester?.removeAdapter("youtube");
          await youtubeAdapter.disconnect();
          youtubeAdapter = null;
        }
      },
      onOneCommeConnect: async (config) => {
        try {
          const { OneCommeAdapter } = await import("./stream/comments/onecomme-adapter.js");
          onecommeAdapter = new OneCommeAdapter();
          await onecommeAdapter.connect(config);
          const ingester = await ensureIngester();
          ingester.addAdapter(onecommeAdapter);
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      onOneCommeDisconnect: async () => {
        if (onecommeAdapter) {
          commentIngester?.removeAdapter("onecomme");
          await onecommeAdapter.disconnect();
          onecommeAdapter = null;
        }
      },
      onVisualConfigure: async (config) => {
        // Stop existing bridge if any
        visualBridge?.stop();
        const { VisualBridge } = await import("./stream/visual-bridge.js");
        visualBridge = new VisualBridge(eventHub!, config);
        visualBridge.start();
      },
      onBrowserLaunch: async () => {
        try {
          const lobbyUrl = `http://127.0.0.1:${GAME_SERVER_PORT}/index.html`;
          // Ensure HTTP server is running first
          const pm = orchestratorRef.current?.getProcessManager();
          if (pm && !pm.isRunning()) {
            await pm.startPersistentServer(GAME_SERVER_PORT);
          }
          await browserManager.launchDaemon(lobbyUrl);
          eventHub!.setBrowserState(browserManager.getState());
          eventHub!.emit("browser:launched");
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      onBrowserLaunchCDP: async (port) => {
        try {
          await browserManager.connectCDP(port);
          eventHub!.setBrowserState(browserManager.getState());
          eventHub!.emit("browser:launched");
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      onBrowserClose: async () => {
        await browserManager.close();
        eventHub!.setBrowserState(browserManager.getState());
        eventHub!.emit("browser:closed");
      },
      llmConfigManager,
      onLLMRestart: async () => {
        try {
          logger.info("Restarting OpenCode server with new LLM config...");

          // Apply pending config
          const newConfig = llmConfigManager.applyPendingConfig();
          if (!newConfig) {
            return { success: false, error: "No pending config to apply" };
          }

          // Start new server with new config (startServer handles killing existing process)
          clientRef.current = await startServer(newConfig);

          // Update orchestrator with new client
          if (orchestratorRef.current) {
            orchestratorRef.current.updateClient(clientRef.current);
          }

          logger.info(`LLM restarted with model: ${newConfig.model}`);
          return { success: true };
        } catch (err) {
          logger.error("Failed to restart LLM:", err);
          return { success: false, error: String(err) };
        }
      },
    });

    await streamServer.start();

    const narrationPort = narrationPortArg
      ? parseInt(narrationPortArg, 10)
      : parseInt(process.env.NARRATION_PORT ?? "", 10) || NARRATION_SERVER_PORT;
    narrationRelay = new NarrationRelayServer(narrationPort);
    await narrationRelay.start();
    narrationBridge = new NarrationEventBridge(eventHub, narrationRelay);
    narrationBridge.start();

    const orchestrator = new GameOrchestrator(clientRef.current, eventHub, browserManager);
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

    // Setup graceful shutdown (guard against double invocation)
    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info("Shutting down...");
      streamManager!.transition("stopped");
      orchestrator.getEventMonitor().stopMonitoring();
      narrationBridge?.stop();
      await narrationRelay?.stop();
      await browserManager.close();
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
        logger.info("Received stream:started event, launching managed stream...");
        try {
          await orchestrator.startManagedStream();
          logger.info("Managed stream completed normally");
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
    const orchestrator = new GameOrchestrator(clientRef.current);

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
