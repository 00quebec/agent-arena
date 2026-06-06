import { describe, expect, it } from "vitest";
import { parseArenaConfig } from "../src/config.js";

describe("config parsing", () => {
  it("applies defaults", () => {
    const config = parseArenaConfig({
      goal: "Win the race.",
      verifyCommand: "npm test",
      agents: [
        { id: "a", preset: "claude" },
        { id: "b", preset: "codex" }
      ]
    });

    expect(config.baseRepo).toBe(".");
    expect(config.baseRef).toBe("HEAD");
    expect(config.peek.refreshIntervalSeconds).toBe(30);
    expect(config.tmux.sessionPrefix).toBe("agent-arena");
  });

  it("rejects agents without a preset or command", () => {
    expect(() =>
      parseArenaConfig({
        goal: "Win the race.",
        verifyCommand: "npm test",
        agents: [{ id: "a" }, { id: "b", preset: "codex" }]
      })
    ).toThrow(/preset or command/);
  });

  it("rejects duplicate agent ids", () => {
    expect(() =>
      parseArenaConfig({
        goal: "Win the race.",
        verifyCommand: "npm test",
        agents: [
          { id: "same", preset: "claude" },
          { id: "same", preset: "codex" }
        ]
      })
    ).toThrow(/unique/);
  });
});
