# Agent Arena (WIP)

Agent Arena runs two coding-agent CLIs against the same task in isolated git worktrees. Each agent gets its own workspace, a live tmux pane, a refreshed read-only mirror of the rival workspace, and a claim command. The first agent to claim success and pass your verifier wins.

V1 includes built-in presets for:

- Claude Code: `claude`
- OpenAI Codex CLI: `codex`
- Cursor Agent CLI: `cursor-agent`

Custom shell commands are also supported.

## Install

```sh
npm install
npm run build
npm link
```

Agent Arena requires macOS or Linux plus `git` and `tmux`.

## Quick Start

From the repository you want agents to work on:

```sh
agent-arena init
```

Edit `arena.config.json`:

```json
{
  "baseRepo": ".",
  "baseRef": "HEAD",
  "goal": "Make the benchmark at least 3x faster without changing output correctness.",
  "verifyCommand": "npm test && npm run bench -- --min-speedup 3",
  "agents": [
    { "id": "claude", "preset": "claude" },
    { "id": "codex", "preset": "codex" }
  ],
  "peek": {
    "refreshIntervalSeconds": 30
  },
  "tmux": {
    "sessionPrefix": "agent-arena",
    "attach": true
  }
}
```

Start the match:

```sh
agent-arena start --config arena.config.json
```

Agent Arena will:

1. Create two git worktrees under `.agent-arena/workspaces/<run-id>/`.
2. Write each agent a `.arena/brief.md`.
3. Start a tmux session with one pane per agent.
4. Keep `.arena/rival/<rival-id>/` refreshed from the rival workspace.
5. Accept the first passing claim as the winner.

## Claiming A Win

Each workspace gets:

```sh
./.arena/claim.sh
```

Agents should run that command when they believe the goal is complete. The claim command runs `verifyCommand` inside the claiming agent's workspace. If it exits `0`, that agent wins. If it fails, the claim is logged and the match continues.

## Commands

```sh
agent-arena init
agent-arena agents list
agent-arena agents doctor --config arena.config.json
agent-arena start --config arena.config.json
agent-arena status --run <run-id>
agent-arena claim --run <run-id> --agent <agent-id>
```

`status` and `claim` can also take `--state /path/to/state.json` if the run is not in the global run index.

## Command Templates

Agent commands can use these placeholders:

- `{goal}`
- `{goalFile}`
- `{claimCommand}`
- `{rivalDir}`
- `{workspace}`
- `{agentId}`
- `{runId}`

Placeholders are shell-escaped automatically, so do not wrap them in extra quotes:

```json
{
  "id": "custom",
  "command": "my-agent --prompt {goal} --cwd {workspace}"
}
```

## Rival Mirrors

Agents do not receive writable access to the rival workspace. Instead, Agent Arena syncs the rival workspace into:

```text
.arena/rival/<rival-id>/
```

The mirror is chmod'd read-only after each sync and excludes `.git`, `.agent-arena`, `.arena`, dependency folders, caches, and common secret files.

This is an accident-prevention boundary, not a hostile security sandbox. Processes running as the same OS user can usually change permissions back.

## Examples

Example configs live in `examples/`:

- `claude-vs-codex.json`
- `claude-vs-cursor.json`
- `codex-vs-cursor.json`

## Notes

- The starting project must be a git repo.
- Worktrees are created from `baseRef`; uncommitted changes in the source checkout are not copied.
- V1 targets macOS and Linux only.
- Other agent CLIs are deferred, but custom commands work now.
