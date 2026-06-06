import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { refreshAllMirrors } from "./mirror.js";
import { readRunState, resolveStatePath } from "./run-state.js";
import { shellQuote } from "./shell.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function spawnMirrorDaemon(runId: string, statePath: string, cliPath: string, logPath: string): number | undefined {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const out = fs.openSync(logPath, "a");
  const command = `${shellQuote(process.execPath)} ${shellQuote(cliPath)} mirror-daemon --run ${shellQuote(runId)} --state ${shellQuote(statePath)}`;
  const child = spawn("sh", ["-lc", command], {
    detached: true,
    stdio: ["ignore", out, out]
  });

  child.unref();
  return child.pid;
}

export async function runMirrorDaemon(runId: string, explicitStatePath?: string): Promise<void> {
  const statePath = await resolveStatePath(runId, explicitStatePath);

  while (true) {
    const state = await readRunState(statePath);
    await refreshAllMirrors(state);

    if (state.status !== "running") {
      return;
    }

    await sleep(state.peek.refreshIntervalSeconds * 1000);
  }
}
