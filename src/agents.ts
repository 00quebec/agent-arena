import { agentPresets, resolveAgentCommand } from "./presets.js";
import { commandExists, extractCommandBinary } from "./shell.js";
import type { ArenaConfig } from "./types.js";

export function listAgents(): void {
  for (const preset of Object.values(agentPresets)) {
    console.log(`${preset.id}`);
    console.log(`  name: ${preset.displayName}`);
    console.log(`  binary: ${preset.binary}`);
    console.log(`  command: ${preset.defaultCommand}`);
    console.log(`  docs: ${preset.docsUrl}`);
    console.log(`  install: ${preset.installHint}`);
    console.log("");
  }
}

export function doctorAgents(config?: ArenaConfig): boolean {
  const checks = config
    ? config.agents.map((agent) => {
        const command = resolveAgentCommand(agent);
        return {
          id: agent.id,
          binary: agent.preset ? agentPresets[agent.preset].binary : extractCommandBinary(command) ?? command
        };
      })
    : Object.values(agentPresets).map((preset) => ({
        id: preset.id,
        binary: preset.binary
      }));

  let allFound = true;
  for (const check of checks) {
    const found = commandExists(check.binary);
    allFound &&= found;
    console.log(`${found ? "ok" : "missing"} ${check.id}: ${check.binary}`);
  }

  return allFound;
}
