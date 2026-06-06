import fs from "node:fs/promises";
import path from "node:path";
import { refreshAllMirrors } from "./mirror.js";
import { readRunState, resolveStatePath, withRunLock, writeRunState } from "./run-state.js";
import { runChecked, runShell } from "./shell.js";
import { notifyTmux } from "./tmux.js";
import type { ClaimRecord, RunState } from "./types.js";

export type ClaimRunOptions = {
  runId: string;
  agentId: string;
  statePath?: string;
};

function elapsedMs(state: RunState, at: Date): number {
  return at.getTime() - new Date(state.startedAt).getTime();
}

function gitSummary(workspace: string): string {
  try {
    const status = runChecked("git", ["-C", workspace, "status", "--short"]);
    const diffStat = runChecked("git", ["-C", workspace, "diff", "--stat"]);
    return [`### ${workspace}`, "", "Status:", "```", status || "(clean)", "```", "", "Diff stat:", "```", diffStat || "(no unstaged diff)", "```", ""].join("\n");
  } catch (error) {
    return `### ${workspace}\n\nCould not read git summary: ${(error as Error).message}\n`;
  }
}

async function writeFinalReport(state: RunState, claim: ClaimRecord): Promise<void> {
  const reportPath = path.join(state.runDir, "final-report.md");
  const winner = state.agents.find((agent) => agent.id === claim.agentId);
  const lines = [
    "# Agent Arena Final Report",
    "",
    `Run: ${state.runId}`,
    `Winner: ${winner?.name ?? claim.agentId}`,
    `Finished: ${state.finishedAt}`,
    "",
    "## Goal",
    "",
    state.goal,
    "",
    "## Winning Verifier Output",
    "",
    "stdout:",
    "```",
    claim.stdout.trim() || "(empty)",
    "```",
    "",
    "stderr:",
    "```",
    claim.stderr.trim() || "(empty)",
    "```",
    "",
    "## Agent Workspaces",
    "",
    ...state.agents.flatMap((agent) => [`- ${agent.name}: ${agent.workspace}`]),
    "",
    "## Git Summaries",
    "",
    ...state.agents.map((agent) => gitSummary(agent.workspace))
  ];

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

export async function claimRun(options: ClaimRunOptions): Promise<ClaimRecord> {
  const statePath = await resolveStatePath(options.runId, options.statePath);

  return withRunLock(statePath, async () => {
    const state = await readRunState(statePath);
    const agent = state.agents.find((candidate) => candidate.id === options.agentId);

    if (!agent) {
      throw new Error(`Unknown agent ${options.agentId} for run ${options.runId}.`);
    }

    const claimedAtDate = new Date();
    const claimedAt = claimedAtDate.toISOString();

    if (state.winner) {
      const claim: ClaimRecord = {
        agentId: options.agentId,
        claimedAt,
        verifiedAt: claimedAt,
        status: "ignored",
        stdout: "",
        stderr: "",
        note: `Run already won by ${state.winner.agentId}.`
      };
      state.claims.push(claim);
      await writeRunState(state);
      return claim;
    }

    const started = Date.now();
    const result = await runShell(state.verifyCommand, agent.workspace);
    const verifiedAtDate = new Date();
    const claim: ClaimRecord = {
      agentId: options.agentId,
      claimedAt,
      verifiedAt: verifiedAtDate.toISOString(),
      status: result.exitCode === 0 ? "passed" : "failed",
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - started
    };

    state.claims.push(claim);

    if (claim.status === "passed") {
      const verifiedAt = claim.verifiedAt ?? verifiedAtDate.toISOString();
      state.status = "finished";
      state.finishedAt = verifiedAt;
      state.winner = {
        agentId: options.agentId,
        claimedAt,
        verifiedAt,
        elapsedMs: elapsedMs(state, verifiedAtDate)
      };
      await refreshAllMirrors(state);
      await writeFinalReport(state, claim);
      notifyTmux(state.tmux.sessionName, `Agent Arena winner: ${agent.name}`);
    }

    await writeRunState(state);
    return claim;
  });
}
