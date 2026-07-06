import { describe, it, expect } from "vitest";
import { parseActionSyntax, LABEL_TO_ACTION } from "$lib/core/action-parse";

describe("action-parse", () => {
  it("parseActionSyntax extracts multiple actions from trailing syntax", () => {
    const result = parseActionSyntax(
      "8x8 appeal follow-up → [Done|Escalate|Keep]",
      ["done"],
    );
    expect(result.cleanText).toBe("8x8 appeal follow-up");
    expect(result.actions).toEqual(["done", "escalate"]);
  });

  it("parseActionSyntax accepts Mehet as implement alias", () => {
    const result = parseActionSyntax("New tab → [Mehet|Done]", ["implement"]);
    expect(result.actions).toEqual(["implement", "done"]);
  });

  it("parseActionSyntax falls back when syntax is absent", () => {
    const fallback = ["done", "escalate"] as const;
    const result = parseActionSyntax("Plain item text", [...fallback]);
    expect(result.cleanText).toBe("Plain item text");
    expect(result.actions).toEqual(fallback);
  });

  it("parseActionSyntax falls back when all labels are unknown", () => {
    const result = parseActionSyntax("Item → [Abandon|Skip]", ["done"]);
    expect(result.cleanText).toBe("Item");
    expect(result.actions).toEqual(["done"]);
  });

  it("LABEL_TO_ACTION covers all 8 dashboard action types", () => {
    expect(LABEL_TO_ACTION.implement).toBe("implement");
    expect(LABEL_TO_ACTION.done).toBe("done");
    expect(LABEL_TO_ACTION.escalate).toBe("escalate");
    expect(LABEL_TO_ACTION.restart).toBe("restart");
    expect(LABEL_TO_ACTION.trigger).toBe("trigger");
    expect(LABEL_TO_ACTION.investigate).toBe("investigate");
    expect(LABEL_TO_ACTION.activate).toBe("activate");
    expect(LABEL_TO_ACTION.paid).toBe("paid");
  });
});
