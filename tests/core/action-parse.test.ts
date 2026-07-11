import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseActionSyntax, LABEL_TO_ACTION } from "$lib/core/action-parse";

describe("action-parse", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parseActionSyntax extracts A/B/C options and strips trailing syntax", () => {
    const fallback = ["resolve", "delegate"] as const;
    const result = parseActionSyntax(
      "Noema QA timeout → [A: Csak build+test|B: Timeout 900s|C: V4 Pro modell]",
      [...fallback],
    );
    expect(result.cleanText).toBe("Noema QA timeout");
    expect(result.actions).toEqual([]);
    expect(result.options).toEqual([
      { key: "option_a", label: "A: Csak build+test" },
      { key: "option_b", label: "B: Timeout 900s" },
      { key: "option_c", label: "C: V4 Pro modell" },
    ]);
  });

  it("parseActionSyntax falls back when syntax is absent", () => {
    const fallback = ["resolve", "delegate"] as const;
    const result = parseActionSyntax("Plain item text", [...fallback]);
    expect(result.cleanText).toBe("Plain item text");
    expect(result.actions).toEqual(fallback);
    expect(result.options).toEqual([]);
  });

  it("parseActionSyntax falls back when labels use legacy format without colons", () => {
    const fallback = ["resolve", "investigate"] as const;
    const result = parseActionSyntax(
      "8x8 appeal follow-up → [Done|Escalate|Keep]",
      [...fallback],
    );
    expect(result.cleanText).toBe("8x8 appeal follow-up");
    expect(result.actions).toEqual(fallback);
    expect(result.options).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("parseActionSyntax falls back when option letter is invalid", () => {
    const fallback = ["resolve"] as const;
    const result = parseActionSyntax("Item → [AB: Bad|B: Good]", [...fallback]);
    expect(result.cleanText).toBe("Item");
    expect(result.actions).toEqual(fallback);
    expect(result.options).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("parseActionSyntax falls back when more than 5 options", () => {
    const fallback = ["resolve", "delegate"] as const;
    const result = parseActionSyntax(
      "Item → [A: One|B: Two|C: Three|D: Four|E: Five|F: Six]",
      [...fallback],
    );
    expect(result.cleanText).toBe("Item");
    expect(result.actions).toEqual(fallback);
    expect(result.options).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("parseActionSyntax falls back when options list is empty after parse", () => {
    const fallback = ["resolve"] as const;
    const result = parseActionSyntax("Item → [|||]", [...fallback]);
    expect(result.cleanText).toBe("Item");
    expect(result.actions).toEqual(fallback);
    expect(result.options).toEqual([]);
  });

  it("parseActionSyntax accepts lowercase option letters", () => {
    const result = parseActionSyntax("Pick → [a: First|b: Second]", ["resolve"]);
    expect(result.options).toEqual([
      { key: "option_a", label: "A: First" },
      { key: "option_b", label: "B: Second" },
    ]);
  });

  it("LABEL_TO_ACTION covers legacy dashboard action labels", () => {
    expect(LABEL_TO_ACTION.implement).toBe("implement");
    expect(LABEL_TO_ACTION.done).toBe("done");
    expect(LABEL_TO_ACTION.escalate).toBe("escalate");
    expect(LABEL_TO_ACTION.restart).toBe("restart");
    expect(LABEL_TO_ACTION.trigger).toBe("trigger");
    expect(LABEL_TO_ACTION.investigate).toBe("investigate");
    expect(LABEL_TO_ACTION.activate).toBe("activate");
    expect(LABEL_TO_ACTION.paid).toBe("paid");
    expect(LABEL_TO_ACTION.mehet).toBe("implement");
  });
});
