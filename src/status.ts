import { readRunState, resolveStatePath } from "./run-state.js";

export async function printStatus(runId: string, statePath?: string, json = false): Promise<void> {
  const resolved = await resolveStatePath(runId, statePath);
  const state = await readRunState(resolved);

  if (json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  console.log(`Run: ${state.runId}`);
  console.log(`Status: ${state.status}`);
  console.log(`Goal: ${state.goal}`);
  console.log(`Verifier: ${state.verifyCommand}`);
  console.log(`State: ${state.statePath}`);
  console.log(`tmux: ${state.tmux.sessionName}`);
  console.log("");
  console.log("Agents:");
  for (const agent of state.agents) {
    console.log(`- ${agent.id}: ${agent.name}`);
    console.log(`  workspace: ${agent.workspace}`);
    console.log(`  rival: ${agent.rivalDir}`);
    console.log(`  claim: ${agent.claimCommand}`);
  }

  console.log("");
  if (state.winner) {
    console.log(`Winner: ${state.winner.agentId} (${state.winner.elapsedMs}ms)`);
  } else {
    console.log("Winner: none yet");
  }

  console.log("");
  console.log("Claims:");
  if (state.claims.length === 0) {
    console.log("- none");
  } else {
    for (const claim of state.claims) {
      console.log(`- ${claim.agentId}: ${claim.status} at ${claim.verifiedAt ?? claim.claimedAt}`);
    }
  }
}
