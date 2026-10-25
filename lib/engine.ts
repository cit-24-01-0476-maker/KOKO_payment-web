export const people = [
  { id: "thiranji", name: "Thiranji", color: "#b898ff" },
  { id: "oshadha", name: "Oshadha", color: "#51d9e9" },
  { id: "ayesh", name: "Ayesh", color: "#f6bd62" },
  { id: "supun", name: "Supun", color: "#70d9a0" },
];
export type Allocation = { id: string; person: string; cents: number };
export type Installment = {
  id: string;
  date: string;
  number: number;
  allocations: Allocation[];
};
export type Plan = {
  id: string;
  merchant: string;
  installments: Installment[];
};
export type Transaction = {
  id: string;
  allocationId: string;
  cents: number;
  at: string;
  reverses?: string;
};
export type State = {
  version: 1;
  revision: number;
  plans: Plan[];
  transactions: Transaction[];
  koko: Record<string, boolean>;
  imports: string[];
};
const dates = [
  "2026-10-30",
  "2026-11-29",
  "2026-12-29",
  "2027-01-28",
  "2027-02-27",
];
export function seed(): State {
  const specs: [string, string, string[], number, Record<string, number>][] = [
    [
      "PRASAD-704",
      "Prasad Fashion Sq.",
      ["2026-11-11", "2026-12-11", "2027-01-10"],
      4,
      { thiranji: 70490 },
    ],
    [
      "VEHICLE-3233",
      "Vehicle Accessories",
      ["2026-11-12", "2026-12-12", "2027-01-11"],
      4,
      { oshadha: 323300 },
    ],
    [
      "DIGITAL-318",
      "Digital Cellular",
      ["2026-11-16", "2026-12-16", "2027-01-15", "2027-02-14"],
      3,
      { oshadha: 31800 },
    ],
    ["MUVE-24793", "Muvestore.lk", ["2026-11-18"], 6, { ayesh: 2479340 }],
    ["MD-2176-SUPUN", "MD Computers.lk", dates, 2, { supun: 217653 }],
    ["MD-3086-OSHADHA", "MD Computers.lk", dates, 2, { oshadha: 308672 }],
    ["MD-1543-SUPUN", "MD Computers.lk", dates, 2, { supun: 154336 }],
    ["PRASAD-1171", "Prasad Fashion Sq.", dates, 2, { thiranji: 117130 }],
    [
      "PRASAD-1227-SHARED",
      "Prasad Fashion Sq.",
      ["2026-10-31", "2026-11-30", "2026-12-30", "2027-01-29"],
      3,
      { thiranji: 86500, oshadha: 36283 },
    ],
  ];
  return {
    version: 1,
    revision: 0,
    plans: specs.map(([id, merchant, ds, start, split]) => ({
      id,
      merchant,
      installments: ds.map((date, i) => ({
        id: `${id}-${start + i}`,
        date,
        number: start + i,
        allocations: Object.entries(split).map(([person, cents]) => ({
          id: `${id}-${start + i}-${person}`,
          person,
          cents,
        })),
      })),
    })),
    transactions: [],
    koko: {},
    imports: [],
  };
}
export function rows(s: State) {
  return s.plans.flatMap((p) =>
    p.installments.flatMap((i) =>
      i.allocations.map((a) => ({
        ...a,
        planId: p.id,
        merchant: p.merchant,
        date: i.date,
        installmentId: i.id,
        number: i.number,
      })),
    ),
  );
}
export function paid(s: State, id: string) {
  return s.transactions
    .filter((t) => t.allocationId === id)
    .reduce((v, t) => v + t.cents, 0);
}
export function remaining(s: State, id: string) {
  const a = rows(s).find((a) => a.id === id);
  if (!a) throw Error("Allocation not found");
  return a.cents - paid(s, id);
}
export function total(s: State, person = "", month = "") {
  return rows(s)
    .filter(
      (a) =>
        (!person || a.person === person) &&
        (!month || a.date.startsWith(month)),
    )
    .reduce((v, a) => v + remaining(s, a.id), 0);
}
export function status(
  s: State,
  id: string,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }),
) {
  const a = rows(s).find((a) => a.id === id)!;
  const left = remaining(s, id);
  return left === 0
    ? "Fully Paid"
    : paid(s, id) > 0
      ? "Partially Paid"
      : a.date < today
        ? "Overdue"
        : "Unpaid";
}
export function settle(
  s: State,
  id: string,
  cents: number,
  key: string,
): State {
  if (s.transactions.some((t) => t.id === key)) return s;
  if (
    !key ||
    !Number.isSafeInteger(cents) ||
    cents <= 0 ||
    cents > remaining(s, id)
  )
    throw Error("Enter a positive amount within the outstanding balance");
  return {
    ...s,
    revision: s.revision + 1,
    transactions: [
      ...s.transactions,
      { id: key, allocationId: id, cents, at: new Date().toISOString() },
    ],
  };
}
export function reverse(s: State, id: string, key: string): State {
  if (s.transactions.some((t) => t.id === key)) return s;
  const t = s.transactions.find((t) => t.id === id);
  if (!t || t.cents <= 0 || s.transactions.some((x) => x.reverses === id))
    throw Error("Settlement already reversed or unavailable");
  return {
    ...s,
    revision: s.revision + 1,
    transactions: [
      ...s.transactions,
      {
        id: key,
        allocationId: t.allocationId,
        cents: -t.cents,
        at: new Date().toISOString(),
        reverses: id,
      },
    ],
  };
}
export function edit(s: State, id: string, cents: number, key: string): State {
  if (s.transactions.some((t) => t.id === key)) return s;
  const t = s.transactions.find((t) => t.id === id);
  if (!t) throw Error("Settlement not found");
  const undone = reverse(s, id, key + "-reverse");
  return settle(undone, t.allocationId, cents, key);
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(cents / 100);
}
export function parseMoney(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw Error("Use an amount with at most two decimal places");
  const [a, b = ""] = value.trim().split(".");
  const cents = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw Error("Amount must be positive");
  return cents;
}
export function validate(s: State): State {
  if (
    s.version !== 1 ||
    !Number.isInteger(s.revision) ||
    !Array.isArray(s.plans) ||
    !Array.isArray(s.transactions) ||
    !s.koko ||
    !Array.isArray(s.imports)
  )
    throw Error("Invalid saved data");
  const ids = new Set<string>();
  for (const p of s.plans) {
    if (!p.id || !p.merchant || !Array.isArray(p.installments) || ids.has(p.id))
      throw Error("Invalid plan");
    ids.add(p.id);
    for (const i of p.installments) {
      if (
        ids.has(i.id) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(i.date) ||
        !Array.isArray(i.allocations) ||
        !i.allocations.length
      )
        throw Error("Invalid installment");
      ids.add(i.id);
      for (const a of i.allocations) {
        if (
          ids.has(a.id) ||
          !people.some((p) => p.id === a.person) ||
          !Number.isSafeInteger(a.cents) ||
          a.cents <= 0
        )
          throw Error("Invalid allocation");
        ids.add(a.id);
      }
    }
  }
  const tx = new Set<string>();
  let replay: State = { ...s, transactions: [] };
  for (const t of s.transactions) {
    if (
      !t.id ||
      tx.has(t.id) ||
      !Number.isSafeInteger(t.cents) ||
      !t.cents ||
      !Number.isFinite(Date.parse(t.at))
    )
      throw Error("Invalid transaction");
    tx.add(t.id);
    remaining(replay, t.allocationId);
    if (t.cents < 0) {
      const original = replay.transactions.find((x) => x.id === t.reverses);
      if (
        !original ||
        original.cents <= 0 ||
        original.allocationId !== t.allocationId ||
        original.cents !== -t.cents ||
        replay.transactions.some((x) => x.reverses === original.id)
      )
        throw Error("Invalid reversal");
    } else if (t.reverses) throw Error("Invalid reversal");
    replay = { ...replay, transactions: [...replay.transactions, t] };
    if (
      remaining(replay, t.allocationId) < 0 ||
      paid(replay, t.allocationId) < 0
    )
      throw Error("Invalid balance");
  }
  return s;
}
export function savePlan(s: State, plan: Plan, original?: string): State {
  if (
    original &&
    s.transactions.some((t) =>
      s.plans
        .find((p) => p.id === original)
        ?.installments.some((i) =>
          i.allocations.some((a) => a.id === t.allocationId),
        ),
    )
  )
    throw Error("Plans with payment history cannot be edited");
  if (s.plans.some((p) => p.id === plan.id && p.id !== original))
    throw Error("Duplicate purchase ID");
  return validate({
    ...s,
    revision: s.revision + 1,
    plans: [...s.plans.filter((p) => p.id !== original), plan],
  });
}
