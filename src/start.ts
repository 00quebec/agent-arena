import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeAgentBrief } from "./brief.js";
import { readConfig } from "./config.js";
import { refreshAllMirrors } from "./mirror.js";
import { resolveAgentBinary, resolveAgentCommand } from "./presets.js";
import { registerRun, writeRunState } from "./run-state.js";
import { commandExists, extractCommandBinary, shellQuote } from "./shell.js";
import { renderCommandTemplate } from "./template.js";
import { attachTmux, launchTmux } from "./tmux.js";
import type { AgentInput, RunAgent, RunState } from "./types.js";
import { createWorktree, resolveGitRef, resolveGitRoot } from "./worktree.js";
import { spawnMirrorDaemon } from "./daemon.js";

export type StartOptions = {
  configPath: string;
  attach?: boolean;
  cliPath: string;
};

function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  return `${stamp}-${randomUUID().slice(0, 8)}`;
}

function sanitizeBranchPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}

function assertSupportedPlatform(): void {
  if (process.platform === "win32") {
    throw new Error("Agent Arena v1 supports macOS and Linux. Windows support is deferred.");
  }
}

function assertBinary(binary: string, label: string): void {
  if (!commandExists(binary)) {
    throw new Error(`Missing required ${label}: ${binary}`);
  }
}

function buildClaimCommand(cliPath: string, runId: string, agentId: string): string {
  return `${shellQuote(process.execPath)} ${shellQuote(cliPath)} claim --run ${shellQuote(runId)} --agent ${shellQuote(agentId)}`;
}

function resolveLaunchBinary(agent: AgentInput, command: string): string | undefined {
  return resolveAgentBinary(agent) ?? extractCommandBinary(command);
}

export async function startArena(options: StartOptions): Promise<RunState> {
  assertSupportedPlatform();
  assertBinary("git", "binary");
  assertBinary("tmux", "binary");

  const config = await readConfig(options.configPath);
  const baseRepo = path.resolve(path.dirname(path.resolve(options.configPath)), config.baseRepo);
  const repoRoot = resolveGitRoot(baseRepo);
  const baseCommit = resolveGitRef(repoRoot, config.baseRef);
  const runId = makeRunId();
  const arenaRoot = path.join(repoRoot, ".agent-arena");
  const runDir = path.join(arenaRoot, "runs", runId);
  const workspaceRoot = path.join(arenaRoot, "workspaces", runId);
  const statePath = path.join(runDir, "state.json");
  const sessionName = `${config.tmux.sessionPrefix}-${runId.slice(-8)}`;

  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });

  for (const agent of config.agents) {
    const command = resolveAgentCommand(agent);
    const binary = resolveLaunchBinary(agent, command);
    if (binary) {
      assertBinary(binary, `agent binary for ${agent.id}`);
    }
  }

  const runAgents = [] as unknown as [RunAgent, RunAgent];

  for (const agent of config.agents) {
    const workspace = path.join(workspaceRoot, agent.id);
    const branch = `agent-arena/${sanitizeBranchPart(runId)}/${sanitizeBranchPart(agent.id)}`;
    await createWorktree(repoRoot, workspace, branch, baseCommit);
  }

  for (const agent of config.agents) {
    const rival = config.agents.find((candidate) => candidate.id !== agent.id);
    if (!rival) {
      throw new Error("Agent Arena requires exactly two agents.");
    }

    const workspace = path.join(workspaceRoot, agent.id);
    const arenaDir = path.join(workspace, ".arena");
    const claimScript = path.join(arenaDir, "claim.sh");
    const goalFile = path.join(arenaDir, "goal.txt");
    const briefFile = path.join(arenaDir, "brief.md");
    const rivalDir = path.join(arenaDir, "rival", rival.id);
    const claimCommand = buildClaimCommand(options.cliPath, runId, agent.id);
    const commandTemplate = resolveAgentCommand(agent);
    const command = renderCommandTemplate(commandTemplate, {
      goal: config.goal,
      goalFile,
      claimCommand: `./.arena/claim.sh`,
      rivalDir,
      workspace,
      agentId: agent.id,
      runId
    });

    runAgents.push({
      id: agent.id,
      name: agent.name ?? agent.id,
      preset: agent.preset,
      binary: resolveLaunchBinary(agent, commandTemplate),
      command,
      workspace,
      branch: `agent-arena/${sanitizeBranchPart(runId)}/${sanitizeBranchPart(agent.id)}`,
      goalFile,
      briefFile,
      claimScript,
      claimCommand,
      rivalDir
    });
  }

  const state: RunState = {
    runId,
    status: "running",
    startedAt: new Date().toISOString(),
    baseRepo: repoRoot,
    baseRef: baseCommit,
    arenaRoot,
    runDir,
    statePath,
    goal: config.goal,
    verifyCommand: config.verifyCommand,
    peek: config.peek,
    tmux: {
      sessionName,
      attach: options.attach ?? config.tmux.attach
    },
    agents: runAgents,
    claims: []
  };

  for (const agent of state.agents) {
    const rival = state.agents.find((candidate) => candidate.id !== agent.id);
    await writeAgentBrief(agent, rival?.name ?? "rival", state.runId, state.goal, state.verifyCommand);
  }

  await writeRunState(state);
  await registerRun(runId, statePath);
  await refreshAllMirrors(state);

  const daemonPid = spawnMirrorDaemon(runId, statePath, options.cliPath, path.join(runDir, "mirror-daemon.log"));
  state.mirrorDaemonPid = daemonPid;
  await writeRunState(state);

  launchTmux(state);

  console.log(`Started Agent Arena run ${runId}`);
  console.log(`State: ${statePath}`);
  console.log(`tmux session: ${sessionName}`);
  console.log(`Attach later with: tmux attach-session -t ${sessionName}`);

  if (state.tmux.attach) {
    attachTmux(sessionName);
  }

  return state;
}
