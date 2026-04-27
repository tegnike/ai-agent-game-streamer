import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer, type WebSocket } from "ws";
import { NarrationClientAdapter } from "../narration-client-adapter.js";

interface TestRelay {
  server: Server;
  wss: WebSocketServer;
  url: string;
  messages: unknown[];
  close: () => Promise<void>;
}

async function startRelay(
  onMessage: (ws: WebSocket, message: Record<string, unknown>) => void,
): Promise<TestRelay> {
  const server = createServer();
  const wss = new WebSocketServer({ server, path: "/ws/narration" });
  const messages: unknown[] = [];

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      messages.push(message);
      onMessage(ws, message);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    server,
    wss,
    url: `ws://127.0.0.1:${address.port}/ws/narration`,
    messages,
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("NarrationClientAdapter", () => {
  let relay: TestRelay | null;
  let adapter: NarrationClientAdapter | null;

  beforeEach(() => {
    relay = null;
    adapter = null;
  });

  afterEach(async () => {
    await adapter?.close();
    await relay?.close();
  });

  it("should send producer hello and resolve completed statuses", async () => {
    relay = await startRelay((ws, message) => {
      if (message.type === "narration:say") {
        ws.send(JSON.stringify({
          type: "narration:completed",
          id: message.id,
          durationMs: 120,
          timestamp: Date.now(),
        }));
      }
    });

    const busyStates: boolean[] = [];
    adapter = new NarrationClientAdapter({
      url: relay.url,
      clientName: "test-producer",
    });
    adapter.onBusyChange((busy) => busyStates.push(busy));

    await adapter.connect();
    const result = await adapter.say({
      text: "Hello narration.",
      speaker: "nike",
      emotion: "happy",
      metadata: { source: "test" },
    });

    assert.equal(result.type, "narration:completed");
    assert.deepEqual(busyStates, [true, false]);
    assert.equal(adapter.isBusy(), false);

    const [hello, say] = relay.messages as Array<Record<string, unknown>>;
    assert.equal(hello.type, "narration:hello");
    assert.equal(hello.role, "producer");
    assert.equal(hello.clientName, "test-producer");
    assert.equal(say.type, "narration:say");
    assert.equal(say.text, "Hello narration.");
    assert.equal(say.speaker, "nike");
    assert.equal(say.emotion, "happy");
  });

  it("should keep busy true until all pending utterances settle", async () => {
    const sockets: WebSocket[] = [];
    relay = await startRelay((ws) => {
      if (!sockets.includes(ws)) {
        sockets.push(ws);
      }
    });

    const busyStates: boolean[] = [];
    adapter = new NarrationClientAdapter({ url: relay.url, clientName: "test-producer" });
    adapter.onBusyChange((busy) => busyStates.push(busy));

    await adapter.connect();
    const first = adapter.say({ id: "utt_a", text: "First." });
    const second = adapter.say({ id: "utt_b", text: "Second." });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(adapter.isBusy(), true);
    assert.deepEqual(busyStates, [true]);

    sockets[0].send(JSON.stringify({ type: "narration:completed", id: "utt_a" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(adapter.isBusy(), true);
    assert.deepEqual(busyStates, [true]);

    sockets[0].send(JSON.stringify({ type: "narration:skipped", id: "utt_b" }));
    const results = await Promise.all([first, second]);

    assert.deepEqual(results.map((result) => result.type), [
      "narration:completed",
      "narration:skipped",
    ]);
    assert.equal(adapter.isBusy(), false);
    assert.deepEqual(busyStates, [true, false]);
  });

  it("should return skipped when the relay is unavailable by default", async () => {
    const closedServer = createServer();
    await new Promise<void>((resolve) => closedServer.listen(0, "127.0.0.1", resolve));
    const address = closedServer.address();
    assert.ok(address && typeof address === "object");
    await new Promise<void>((resolve) => closedServer.close(() => resolve()));

    adapter = new NarrationClientAdapter({
      url: `ws://127.0.0.1:${address.port}/ws/narration`,
      clientName: "test-producer",
      connectTimeoutMs: 50,
    });

    await adapter.connect();
    const result = await adapter.say({ text: "This should not block." });

    assert.equal(result.type, "narration:skipped");
    assert.equal(adapter.isBusy(), false);
  });

  it("should resolve failed and clear busy on completion timeout", async () => {
    relay = await startRelay(() => {});

    const busyStates: boolean[] = [];
    adapter = new NarrationClientAdapter({
      url: relay.url,
      clientName: "test-producer",
      timeoutMs: 20,
    });
    adapter.onBusyChange((busy) => busyStates.push(busy));

    await adapter.connect();
    const result = await adapter.say({ text: "No UI acknowledgement." });

    assert.equal(result.type, "narration:failed");
    assert.equal(result.error, "Narration completion timed out");
    assert.equal(adapter.isBusy(), false);
    assert.deepEqual(busyStates, [true, false]);
  });
});
