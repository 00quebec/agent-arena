export type AgentPresetId = "claude" | "codex" | "cursor";

export type AgentInput = {
  id: string;
  name?: string;
  preset?: AgentPresetId;
  command?: string;
  env?: Record<string, string>;
};

export type PeekConfig = {
  refreshIntervalSeconds: number;
  include: string[];
  exclude: string[];
};

export type TmuxConfig = {
  sessionPrefix: string;
  attach: boolean;
};

export type ArenaConfig = {
  baseRepo: string;
  baseRef: string;
  goal: string;
  verifyCommand: string;
  agents: [AgentInput, AgentInput];
  peek: PeekConfig;
  tmux: TmuxConfig;
};

export type AgentPreset = {
  id: AgentPresetId;
  displayName: string;
  binary: string;
  defaultCommand: string;
  installHint: string;
  authHint: string;
  docsUrl: string;
};

export type RunAgent = {
  id: string;
  name: string;
  preset?: AgentPresetId;
  binary?: string;
  command: string;
  workspace: string;
  branch: string;
  goalFile: string;
  briefFile: string;
  claimScript: string;
  claimCommand: string;
  rivalDir: string;
};

export type ClaimStatus = "passed" | "failed" | "ignored";

export type ClaimRecord = {
  agentId: string;
  claimedAt: string;
  verifiedAt?: string;
  status: ClaimStatus;
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs?: number;
  note?: string;
};

export type WinnerRecord = {
  agentId: string;
  claimedAt: string;
  verifiedAt: string;
  elapsedMs: number;
};

export type RunState = {
  runId: string;
  status: "running" | "finished";
  startedAt: string;
  finishedAt?: string;
  baseRepo: string;
  baseRef: string;
  arenaRoot: string;
  runDir: string;
  statePath: string;
  goal: string;
  verifyCommand: string;
  peek: PeekConfig;
  tmux: {
    sessionName: string;
    attach: boolean;
  };
  mirrorDaemonPid?: number;
  agents: [RunAgent, RunAgent];
  claims: ClaimRecord[];
  winner?: WinnerRecord;
};

export type ShellResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
