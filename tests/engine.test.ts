import { describe, it, expect } from "vitest";
import {
  seed,
  rows,
  total,
  settle,
  remaining,
  reverse,
  edit,
  paid,
  status,
  validate,
  parseMoney,
  savePlan,
} from "../lib/engine";
const cents = [1143120, 2785592, 2479340, 1859945];
describe("OSKA DUE financial acceptance", () => {
  it("01: nine plans, 35 unique installments, 39 allocations", () => {
    const s = seed();
    expect(s.plans).toHaveLength(9);
    expect(s.plans.flatMap((p) => p.installments)).toHaveLength(35);
    expect(rows(s)).toHaveLength(39);
    expect(new Set(rows(s).map((a) => a.id)).size).toBe(39);
  });
  it("02: initial outstanding is exactly Rs 82,679.97", () =>
    expect(total(seed())).toBe(8267997));
  it("03: all four person totals", () =>
    ["thiranji", "oshadha", "ayesh", "supun"].forEach((p, i) =>
      expect(total(seed(), p)).toBe(cents[i]),
    ));
  it("04: all five month totals", () =>
    ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].forEach((m, i) =>
      expect(total(seed(), "", m)).toBe(
        [920574, 3825504, 1346164, 1346164, 829591][i],
      ),
    ));
  it("05: all twenty person-month fixtures", () => {
    const s = seed();
    const fixtures = [
      [203630, 344955, 0, 371989],
      [274120, 700055, 2479340, 371989],
      [274120, 700055, 0, 371989],
      [274120, 700055, 0, 371989],
      [117130, 340472, 0, 371989],
    ];
    ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].forEach((m, j) =>
      ["thiranji", "oshadha", "ayesh", "supun"].forEach((p, i) =>
        expect(total(s, p, m)).toBe(fixtures[j][i]),
      ),
    );
  });
  it("06: full settlement deducts exact cents", () => {
    const s = seed(),
      a = rows(s)[0];
    const next = settle(s, a.id, a.cents, "pay");
    expect(total(next)).toBe(8267997 - a.cents);
    expect(remaining(next, a.id)).toBe(0);
    expect(status(next, a.id)).toBe("Fully Paid");
  });
  it("07: shared Thiranji settlement does not settle Oshadha", () => {
    const s = seed(),
      a = rows(s).find(
        (a) => a.planId === "PRASAD-1227-SHARED" && a.person === "thiranji",
      )!;
    const n = settle(s, a.id, a.cents, "shared");
    expect(total(n, "oshadha")).toBe(2785592);
    expect(total(n, "thiranji")).toBe(1143120 - 86500);
  });
  it("08: shared Oshadha settlement independent", () => {
    const s = seed(),
      a = rows(s).find(
        (a) => a.planId === "PRASAD-1227-SHARED" && a.person === "oshadha",
      )!;
    expect(total(settle(s, a.id, a.cents, "shared"), "thiranji")).toBe(1143120);
  });
  it("09: partial payment and status", () => {
    const s = seed(),
      a = rows(s)[0],
      n = settle(s, a.id, 12345, "partial");
    expect(remaining(n, a.id)).toBe(a.cents - 12345);
    expect(status(n, a.id)).toBe("Partially Paid");
  });
  it("10: successive partials fully settle", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, 100, "one");
    s = settle(s, a.id, a.cents - 100, "two");
    expect(remaining(s, a.id)).toBe(0);
  });
  it("11: reversal restores all balances and preserves audit", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, a.cents, "p");
    s = reverse(s, "p", "r");
    expect(total(s)).toBe(8267997);
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions[1].reverses).toBe("p");
  });
  it("12: edits atomically reverse and replace", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, 10000, "p");
    s = edit(s, "p", 5000, "e");
    expect(paid(s, a.id)).toBe(5000);
    expect(s.transactions).toHaveLength(3);
    expect(() => edit(s, "e", 99999999, "bad")).toThrow();
    expect(paid(s, a.id)).toBe(5000);
  });
  it("13: same request key is idempotent", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, 1000, "same");
    expect(settle(s, a.id, 1000, "same")).toBe(s);
  });
  it("14: overpayment, negative, zero, fractional and NaN rejected", () => {
    const s = seed(),
      a = rows(s)[0];
    for (const v of [a.cents + 1, -1, 0, 1.5, NaN])
      expect(() => settle(s, a.id, v, "x")).toThrow();
  });
  it("15: duplicate full payment and duplicate reversal rejected", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, a.cents, "p");
    expect(() => settle(s, a.id, a.cents, "other")).toThrow();
    s = reverse(s, "p", "r");
    expect(() => reverse(s, "p", "r2")).toThrow();
  });
  it("16: Koko state independent from person settlement", () => {
    let s = seed();
    const a = rows(s)[0];
    s.koko[a.installmentId] = true;
    expect(total(s)).toBe(8267997);
    s = settle(s, a.id, a.cents, "p");
    expect(s.koko[a.installmentId]).toBe(true);
    const b = rows(s)[1];
    s = settle(s, b.id, b.cents, "q");
    expect(s.koko[b.installmentId]).toBeUndefined();
  });
  it("17: JSON persistence roundtrip and corrupt data rejection", () => {
    let s = seed();
    s = settle(s, rows(s)[0].id, 1234, "p");
    const restored = validate(JSON.parse(JSON.stringify(s)));
    expect(total(restored)).toBe(8267997 - 1234);
    expect(() => validate({ ...s, version: 2 } as never)).toThrow();
    expect(() =>
      validate({
        ...s,
        transactions: [
          ...s.transactions,
          { ...s.transactions[0], cents: -100, reverses: "missing", id: "bad" },
        ],
      }),
    ).toThrow();
  });
  it("19: a reversed full settlement may be paid again", () => {
    let s = seed();
    const a = rows(s)[0];
    s = settle(s, a.id, a.cents, "full-" + a.id + "-" + s.revision);
    s = reverse(s, s.transactions[0].id, "undo");
    s = settle(s, a.id, a.cents, "full-" + a.id + "-" + s.revision);
    expect(remaining(s, a.id)).toBe(0);
    expect(s.transactions).toHaveLength(3);
  });
  it("18: overdue dates, exact parsing and protected purchase edits", () => {
    const s = seed(),
      a = rows(s)[0];
    expect(status(s, a.id, "2026-10-25")).toBe("Unpaid");
    expect(status(s, a.id, "2027-01-01")).toBe("Overdue");
    expect(parseMoney("1227.83")).toBe(122783);
    expect(() => parseMoney("0.001")).toThrow();
    const n = settle(s, a.id, 100, "p");
    expect(() => savePlan(n, s.plans[0], s.plans[0].id)).toThrow();
  });
});
