import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type { H1Data } from "$lib/types";

export async function getH1Data(providers?: AllProviders): Promise<H1Data> {
  const p = providers ?? getProvider();

  try {
    const [atAGlance, balance] = await Promise.all([
      p.filesystem.readMemory("at-a-glance.md").catch(() => ""),
      p.tool.h1Command("balance").catch(() => ""),
    ]);

    const hs =
      atAGlance.match(/📊 H1 Dashboard[\s\S]*?(?=\n## |\n---|$)/)?.[0] ??
      atAGlance;
    const open =
      hs.match(/\|\s*Open\s*\|\s*(\d+)/)?.[1] ??
      hs.match(/(\d+)\s+Open/)?.[1] ??
      atAGlance.match(/(\d+)\s+Open/)?.[1] ??
      "?";
    const signal =
      atAGlance.match(/Signal[\s:]+([-0-9.]+)/)?.[1] ??
      atAGlance.match(/Signal\s*\|\s*([-0-9.]+)/)?.[1] ??
      "?";
    const reputation =
      atAGlance.match(/Reputation[\s:]+(\d+)/)?.[1] ??
      atAGlance.match(/Reputation\s*\|\s*(\d+)/)?.[1] ??
      "?";
    const trial =
      atAGlance.match(/Trial\s*\|\s*(\d+)/)?.[1] ??
      atAGlance.match(/trial reports?:?\s*(\d+)/i)?.[1] ??
      "0";

    let programs = "⛔ Signal limited programs";
    try {
      const scoutStatus = await p.filesystem.readAgentStatus("scout");
      const rows = scoutStatus.content
        .split("\n")
        .filter(
          (l) =>
            l.match(/^\|.*\|.*\|/) && !l.includes("---") && !l.includes("Type"),
        );
      if (rows.length > 0) programs = `${rows.length} accessible programs`;
    } catch {
      /* keep default */
    }

    return {
      stats: {
        open,
        signal,
        reputation,
        trial,
        totalReports: parseInt(open, 10) || 0,
      },
      balance: balance.trim() || "unknown",
      programs,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      stats: {
        open: "?",
        signal: "?",
        reputation: "?",
        trial: "0",
        totalReports: 0,
      },
      balance: "unknown",
      programs: "unknown",
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
