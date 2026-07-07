import type { AgentData, AgentLogSnippet, LogEntry } from "$lib/types";

/** Pick the last N log lines that mention an agent id or display name. */
export function filterLogsForAgent(
  entries: LogEntry[],
  agentId: string,
  agentName: string,
  limit = 3,
): AgentLogSnippet[] {
  const idLower = agentId.toLowerCase();
  const nameLower = agentName.toLowerCase();
  const matched: AgentLogSnippet[] = [];

  for (let i = entries.length - 1; i >= 0 && matched.length < limit; i--) {
    const entry = entries[i];
    if (!entry) continue;
    const hay = entry.raw.toLowerCase();
    if (!hay.includes(idLower) && !hay.includes(nameLower)) continue;

    matched.push({
      message: entry.message,
      timestamp: entry.timestamp,
      level: entry.level,
    });
  }

  return matched;
}

/** Attach recent log snippets to each agent card (memory comes from getAgents). */
export function enrichAgentsData(
  agentData: AgentData,
  logEntries: LogEntry[],
): AgentData {
  if (agentData.error || agentData.agents.length === 0) return agentData;

  return {
    ...agentData,
    agents: agentData.agents.map((agent) => ({
      ...agent,
      recentLogs: filterLogsForAgent(logEntries, agent.id, agent.name),
    })),
  };
}
