import { spawnSync } from "node:child_process";
import { shellQuote } from "./shell.js";
import type { RunAgent, RunState } from "./types.js";

function runTmux(args: string[]): string {
  const result = spawnSync("tmux", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(`tmux ${args.join(" ")} failed:\n${result.stderr}`);
  }

  return result.stdout.trim();
}

function commandWithArenaEnv(state: RunState, agent: RunAgent): string {
  const env = {
    ARENA_AGENT_ID: agent.id,
    ARENA_RUN_ID: state.runId,
    ARENA_GOAL_FILE: agent.goalFile,
    ARENA_RIVAL_DIR: agent.rivalDir,
    ARENA_CLAIM_COMMAND: agent.claimCommand
  };

  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");

  return `env ${envPrefix} ${agent.command}`;
}

export function launchTmux(state: RunState): void {
  const [first, second] = state.agents;

  runTmux([
    "new-session",
    "-d",
    "-s",
    state.tmux.sessionName,
    "-n",
    "arena",
    "-c",
    first.workspace,
    commandWithArenaEnv(state, first)
  ]);

  runTmux([
    "split-window",
    "-h",
    "-t",
    `${state.tmux.sessionName}:0`,
    "-c",
    second.workspace,
    commandWithArenaEnv(state, second)
  ]);

  runTmux(["select-layout", "-t", `${state.tmux.sessionName}:0`, "even-horizontal"]);
  runTmux(["select-pane", "-t", `${state.tmux.sessionName}:0.0`]);
}

export function attachTmux(sessionName: string): void {
  spawnSync("tmux", ["attach-session", "-t", sessionName], {
    stdio: "inherit"
  });
}

export function notifyTmux(sessionName: string, message: string): void {
  const result = spawnSync("tmux", ["display-message", "-t", sessionName, message], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    // tmux notification is best-effort; the run result is already persisted.
  }
}
