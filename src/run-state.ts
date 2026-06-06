import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunState } from "./types.js";

type RunIndex = Record<string, string>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getIndexPath(): string {
  return path.join(os.homedir(), ".agent-arena", "runs.json");
}

async function readIndex(): Promise<RunIndex> {
  try {
    const raw = await fs.readFile(getIndexPath(), "utf8");
    return JSON.parse(raw) as RunIndex;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

export async function registerRun(runId: string, statePath: string): Promise<void> {
  const index = await readIndex();
  index[runId] = statePath;
  await writeJsonAtomic(getIndexPath(), index);
}

export async function resolveStatePath(runId: string, explicitStatePath?: string): Promise<string> {
  if (explicitStatePath) {
    return path.resolve(explicitStatePath);
  }

  const index = await readIndex();
  const indexed = index[runId];
  if (indexed) {
    return indexed;
  }

  const localCandidate = path.resolve(".agent-arena", "runs", runId, "state.json");
  try {
    await fs.access(localCandidate);
    return localCandidate;
  } catch {
    throw new Error(`Unknown run ${runId}. Pass --state or run agent-arena status from the base repo.`);
  }
}

export async function readRunState(statePath: string): Promise<RunState> {
  const raw = await fs.readFile(statePath, "utf8");
  return JSON.parse(raw) as RunState;
}

export async function writeRunState(state: RunState): Promise<void> {
  await writeJsonAtomic(state.statePath, state);
}

export async function withRunLock<T>(statePath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${statePath}.lock`;
  const deadline = Date.now() + 30000;
  let handle: fs.FileHandle | undefined;

  while (!handle) {
    try {
      handle = await fs.open(lockPath, "wx");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EEXIST" || Date.now() > deadline) {
        throw error;
      }
      await sleep(50);
    }
  }

  try {
    return await fn();
  } finally {
    await handle.close();
    await fs.rm(lockPath, { force: true });
  }
}
