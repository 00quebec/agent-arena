import fs from "node:fs/promises";
import path from "node:path";
import type { RunAgent } from "./types.js";

export async function writeAgentBrief(
  agent: RunAgent,
  rivalName: string,
  runId: string,
  goal: string,
  verifyCommand: string
): Promise<void> {
  await fs.mkdir(path.dirname(agent.briefFile), { recursive: true });

  const brief = [
    "# Agent Arena Brief",
    "",
    `You are competing as **${agent.name}** in run **${runId}**.`,
    "",
    "## Goal",
    "",
    goal,
    "",
    "## How To Win",
    "",
    "When you believe the goal is satisfied, run:",
    "",
    "```sh",
    agent.claimCommand,
    "```",
    "",
    "Agent Arena will then run this verifier in your workspace:",
    "",
    "```sh",
    verifyCommand,
    "```",
    "",
    "The first agent whose claim passes the verifier wins. Failed claims are logged and the run continues.",
    "",
    "## Rival Visibility",
    "",
    `Your rival is **${rivalName}**.`,
    `A refreshed read-only mirror of the rival workspace is available at: ${agent.rivalDir}`,
    "",
    "Use the mirror to learn from the rival's approach. Do not try to edit, delete, or damage the rival workspace.",
    "",
    "## Local Files",
    "",
    `- Goal file: ${agent.goalFile}`,
    `- Brief file: ${agent.briefFile}`,
    `- Claim script: ${agent.claimScript}`,
    ""
  ].join("\n");

  await fs.writeFile(agent.goalFile, `${goal}\n`, "utf8");
  await fs.writeFile(agent.briefFile, brief, "utf8");
  await fs.writeFile(
    agent.claimScript,
    `#!/usr/bin/env sh\nset -eu\nexec ${agent.claimCommand}\n`,
    {
      encoding: "utf8",
      mode: 0o755
    }
  );
}
