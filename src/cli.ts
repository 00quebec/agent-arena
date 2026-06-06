#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { listAgents, doctorAgents } from "./agents.js";
import { claimRun } from "./claim.js";
import { readConfig } from "./config.js";
import { runMirrorDaemon } from "./daemon.js";
import { initConfig } from "./init.js";
import { startArena } from "./start.js";
import { printStatus } from "./status.js";

const cliPath = fileURLToPath(import.meta.url);
process.env.AGENT_ARENA_CLI_PATH = cliPath;

const program = new Command();

program
  .name("agent-arena")
  .description("Run competitive coding-agent matches in isolated git worktrees.")
  .version("0.1.0");

program
  .command("init")
  .description("Create an arena.config.json file.")
  .option("-o, --output <path>", "Config path to write.", "arena.config.json")
  .option("--force", "Overwrite an existing config.", false)
  .action(async (options: { output: string; force: boolean }) => {
    await initConfig(options.output, options.force);
  });

const agents = program.command("agents").description("Inspect supported agent presets.");

agents.command("list").description("List built-in agent presets.").action(() => {
  listAgents();
});

agents
  .command("doctor")
  .description("Check whether configured agent binaries are installed.")
  .option("-c, --config <path>", "Config path to check.")
  .action(async (options: { config?: string }) => {
    const config = options.config ? await readConfig(options.config) : undefined;
    const ok = doctorAgents(config);
    process.exitCode = ok ? 0 : 1;
  });

program
  .command("start")
  .description("Start a competitive agent run.")
  .requiredOption("-c, --config <path>", "Arena config path.")
  .option("--no-attach", "Create the tmux session without attaching.")
  .action(async (options: { config: string; attach: boolean }) => {
    await startArena({
      configPath: options.config,
      attach: options.attach,
      cliPath
    });
  });

program
  .command("claim")
  .description("Claim victory for an agent and run the verifier.")
  .requiredOption("--run <id>", "Run id.")
  .requiredOption("--agent <id>", "Agent id.")
  .option("--state <path>", "Direct path to state.json.")
  .action(async (options: { run: string; agent: string; state?: string }) => {
    const claim = await claimRun({
      runId: options.run,
      agentId: options.agent,
      statePath: options.state
    });
    console.log(`${claim.agentId}: ${claim.status}`);
    if (claim.note) {
      console.log(claim.note);
    }
    if (claim.stdout.trim()) {
      console.log(claim.stdout.trim());
    }
    if (claim.stderr.trim()) {
      console.error(claim.stderr.trim());
    }
    process.exitCode = claim.status === "failed" ? 1 : 0;
  });

program
  .command("status")
  .description("Print run status.")
  .requiredOption("--run <id>", "Run id.")
  .option("--state <path>", "Direct path to state.json.")
  .option("--json", "Print JSON state.", false)
  .action(async (options: { run: string; state?: string; json: boolean }) => {
    await printStatus(options.run, options.state, options.json);
  });

program
  .command("mirror-daemon", { hidden: true })
  .requiredOption("--run <id>", "Run id.")
  .option("--state <path>", "Direct path to state.json.")
  .action(async (options: { run: string; state?: string }) => {
    await runMirrorDaemon(options.run, options.state);
  });

program.parseAsync().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
