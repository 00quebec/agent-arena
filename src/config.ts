import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DEFAULT_EXCLUDES, DEFAULT_INCLUDE } from "./defaults.js";
import type { ArenaConfig } from "./types.js";

const DEFAULT_PEEK = {
  refreshIntervalSeconds: 30,
  include: DEFAULT_INCLUDE,
  exclude: DEFAULT_EXCLUDES
};

const DEFAULT_TMUX = {
  sessionPrefix: "agent-arena",
  attach: true
};

const agentIdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscores, and hyphens.");

const agentSchema = z
  .object({
    id: agentIdSchema,
    name: z.string().min(1).optional(),
    preset: z.enum(["claude", "codex", "cursor"]).optional(),
    command: z.string().min(1).optional(),
    env: z.record(z.string(), z.string()).optional()
  })
  .superRefine((agent, ctx) => {
    if (!agent.preset && !agent.command) {
      ctx.addIssue({
        code: "custom",
        message: "Agent must define either preset or command.",
        path: ["preset"]
      });
    }
  });

const peekSchema = z
  .object({
    refreshIntervalSeconds: z.number().int().positive().default(30),
    include: z.array(z.string()).default(DEFAULT_INCLUDE),
    exclude: z.array(z.string()).default(DEFAULT_EXCLUDES)
  })
  .default(DEFAULT_PEEK);

const tmuxSchema = z
  .object({
    sessionPrefix: z.string().min(1).default("agent-arena"),
    attach: z.boolean().default(true)
  })
  .default(DEFAULT_TMUX);

export const arenaConfigSchema = z
  .object({
    baseRepo: z.string().min(1).default("."),
    baseRef: z.string().min(1).default("HEAD"),
    goal: z.string().min(1),
    verifyCommand: z.string().min(1),
    agents: z.tuple([agentSchema, agentSchema]),
    peek: peekSchema,
    tmux: tmuxSchema
  })
  .superRefine((config, ctx) => {
    const ids = new Set(config.agents.map((agent) => agent.id));
    if (ids.size !== config.agents.length) {
      ctx.addIssue({
        code: "custom",
        message: "Agent ids must be unique.",
        path: ["agents"]
      });
    }
  });

export function parseArenaConfig(input: unknown): ArenaConfig {
  return arenaConfigSchema.parse(input);
}

export async function readConfig(configPath: string): Promise<ArenaConfig> {
  const absolutePath = path.resolve(configPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return parseArenaConfig(JSON.parse(raw));
}

export function defaultConfig(): ArenaConfig {
  return parseArenaConfig({
    baseRepo: ".",
    baseRef: "HEAD",
    goal: "Describe the task and measurable win condition here.",
    verifyCommand: "npm test",
    agents: [
      {
        id: "claude",
        preset: "claude"
      },
      {
        id: "codex",
        preset: "codex"
      }
    ],
    peek: {
      refreshIntervalSeconds: 30,
      include: DEFAULT_INCLUDE,
      exclude: DEFAULT_EXCLUDES
    },
    tmux: {
      sessionPrefix: "agent-arena",
      attach: true
    }
  });
}
