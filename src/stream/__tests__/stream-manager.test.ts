import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventHub } from "../event-hub.js";
import { StreamManager } from "../stream-manager.js";
import type { StreamPhase } from "../types.js";

describe("StreamManager", () => {
  let hub: EventHub;
  let manager: StreamManager;

  beforeEach(() => {
    hub = new EventHub();
    manager = new StreamManager(hub);
  });

  describe("state transitions", () => {
    it("should start in idle phase", () => {
      assert.equal(manager.getCurrentPhase(), "idle");
    });

    it("should transition idle -> starting", () => {
      const ok = manager.transition("starting");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "starting");
    });

    it("should transition starting -> playing", () => {
      manager.transition("starting");
      const ok = manager.transition("playing");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "playing");
    });

    it("should transition playing -> transitioning", () => {
      manager.transition("starting");
      manager.transition("playing");
      const ok = manager.transition("transitioning");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "transitioning");
    });

    it("should transition playing -> paused", () => {
      manager.transition("starting");
      manager.transition("playing");
      const ok = manager.transition("paused");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "paused");
    });

    it("should transition paused -> playing (resume)", () => {
      manager.transition("starting");
      manager.transition("playing");
      manager.transition("paused");
      const ok = manager.transition("playing");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "playing");
    });

    it("should transition transitioning -> playing", () => {
      manager.transition("starting");
      manager.transition("playing");
      manager.transition("transitioning");
      const ok = manager.transition("playing");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "playing");
    });

    it("should transition stopped -> idle", () => {
      manager.transition("starting");
      manager.transition("playing");
      manager.transition("stopped");
      const ok = manager.transition("idle");
      assert.equal(ok, true);
      assert.equal(manager.getCurrentPhase(), "idle");
    });

    // Stop from any running state
    const stopFromStates: StreamPhase[] = ["starting", "playing", "transitioning", "paused"];
    for (const fromState of stopFromStates) {
      it(`should transition ${fromState} -> stopped`, () => {
        // Navigate to the target state
        if (fromState === "starting") {
          manager.transition("starting");
        } else if (fromState === "playing") {
          manager.transition("starting");
          manager.transition("playing");
        } else if (fromState === "transitioning") {
          manager.transition("starting");
          manager.transition("playing");
          manager.transition("transitioning");
        } else if (fromState === "paused") {
          manager.transition("starting");
          manager.transition("playing");
          manager.transition("paused");
        }
        const ok = manager.transition("stopped");
        assert.equal(ok, true);
        assert.equal(manager.getCurrentPhase(), "stopped");
      });
    }
  });

  describe("invalid transitions", () => {
    it("should reject idle -> paused", () => {
      const ok = manager.transition("paused");
      assert.equal(ok, false);
    });

    it("should reject idle -> playing", () => {
      const ok = manager.transition("playing");
      assert.equal(ok, false);
    });

    it("should reject idle -> transitioning", () => {
      const ok = manager.transition("transitioning");
      assert.equal(ok, false);
    });

    it("should reject starting -> paused", () => {
      manager.transition("starting");
      const ok = manager.transition("paused");
      assert.equal(ok, false);
    });

    it("should reject stopped -> playing", () => {
      manager.transition("starting");
      manager.transition("stopped");
      const ok = manager.transition("playing");
      assert.equal(ok, false);
    });

    it("should set error on invalid transition", () => {
      manager.transition("paused"); // invalid from idle
      const state = hub.getState();
      assert.ok(state.error);
      assert.ok(state.error!.includes("Invalid transition"));
    });
  });

  describe("configuration", () => {
    it("should have default config", () => {
      const config = manager.getConfig();
      assert.equal(config.mode, "single");
      assert.equal(config.pauseBetweenGames, 5000);
    });

    it("should update config", () => {
      manager.configure({ mode: "multi", pauseBetweenGames: 10000 });
      const config = manager.getConfig();
      assert.equal(config.mode, "multi");
      assert.equal(config.pauseBetweenGames, 10000);
    });

    it("should update hub state on configure", () => {
      manager.configure({ mode: "multi" });
      assert.equal(hub.getState().mode, "multi");
    });
  });

  describe("skip control", () => {
    it("should not have skip requested initially", () => {
      assert.equal(manager.isSkipRequested(), false);
    });

    it("should set skip requested", () => {
      manager.requestSkip();
      assert.equal(manager.isSkipRequested(), true);
    });

    it("should consume skip and reset", () => {
      manager.requestSkip();
      const was = manager.consumeSkip();
      assert.equal(was, true);
      assert.equal(manager.isSkipRequested(), false);
    });
  });

  describe("convenience methods", () => {
    it("should report isRunning for active phases", () => {
      assert.equal(manager.isRunning(), false);
      manager.transition("starting");
      assert.equal(manager.isRunning(), true);
      manager.transition("playing");
      assert.equal(manager.isRunning(), true);
      manager.transition("stopped");
      assert.equal(manager.isRunning(), false);
    });

    it("should return correct pause between games", () => {
      assert.equal(manager.getPauseBetweenGames(), 5000);
      manager.configure({ pauseBetweenGames: 3000 });
      assert.equal(manager.getPauseBetweenGames(), 3000);
    });
  });

  describe("event emissions", () => {
    it("should emit stream:started on transition to starting", () => {
      let emitted = false;
      hub.on("stream:started", () => { emitted = true; });
      manager.transition("starting");
      assert.equal(emitted, true);
    });

    it("should emit stream:stopped on transition to stopped", () => {
      let emitted = false;
      hub.on("stream:stopped", () => { emitted = true; });
      manager.transition("starting");
      manager.transition("stopped");
      assert.equal(emitted, true);
    });

    it("should emit stream:paused on transition to paused", () => {
      let emitted = false;
      hub.on("stream:paused", () => { emitted = true; });
      manager.transition("starting");
      manager.transition("playing");
      manager.transition("paused");
      assert.equal(emitted, true);
    });

    it("should emit stream:resumed on transition from paused to playing", () => {
      let emitted = false;
      hub.on("stream:resumed", () => { emitted = true; });
      manager.transition("starting");
      manager.transition("playing");
      manager.transition("paused");
      manager.transition("playing");
      assert.equal(emitted, true);
    });
  });
});
