import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventHub } from "../../stream/event-hub.js";
import {
  NarrationEventBridge,
  type NarrationProducerClient,
  type NarrationWaitMode,
} from "../narration-event-bridge.js";
import type { NarrationSayInput } from "@narration-runtime/protocol";

class FakeNarrationProducerClient implements NarrationProducerClient {
  readonly messages: NarrationSayInput[] = [];
  readonly busyListeners = new Set<(busy: boolean) => void>();
  waitForSay: (() => Promise<void>) | null = null;

  async say(input: NarrationSayInput): Promise<unknown> {
    this.messages.push(input);
    await this.waitForSay?.();
    return undefined;
  }

  onBusyChange(listener: (busy: boolean) => void): void {
    this.busyListeners.add(listener);
  }

  offBusyChange(listener: (busy: boolean) => void): void {
    this.busyListeners.delete(listener);
  }

  emitBusy(busy: boolean): void {
    for (const listener of this.busyListeners) {
      listener(busy);
    }
  }
}

describe("NarrationEventBridge", () => {
  let hub: EventHub;
  let client: FakeNarrationProducerClient;

  beforeEach(() => {
    hub = new EventHub();
    client = new FakeNarrationProducerClient();
  });

  function startBridge(waitMode: NarrationWaitMode = "busy"): NarrationEventBridge {
    const bridge = new NarrationEventBridge(hub, client, waitMode);
    bridge.start();
    return bridge;
  }

  it("should split completed sentences and buffer incomplete text", () => {
    startBridge();

    hub.emit("agent:text", { content: "First sentence. Second" });
    assert.equal(client.messages.length, 1);
    assert.equal(client.messages[0].text, "First sentence.");
    assert.equal(client.messages[0].metadata?.boundary, "sentence");

    hub.emit("agent:text", { content: " sentence!" });
    assert.equal(client.messages.length, 2);
    assert.equal(client.messages[1].text, "Second sentence!");
    assert.equal(client.messages[1].metadata?.boundary, "sentence");
  });

  it("should flush buffered remainder on agent tool boundaries", () => {
    startBridge();

    hub.emit("agent:text", { content: "Moving to the corner" });
    assert.equal(client.messages.length, 0);

    hub.emit("agent:tool", { name: "click", status: "running" });
    assert.equal(client.messages.length, 1);
    assert.equal(client.messages[0].text, "Moving to the corner");
    assert.equal(client.messages[0].metadata?.boundary, "tool-boundary");
  });

  it("should strip control tags before publishing narration", () => {
    startBridge();

    hub.emit("agent:text", { content: "[CONTINUE]Keep going.[END_STREAM]" });

    assert.equal(client.messages.length, 1);
    assert.equal(client.messages[0].text, "Keep going.");
  });

  it("should propagate producer busy changes to the event hub", () => {
    startBridge();

    assert.equal(client.busyListeners.size, 1);
    client.emitBusy(true);
    assert.equal(hub.getTTSBusy(), true);

    client.emitBusy(false);
    assert.equal(hub.getTTSBusy(), false);
  });

  it("should remove listeners, clear buffer, and reset busy state on stop", () => {
    const bridge = startBridge();

    hub.emit("agent:text", { content: "Buffered remainder" });
    client.emitBusy(true);
    assert.equal(hub.getTTSBusy(), true);

    bridge.stop();
    assert.equal(client.busyListeners.size, 0);
    assert.equal(hub.getTTSBusy(), false);

    client.emitBusy(true);
    hub.emit("agent:tool", { name: "click", status: "running" });
    hub.emit("agent:text", { content: "Ignored after stop." });

    assert.equal(hub.getTTSBusy(), false);
    assert.equal(client.messages.length, 0);
  });

  it('should not attach busy listeners when waitMode is "none"', () => {
    startBridge("none");

    assert.equal(client.busyListeners.size, 0);
    client.emitBusy(true);
    assert.equal(hub.getTTSBusy(), false);

    hub.emit("agent:text", { content: "Still narrates." });
    assert.equal(client.messages.length, 1);
    assert.equal(client.messages[0].text, "Still narrates.");
  });

  it('should not send queued completion-mode messages after stop', async () => {
    let releaseFirst: () => void = () => {};
    client.waitForSay = () => new Promise<void>((resolve) => {
      releaseFirst = resolve;
      client.waitForSay = null;
    });
    const bridge = startBridge("completion");

    hub.emit("agent:text", { content: "First. Second." });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(client.messages.length, 1);
    assert.equal(client.messages[0].text, "First.");

    bridge.stop();
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(client.messages.length, 1);
  });

  it('should keep TTS busy until the completion-mode queue drains', async () => {
    const releases: Array<() => void> = [];
    client.waitForSay = () => new Promise<void>((resolve) => {
      releases.push(resolve);
    });
    startBridge("completion");

    hub.emit("agent:text", { content: "First. Second." });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(client.messages.length, 1);
    assert.equal(hub.getTTSBusy(), true);

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(client.messages.length, 2);
    assert.equal(hub.getTTSBusy(), true);

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(hub.getTTSBusy(), false);
  });
});
