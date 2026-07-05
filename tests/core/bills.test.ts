import { describe, it, expect } from "vitest";
import { getBills } from "$lib/core/bills";
import { parseMarkdownTable } from "$lib/core/utils";
import { createMockProviders } from "./mock-providers";

describe("bills", () => {
  it("parseMarkdownTable extracts open loop rows", () => {
    const md = `## 🔓 Open Loops
| ID | Desc | Owner | Last | Status |
|---|---|---|---|---|
| OL-001 | Test | Alfred | 2026-07-01 | 🟢 |`;
    const rows = parseMarkdownTable(md, "Open Loops");
    expect(rows.length).toBe(1);
    expect(rows[0]?.[0]).toBe("OL-001");
  });

  it("getBills parses bills and open loops via filesystem provider", async () => {
    const data = await getBills(createMockProviders());
    expect(data.bills.length).toBe(1);
    expect(data.bills[0]?.desc).toContain("Ft");
    expect(data.openLoops.length).toBe(1);
    expect(data.openLoops[0]?.id).toBe("OL-001");
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getBills handles provider errors", async () => {
    const mock = createMockProviders({
      filesystem: {
        readMemory: async () => {
          throw new Error("tasks missing");
        },
        writeMemory: async () => {},
        readAgentStatus: async (id) => ({ agentId: id, content: "", path: "" }),
        readState: async () => "",
        readResearch: async () => "",
      },
    });
    const data = await getBills(mock);
    expect(data.error).toContain("tasks missing");
  });
});
