import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventHub } from "../event-hub.js";

describe("EventHub", () => {
  let hub: EventHub;

  beforeEach(() => {
    hub = new EventHub();
  });

  describe("pub/sub", () => {
    it("should emit and receive events", () => {
      let received = false;
      hub.on("agent:text", () => {
        received = true;
      });
      hub.emit("agent:text", { content: "hello" });
      assert.equal(received, true);
    });

    it("should pass event data to listeners", () => {
      let eventData: unknown = null;
      hub.on("agent:text", (event: unknown) => {
        eventData = event;
      });
      hub.emit("agent:text", { content: "hello" });
      assert.ok(eventData);
      const typed = eventData as { type: string; data: unknown; timestamp: number };
      assert.equal(typed.type, "agent:text");
      assert.deepEqual(typed.data, { content: "hello" });
      assert.equal(typeof typed.timestamp, "number");
    });

    it("should support onAny wildcard listener", () => {
      const events: string[] = [];
      hub.onAny((event) => {
        events.push(event.type);
      });
      hub.emit("agent:text");
      hub.emit("agent:tool");
      hub.emit("game:started");
      assert.deepEqual(events, ["agent:text", "agent:tool", "game:started"]);
    });

    it("should unsubscribe with off", () => {
      let count = 0;
      const listener = () => { count++; };
      hub.on("agent:text", listener);
      hub.emit("agent:text");
      hub.off("agent:text", listener);
      hub.emit("agent:text");
      assert.equal(count, 1);
    });

    it("should unsubscribe wildcard with offAny", () => {
      let count = 0;
      const listener = () => { count++; };
      hub.onAny(listener);
      hub.emit("agent:text");
      hub.offAny(listener);
      hub.emit("agent:text");
      assert.equal(count, 1);
    });
  });

  describe("AgentActivity buffer", () => {
    it("should store activities", () => {
      hub.pushActivity("text", "hello");
      hub.pushActivity("reasoning", "thinking...");
      const activities = hub.getRecentActivities();
      assert.equal(activities.length, 2);
      assert.equal(activities[0].type, "text");
      assert.equal(activities[0].content, "hello");
      assert.equal(activities[1].type, "reasoning");
    });

    it("should assign unique ids", () => {
      const a1 = hub.pushActivity("text", "a");
      const a2 = hub.pushActivity("text", "b");
      assert.notEqual(a1.id, a2.id);
    });

    it("should limit buffer to 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        hub.pushActivity("text", `msg-${i}`);
      }
      const activities = hub.getRecentActivities();
      assert.equal(activities.length, 50);
      // Oldest should be msg-10 (first 10 were dropped)
      assert.equal(activities[0].content, "msg-10");
      assert.equal(activities[49].content, "msg-59");
    });

    it("should support offset and limit", () => {
      for (let i = 0; i < 10; i++) {
        hub.pushActivity("text", `msg-${i}`);
      }
      const page = hub.getRecentActivities(2, 3);
      assert.equal(page.length, 3);
      assert.equal(page[0].content, "msg-2");
      assert.equal(page[2].content, "msg-4");
    });

    it("should emit agent:text event when pushing text activity", () => {
      let emitted = false;
      hub.on("agent:text", () => { emitted = true; });
      hub.pushActivity("text", "hello");
      assert.equal(emitted, true);
    });
  });

  describe("Comment buffer", () => {
    it("should add and retrieve comments", () => {
      hub.addComment("Taro", "Hello!", "youtube");
      hub.addComment("Hana", "Nice game", "youtube");
      const comments = hub.getComments();
      assert.equal(comments.length, 2);
      assert.equal(comments[0].authorName, "Taro");
      assert.equal(comments[0].text, "Hello!");
      assert.equal(comments[0].platform, "youtube");
      assert.equal(comments[0].status, "received");
    });

    it("should limit buffer to 500 entries", () => {
      for (let i = 0; i < 510; i++) {
        hub.addComment(`user-${i}`, `msg-${i}`, "youtube");
      }
      const comments = hub.getComments();
      assert.equal(comments.length, 500);
      assert.equal(comments[0].authorName, "user-10");
    });

    it("should update comment status", () => {
      const comment = hub.addComment("Taro", "Hello!", "youtube");
      const updated = hub.updateCommentStatus(comment.id, "queued");
      assert.ok(updated);
      assert.equal(updated!.status, "queued");
    });

    it("should return null for unknown comment id", () => {
      const result = hub.updateCommentStatus("nonexistent", "queued");
      assert.equal(result, null);
    });

    it("should filter queued comments", () => {
      hub.addComment("A", "msg1", "youtube");
      const c2 = hub.addComment("B", "msg2", "youtube");
      hub.addComment("C", "msg3", "youtube");
      hub.updateCommentStatus(c2.id, "queued");
      const queued = hub.getQueuedComments();
      assert.equal(queued.length, 1);
      assert.equal(queued[0].authorName, "B");
    });

    it("should emit comment:received on add", () => {
      let emitted = false;
      hub.on("comment:received", () => { emitted = true; });
      hub.addComment("Taro", "Hello!", "youtube");
      assert.equal(emitted, true);
    });
  });

  describe("State management", () => {
    it("should have default idle state", () => {
      const state = hub.getState();
      assert.equal(state.phase, "idle");
      assert.equal(state.mode, "single");
      assert.equal(state.currentGame, null);
      assert.equal(state.gamesCompleted, 0);
    });

    it("should update phase", () => {
      hub.setPhase("playing");
      assert.equal(hub.getState().phase, "playing");
    });

    it("should track games played", () => {
      hub.addGamePlayed("othello");
      hub.addGamePlayed("gomoku");
      const state = hub.getState();
      assert.deepEqual(state.gamesPlayed, ["othello", "gomoku"]);
      assert.equal(state.gamesCompleted, 2);
    });

    it("should reset games played", () => {
      hub.addGamePlayed("othello");
      hub.resetGamesPlayed();
      assert.deepEqual(hub.getState().gamesPlayed, []);
    });

    it("should return a copy of state (not reference)", () => {
      const state1 = hub.getState();
      hub.setPhase("playing");
      const state2 = hub.getState();
      assert.equal(state1.phase, "idle");
      assert.equal(state2.phase, "playing");
    });
  });

  describe("getFullSnapshot", () => {
    it("should return state, activities, and comments", () => {
      hub.pushActivity("text", "hello");
      hub.addComment("Taro", "Nice!", "youtube");

      const snapshot = hub.getFullSnapshot();
      assert.ok(snapshot.state);
      assert.equal(snapshot.recentActivities.length, 1);
      assert.equal(snapshot.comments.length, 1);
    });
  });
});
