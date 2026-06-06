import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { claimRun } from "../src/claim.js";
import { writeRunState } from "../src/run-state.js";
import type { RunState } from "../src/types.js";

let tempDirs: string[] = [];

async function makeWritable(target: string): Promise<void> {
  try {
    const stat = await fs.lstat(target);
    if (stat.isDirectory()) {
      await fs.chmod(target, 0o755);
      for (const entry of await fs.readdir(target)) {
        await makeWritable(path.join(target, entry));
      }
    } else {
      await fs.chmod(target, 0o644);
    }
  } catch {
    // Best-effort cleanup helper.
  }
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await makeWritable(dir);
    await fs.rm(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

async function makeState(): Promise<RunState> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-arena-claim-"));
  tempDirs.push(root);

  const runDir = path.join(root, "runs", "run-1");
  const statePath = path.join(runDir, "state.json");
  const workspaceA = path.join(root, "workspaces", "a");
  const workspaceB = path.join(root, "workspaces", "b");

  await fs.mkdir(path.join(workspaceA, ".arena", "rival", "b"), { recursive: true });
  await fs.mkdir(path.join(workspaceB, ".arena", "rival", "a"), { recursive: true });
  await fs.mkdir(runDir, { recursive: true });

  const state: RunState = {
    runId: "run-1",
    status: "running",
    startedAt: new Date(Date.now() - 1000).toISOString(),
    baseRepo: root,
    baseRef: "HEAD",
    arenaRoot: root,
    runDir,
    statePath,
    goal: "Create a pass file.",
    verifyCommand: "test -f pass",
    peek: {
      refreshIntervalSeconds: 30,
      include: ["**/*"],
      exclude: [".arena/**", ".git/**"]
    },
    tmux: {
      sessionName: "missing-session",
      attach: false
    },
    agents: [
      {
        id: "a",
        name: "Agent A",
        command: "fake-a",
        workspace: workspaceA,
        branch: "a",
        goalFile: path.join(workspaceA, ".arena", "goal.txt"),
        briefFile: path.join(workspaceA, ".arena", "brief.md"),
        claimScript: path.join(workspaceA, ".arena", "claim.sh"),
        claimCommand: "claim-a",
        rivalDir: path.join(workspaceA, ".arena", "rival", "b")
      },
      {
        id: "b",
        name: "Agent B",
        command: "fake-b",
        workspace: workspaceB,
        branch: "b",
        goalFile: path.join(workspaceB, ".arena", "goal.txt"),
        briefFile: path.join(workspaceB, ".arena", "brief.md"),
        claimScript: path.join(workspaceB, ".arena", "claim.sh"),
        claimCommand: "claim-b",
        rivalDir: path.join(workspaceB, ".arena", "rival", "a")
      }
    ],
    claims: []
  };

  await writeRunState(state);
  return state;
}

describe("claim verification", () => {
  it("keeps running after a failed early claim", async () => {
    const state = await makeState();

    const failed = await claimRun({
      runId: state.runId,
      agentId: "a",
      statePath: state.statePath
    });

    expect(failed.status).toBe("failed");

    await fs.writeFile(path.join(state.agents[1].workspace, "pass"), "ok\n");

    const passed = await claimRun({
      runId: state.runId,
      agentId: "b",
      statePath: state.statePath
    });

    expect(passed.status).toBe("passed");
    const finalState = JSON.parse(await fs.readFile(state.statePath, "utf8")) as RunState;
    expect(finalState.status).toBe("finished");
    expect(finalState.winner?.agentId).toBe("b");
    expect(finalState.claims.map((claim) => claim.status)).toEqual(["failed", "passed"]);
  });

  it("allows only one winner for simultaneous passing claims", async () => {
    const state = await makeState();
    await fs.writeFile(path.join(state.agents[0].workspace, "pass"), "ok\n");
    await fs.writeFile(path.join(state.agents[1].workspace, "pass"), "ok\n");

    const claims = await Promise.all([
      claimRun({ runId: state.runId, agentId: "a", statePath: state.statePath }),
      claimRun({ runId: state.runId, agentId: "b", statePath: state.statePath })
    ]);

    expect(claims.filter((claim) => claim.status === "passed")).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === "ignored")).toHaveLength(1);

    const finalState = JSON.parse(await fs.readFile(state.statePath, "utf8")) as RunState;
    expect(finalState.winner).toBeDefined();
    expect(finalState.claims).toHaveLength(2);
  });
});
