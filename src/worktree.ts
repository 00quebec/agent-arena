import fs from "node:fs/promises";
import path from "node:path";
import { runChecked } from "./shell.js";

export function resolveGitRoot(baseRepo: string): string {
  return runChecked("git", ["-C", baseRepo, "rev-parse", "--show-toplevel"]);
}

export function resolveGitRef(repoRoot: string, ref: string): string {
  return runChecked("git", ["-C", repoRoot, "rev-parse", ref]);
}

export async function createWorktree(repoRoot: string, workspace: string, branch: string, baseRef: string): Promise<void> {
  await fs.mkdir(path.dirname(workspace), { recursive: true });
  runChecked("git", ["-C", repoRoot, "worktree", "add", "-b", branch, workspace, baseRef]);
}
