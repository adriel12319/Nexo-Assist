import { describe, expect, it } from "vitest";
import { addBusinessHours, classifyPriority, dueDate } from "./sla";

// Horários em UTC; 11:00Z = 08:00 em Brasília.
describe("addBusinessHours", () => {
  it("adds within the same business day", () => {
    const start = new Date("2026-10-27T13:00:00Z"); // terça, 10:00
    expect(addBusinessHours(start, 4).toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });

  it("rolls over to the next business day after 18h", () => {
    const start = new Date("2026-10-27T19:00:00Z"); // terça, 16:00
    expect(addBusinessHours(start, 4).toISOString()).toBe("2026-10-28T13:00:00.000Z");
  });

  it("skips weekends", () => {
    const start = new Date("2026-10-30T20:00:00Z"); // sexta, 17:00
    expect(addBusinessHours(start, 2).toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });

  it("starts counting at opening time when created at night", () => {
    const start = new Date("2026-10-28T02:00:00Z"); // terça, 23:00
    expect(addBusinessHours(start, 1).toISOString()).toBe("2026-10-28T12:00:00.000Z");
  });
});

describe("dueDate", () => {
  it("uses wall-clock time for critical tickets", () => {
    const start = new Date("2026-10-31T23:00:00Z"); // sábado
    expect(dueDate("critica", start).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("counts three business days for medium priority", () => {
    const start = new Date("2026-10-27T13:00:00Z");
    expect(dueDate("media", start).toISOString()).toBe("2026-10-30T13:00:00.000Z");
  });
});

describe("classifyPriority", () => {
  it.each([
    [{ type: "INC", impact: "equipe", blocksWork: true, deadlineToday: false }, "critica"],
    [{ type: "INC", impact: "empresa", blocksWork: true, deadlineToday: false }, "critica"],
    [{ type: "INC", impact: "individual", blocksWork: true, deadlineToday: false }, "alta"],
    [{ type: "INC", impact: "individual", blocksWork: false, deadlineToday: true }, "alta"],
    [{ type: "INC", impact: "equipe", blocksWork: false, deadlineToday: false }, "media"],
    [{ type: "REQ", impact: "individual", blocksWork: false, deadlineToday: false }, "baixa"],
  ] as const)("%o → %s", (input, expected) => {
    expect(classifyPriority(input).priority).toBe(expected);
  });
});
