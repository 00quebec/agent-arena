import { describe, expect, it } from "vitest";
import { renderCommandTemplate } from "../src/template.js";

describe("command templates", () => {
  it("shell-quotes placeholder values", () => {
    const command = renderCommandTemplate("codex {goal} --cwd {workspace}", {
      goal: "fix Bob's benchmark",
      workspace: "/tmp/my repo"
    });

    expect(command).toBe("codex 'fix Bob'\\''s benchmark' --cwd '/tmp/my repo'");
  });

  it("leaves unknown placeholders intact", () => {
    expect(renderCommandTemplate("agent {unknown}", {})).toBe("agent {unknown}");
  });
});
