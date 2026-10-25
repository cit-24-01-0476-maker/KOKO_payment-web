import { it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { seed, total, rows } from "../lib/engine";
it("exports the canonical fixture for Supabase and verifies its total", () => {
  const s = seed();
  expect(total(s)).toBe(8267997);
  writeFileSync("supabase/seed.json", JSON.stringify(s, null, 2));
  const q = (v: string) => "'" + v.replaceAll("'", "''") + "'";
  let sql =
    "-- Run after migration with a signed-in Supabase user. Rolls back if no auth identity exists.\nbegin;\ndo $$\ndeclare w uuid;\nbegin\nif auth.uid() is null then raise exception 'A signed-in owner is required'; end if;\ninsert into public.workspaces(owner_id) values(auth.uid()) returning id into w;\n";
  for (const p of [
    { id: "thiranji", name: "Thiranji", color: "#b898ff" },
    { id: "oshadha", name: "Oshadha", color: "#51d9e9" },
    { id: "ayesh", name: "Ayesh", color: "#f6bd62" },
    { id: "supun", name: "Supun", color: "#70d9a0" },
  ])
    sql += `insert into public.people values(w,${q(p.id)},${q(p.name)},${q(p.color)});\n`;
  for (const p of s.plans) {
    sql += `insert into public.plans values(w,${q(p.id)},${q(p.merchant)});\n`;
    for (const i of p.installments) {
      sql += `insert into public.installments(workspace_id,id,plan_id,due_date,number) values(w,${q(i.id)},${q(p.id)},${q(i.date)},${i.number});\n`;
      for (const a of i.allocations)
        sql += `insert into public.allocations values(w,${q(a.id)},${q(i.id)},${q(a.person)},${a.cents});\n`;
    }
  }
  sql += "end$$;\ncommit;\n";
  writeFileSync("supabase/seed.sql", sql);
  expect(rows(s)).toHaveLength(39);
});
