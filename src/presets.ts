import type { AgentInput, AgentPreset, AgentPresetId } from "./types.js";

export const agentPresets: Record<AgentPresetId, AgentPreset> = {
  claude: {
    id: "claude",
    displayName: "Claude Code",
    binary: "claude",
    defaultCommand: "claude 'Read .arena/brief.md and complete the Agent Arena task.'",
    installHint: "Install Claude Code from Anthropic, then authenticate with the claude CLI.",
    authHint: "Run `claude` once in a normal terminal and complete authentication.",
    docsUrl: "https://code.claude.com/docs"
  },
  codex: {
    id: "codex",
    displayName: "OpenAI Codex CLI",
    binary: "codex",
    defaultCommand: "codex 'Read .arena/brief.md and complete the Agent Arena task.'",
    installHint: "Install with `npm install -g @openai/codex` or your preferred Codex installer.",
    authHint: "Run `codex` once in a normal terminal and complete authentication.",
    docsUrl: "https://github.com/openai/codex"
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor Agent CLI",
    binary: "cursor-agent",
    defaultCommand: "cursor-agent -p 'Read .arena/brief.md and complete the Agent Arena task.'",
    installHint: "Install Cursor Agent CLI from Cursor, then authenticate it locally.",
    authHint: "Run `cursor-agent` once in a normal terminal and complete authentication.",
    docsUrl: "https://docs.cursor.com/en/cli/overview"
  }
};

export function getPreset(id: AgentPresetId): AgentPreset {
  return agentPresets[id];
}

export function resolveAgentCommand(agent: AgentInput): string {
  if (agent.command) {
    return agent.command;
  }

  if (!agent.preset) {
    throw new Error(`Agent ${agent.id} must define either preset or command.`);
  }

  return getPreset(agent.preset).defaultCommand;
}

export function resolveAgentBinary(agent: AgentInput): string | undefined {
  if (agent.preset) {
    return getPreset(agent.preset).binary;
  }

  return undefined;
}
