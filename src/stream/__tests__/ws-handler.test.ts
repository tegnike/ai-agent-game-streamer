import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventHub } from "../event-hub.js";
import { StreamManager } from "../stream-manager.js";
import { WSHandler } from "../ws-handler.js";

// Minimal WebSocket mock
function createMockWs() {
  const sent: string[] = [];
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    OPEN: 1,
    readyState: 1,
    sent,
    send(data: string) {
      sent.push(data);
    },
    ping() {},
    close() {},
    terminate() {},
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    // Helper to simulate receiving a message
    simulateMessage(data: string) {
      for (const handler of listeners["message"] ?? []) {
        handler(Buffer.from(data));
      }
    },
    simulateClose() {
      for (const handler of listeners["close"] ?? []) {
        handler();
      }
    },
  };
}

describe("WSHandler", () => {
  let hub: EventHub;
  let manager: StreamManager;
  let handler: WSHandler;
  let adminMessages: string[];

  beforeEach(() => {
    hub = new EventHub();
    manager = new StreamManager(hub);
    adminMessages = [];
    handler = new WSHandler(hub, manager, {
      onAdminMessage: (text) => { adminMessages.push(text); },
    });
    handler.start();
  });

  afterEach(() => {
    handler.stop();
  });

  describe("connection management", () => {
    it("should track connected clients", () => {
      assert.equal(handler.getClientCount(), 0);
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      assert.equal(handler.getClientCount(), 1);
    });

    it("should send full state snapshot on connect", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);

      // First message should be state:full
      assert.ok(ws.sent.length >= 1);
      const first = JSON.parse(ws.sent[0]);
      assert.equal(first.type, "state:full");
      assert.equal(first.data.phase, "idle");
    });

    it("should remove client on close", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      assert.equal(handler.getClientCount(), 1);
      ws.simulateClose();
      assert.equal(handler.getClientCount(), 0);
    });
  });

  describe("command dispatching", () => {
    it("should handle stream:start command", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      ws.simulateMessage(JSON.stringify({
        type: "stream:start",
        config: { mode: "multi" },
      }));
      assert.equal(manager.getCurrentPhase(), "starting");
    });

    it("should handle stream:stop command", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      // First start, then stop
      ws.simulateMessage(JSON.stringify({
        type: "stream:start",
        config: { mode: "single" },
      }));
      ws.simulateMessage(JSON.stringify({ type: "stream:stop" }));
      assert.equal(manager.getCurrentPhase(), "stopped");
    });

    it("should handle admin:message command", () => {
      // Set a sessionId so the message is not ignored
      hub.setSessionId("test-session");

      const ws = createMockWs();
      handler.handleConnection(ws as never);
      ws.simulateMessage(JSON.stringify({
        type: "admin:message",
        text: "Hello Agent!",
      }));
      assert.deepEqual(adminMessages, ["Hello Agent!"]);
    });

    it("should ignore admin:message when no active session", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      ws.simulateMessage(JSON.stringify({
        type: "admin:message",
        text: "Should be ignored",
      }));
      assert.deepEqual(adminMessages, []);
    });

    it("should handle game:skip command", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      ws.simulateMessage(JSON.stringify({ type: "game:skip" }));
      assert.equal(manager.isSkipRequested(), true);
    });

    it("should send error for invalid message format", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      const sentBefore = ws.sent.length;
      ws.simulateMessage("not json");
      // Should have sent an error message
      const lastMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
      assert.equal(lastMsg.type, "error");
    });
  });

  describe("event broadcasting", () => {
    it("should broadcast hub events to connected clients", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      const sentBefore = ws.sent.length;

      hub.pushActivity("text", "thinking about the move...");

      // Should have received the activity event
      const newMessages = ws.sent.slice(sentBefore);
      assert.ok(newMessages.length > 0);
      const event = JSON.parse(newMessages[0]);
      assert.equal(event.type, "agent:activity");
    });

    it("should broadcast to multiple clients", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      handler.handleConnection(ws1 as never);
      handler.handleConnection(ws2 as never);
      const sent1Before = ws1.sent.length;
      const sent2Before = ws2.sent.length;

      hub.emit("game:started", { gameId: "othello" });

      assert.ok(ws1.sent.length > sent1Before);
      assert.ok(ws2.sent.length > sent2Before);
    });
  });

  describe("cleanup", () => {
    it("should stop cleanly", () => {
      const ws = createMockWs();
      handler.handleConnection(ws as never);
      handler.stop();
      assert.equal(handler.getClientCount(), 0);
    });
  });
});
