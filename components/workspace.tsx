"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingBag,
  History,
  ScanLine,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Check,
  Plus,
  Download,
  Moon,
  Sun,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  State,
  Plan,
  seed,
  people,
  rows,
  total,
  paid,
  remaining,
  status,
  settle,
  reverse,
  edit,
  money,
  parseMoney,
  validate,
  savePlan,
} from "../lib/engine";
const KEY = "oska-due-v1";
const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/planner", "Payment planner", CalendarDays],
  ["/purchases", "Purchases", ShoppingBag],
  ["/history", "Payment history", History],
  ["/import", "Screenshot import", ScanLine],
  ["/settings", "Settings", Settings],
] as const;
const monthName = (m: string) =>
  new Date(m + "-01T12:00:00").toLocaleDateString("en-LK", {
    month: "long",
    year: "numeric",
  });
const dateName = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
  });
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workspace() {
  const path = usePathname().replace(/^\/KOKO_payment-web(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  const person = path.startsWith("/people/") ? path.split("/")[2] : "";
  const [s, setS] = useState<State>(seed);
  const ref = useRef(s);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [light, setLight] = useState(false);
  const formBusy = useRef(false);
  const [modal, setModal] = useState<{
    id: string;
    tx?: string;
    amount: string;
  } | null>(null);
  const [purchase, setPurchase] = useState<{
    original?: string;
    id: string;
    merchant: string;
    dates: string;
    amount: string;
    person: string;
    split: string;
    start: string;
  } | null>(null);
  const [preview, setPreview] = useState("");
  const [hash, setHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = validate(JSON.parse(raw));
        ref.current = saved;
        setS(saved);
      }
      setLight(localStorage.getItem("oska-theme") === "light");
    } catch {
      setError(
        "Saved data could not be loaded. Export the recovery copy in Settings before restoring a valid JSON backup. Existing data has not been overwritten.",
      );
      setBlocked(true);
    }
    setReady(true);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/KOKO_payment-web/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          const next = validate(JSON.parse(e.newValue));
          ref.current = next;
          setS(next);
        } catch {
          setError("Another tab wrote invalid data. Reload to recover.");
          setBlocked(true);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  async function commit(fn: (v: State) => State) {
    if (!ready || blocked) {
      setError("Storage is unavailable. Restore a valid backup in Settings.");
      return;
    }
    const run = () => {
      try {
        const raw = localStorage.getItem(KEY);
        const current = raw ? validate(JSON.parse(raw)) : ref.current;
        const next = validate(fn(current));
        localStorage.setItem(KEY, JSON.stringify(next));
        ref.current = next;
        setS(next);
        setError("");
        return true;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Unable to save. Your change was not applied.",
        );
        return false;
      }
    };
    return navigator.locks ? navigator.locks.request(KEY, run) : run();
  }
  const all = rows(s);
  const months = [...new Set(all.map((a) => a.date.slice(0, 7)))].sort();
  const selected = all.filter(
    (a) =>
      (!person || a.person === person) &&
      (!filter || a.person === filter) &&
      (!month || a.date.startsWith(month)) &&
      (!search ||
        `${a.merchant} ${a.planId}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const outstanding = total(s, person);
  const initial = all
    .filter((a) => !person || a.person === person)
    .reduce((v, a) => v + a.cents, 0);
  const settled = initial - outstanding;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Colombo",
  });
  const upcoming = all
    .filter((a) => remaining(s, a.id) > 0 && (!person || a.person === person))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pageTitle = person
    ? `${people.find((p) => p.id === person)?.name ?? "Person"}\u2019s dashboard`
    : {
        "/": "Your payments, in perspective.",
        "/planner": "Make room for what\u2019s next.",
        "/purchases": "Every purchase. Every detail.",
        "/history": "A clear record of every payment.",
        "/import": "From screenshot to clarity.",
        "/settings": "Make DUE your own.",
      }[path] || "Page not found";
  const controls = (
    <div className="filters">
      <label>
        Month
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
      </label>
      {!person && (
        <label>
          Person
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Search merchant
        <input
          placeholder="Search purchases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
    </div>
  );
  function allocationTable(data: typeof all) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Purchase / person</th>
              <th>Due date</th>
              <th>Allocation</th>
              <th>Remaining</th>
              <th>Person settlement</th>
              <th>Koko payment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.merchant}</strong>
                  <small>
                    {a.person} | {a.number}/6 | {a.planId}
                  </small>
                </td>
                <td>
                  {dateName(a.date)}
                  <small>{a.date.slice(0, 4)}</small>
                </td>
                <td>{money(a.cents)}</td>
                <td>{money(remaining(s, a.id))}</td>
                <td>
                  <span
                    className={
                      "badge " +
                      status(s, a.id, today).replaceAll(" ", "").toLowerCase()
                    }
                  >
                    {status(s, a.id, today)}
                  </span>
                </td>
                <td>
                  <button
                    className="subtle"
                    onClick={() =>
                      commit((v) => ({
                        ...v,
                        revision: v.revision + 1,
                        koko: {
                          ...v.koko,
                          [a.installmentId]: !v.koko[a.installmentId],
                        },
                      }))
                    }
                  >
                    {s.koko[a.installmentId] ? "Paid to Koko" : "Not paid"}
                  </button>
                </td>
                <td>
                  {remaining(s, a.id) > 0 ? (
                    <div className="actions">
                      <button
                        className="small"
                        onClick={() =>
                          commit((v) =>
                            remaining(v, a.id) === 0
                              ? v
                              : settle(
                                  v,
                                  a.id,
                                  remaining(v, a.id),
                                  "full-" + a.id + "-" + s.revision,
                                ),
                          )
                        }
                      >
                        Mark paid
                      </button>
                      <button
                        className="subtle"
                        onClick={() => setModal({ id: a.id, amount: "" })}
                      >
                        Partial
                      </button>
                    </div>
                  ) : (
                    <Check size={18} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <p className="empty">No installments match these filters.</p>
        )}
      </div>
    );
  }
  function openPlan(plan?: Plan) {
    const a = plan?.installments[0];
    setPurchase({
      original: plan?.id,
      id: plan?.id || "",
      merchant: plan?.merchant || "",
      dates: plan?.installments.map((i) => i.date).join(", ") || "",
      amount: a
        ? String(a.allocations.reduce((v, a) => v + a.cents, 0) / 100)
        : "",
      person: a?.allocations[0].person || "oshadha",
      split:
        a && a.allocations.length > 1
          ? String(a.allocations[0].cents / 100)
          : "",
      start: String(a?.number || 1),
    });
  }
  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!purchase) return;
    try {
      const cents = parseMoney(purchase.amount);
      const split = purchase.split ? parseMoney(purchase.split) : cents;
      if (split > cents) throw Error("Split exceeds installment total");
      const ds = purchase.dates.split(",").map((v) => v.trim());
      if (
        !ds.length ||
        ds.some(
          (d) =>
            !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
            Number.isNaN(Date.parse(d)) ||
            new Date(d).toISOString().slice(0, 10) !== d,
        )
      )
        throw Error("Enter valid dates separated by commas");
      const start = Number(purchase.start);
      if (!Number.isInteger(start) || start < 1 || start + ds.length - 1 > 6)
        throw Error("Installment numbers must be within 1-6");
      const id = purchase.id.trim();
      const plan: Plan = {
        id,
        merchant: purchase.merchant.trim(),
        installments: ds.map((date, i) => ({
          id: `${id}-${start + i}`,
          date,
          number: start + i,
          allocations: [
            {
              id: `${id}-${start + i}-${purchase.person}`,
              person: purchase.person,
              cents: split,
            },
            ...(split < cents
              ? [
                  {
                    id: `${id}-${start + i}-${purchase.person === "oshadha" ? "thiranji" : "oshadha"}`,
                    person:
                      purchase.person === "oshadha" ? "thiranji" : "oshadha",
                    cents: cents - split,
                  },
                ]
              : []),
          ],
        })),
      };
      if (await commit((v) => savePlan(v, plan, purchase.original)))
        setPurchase(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!ready)
    return <div className="loading">OSKA DUE | Loading your workspace...</div>;
  return (
    <div className={light ? "app light" : "app"}>
      <aside>
        <Link href="/" className="brand">
          <span className="brand-icon">
            D<span>+</span>
          </span>
          <span>
            OSKA <b>DUE</b>
            <small>PERSONAL FINANCE, SIMPLIFIED</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-label">
          YOUR PEOPLE <span>04</span>
        </div>
        <div className="people-nav">
          {people.map((p) => (
            <Link key={p.id} href={"/people/" + p.id}>
              <i style={{ background: p.color }} />
              {p.name}
              {p.id === "oshadha" && <small>YOU</small>}
            </Link>
          ))}
        </div>
        <div className="local-note">
          <ShieldCheck size={20} />
          <div>
            Private by design<small>Stored on this device</small>
          </div>
        </div>
        <div className="profile">
          <span className="avatar">OP</span>
          <div>
            Oshadha Perera<small>Personal workspace</small>
          </div>
          <Settings size={16} />
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />{" "}
            <span>
              {person
                ? "People"
                : nav.find((n) => n[0] === path)?.[1] || "Overview"}
            </span>
          </div>
          <div className="header-right">
            <span className="live-dot" /> Local workspace{" "}
            <span className="avatar tiny">OP</span>
          </div>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <p className="eyebrow">
                A LITTLE CLARITY. A LOT OF PEACE OF MIND.
              </p>
              <h1>{pageTitle}</h1>
              <p>Your Payments. Your People. One Dashboard.</p>
            </div>
            <button className="primary" onClick={() => openPlan()}>
              <Plus size={17} /> Add purchase
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {(path === "/" || person) && (
            <>
              <div className="kpis">
                <article className="kpi hero">
                  <div>
                    <span>Total outstanding</span>
                    <Wallet size={19} />
                  </div>
                  <h2>{money(outstanding)}</h2>
                  <small>
                    Across{" "}
                    {person
                      ? new Set(
                          all
                            .filter((a) => a.person === person)
                            .map((a) => a.planId),
                        ).size
                      : s.plans.length}{" "}
                    purchase plans <ArrowUpRight size={13} />
                  </small>
                </article>
                <article className="kpi">
                  <div>
                    <span>Settled so far</span>
                    <ArrowDownLeft size={19} />
                  </div>
                  <h2>{money(settled)}</h2>
                  <small>
                    {initial ? Math.round((settled / initial) * 100) : 0}% of
                    your total commitments
                  </small>
                </article>
                <article className="kpi">
                  <div>
                    <span>Next payment</span>
                    <CalendarDays size={19} />
                  </div>
                  <h2>
                    {upcoming[0]
                      ? money(remaining(s, upcoming[0].id))
                      : "All clear"}
                  </h2>
                  <small>
                    {upcoming[0]
                      ? `${dateName(upcoming[0].date)} | ${upcoming[0].merchant}`
                      : "No outstanding installments"}
                  </small>
                </article>
                <article className="kpi">
                  <div>
                    <span>Open installments</span>
                    <ShoppingBag size={19} />
                  </div>
                  <h2>
                    {new Set(upcoming.map((a) => a.installmentId)).size}
                    <em>
                      {" "}
                      /{" "}
                      {
                        new Set(
                          all
                            .filter((a) => !person || a.person === person)
                            .map((a) => a.installmentId),
                        ).size
                      }
                    </em>
                  </h2>
                  <small>Person settlement tracked independently</small>
                </article>
              </div>
              {!person && (
                <>
                  <div className="section-heading">
                    <h2>
                      Your people <span>4 members</span>
                    </h2>
                    <span>One shared view. Individual balances.</span>
                  </div>
                  <div className="person-grid">
                    {people.map((p) => (
                      <Link
                        href={"/people/" + p.id}
                        className="person-card"
                        key={p.id}
                      >
                        <div>
                          <span
                            className="person-avatar"
                            style={{
                              color: p.color,
                              background: p.color + "18",
                            }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                          <ArrowUpRight size={17} />
                        </div>
                        <h3>
                          {p.name} {p.id === "oshadha" && <small>YOU</small>}
                        </h3>
                        <p>Outstanding balance</p>
                        <h2>{money(total(s, p.id))}</h2>
                        <div className="progress">
                          <span
                            style={{
                              width: `${
                                (100 * total(s, p.id)) /
                                Math.max(
                                  1,
                                  all
                                    .filter((a) => a.person === p.id)
                                    .reduce((v, a) => v + a.cents, 0),
                                )
                              }%`,
                              background: p.color,
                            }}
                          />
                        </div>
                        <small>
                          {
                            all.filter(
                              (a) =>
                                a.person === p.id && remaining(s, a.id) > 0,
                            ).length
                          }{" "}
                          allocations remaining <ChevronRight size={13} />
                        </small>
                      </Link>
                    ))}
                  </div>
                </>
              )}
              <div className="chart-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>The months ahead</h2>
                      <p>Your outstanding commitments, month by month.</p>
                    </div>
                    <span className="badge">LKR</span>
                  </div>
                  <div
                    className="chart"
                    role="img"
                    aria-label="Outstanding amount by month"
                  >
                    <ResponsiveContainer width="100%" height={245}>
                      <BarChart
                        data={months.map((m) => ({
                          name: monthName(m).slice(0, 3),
                          amount: total(s, person, m) / 100,
                        }))}
                      >
                        <CartesianGrid vertical={false} stroke="#ffffff0b" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#93a0b2", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#93a0b2", fontSize: 11 }}
                          tickFormatter={(v) => `${v / 1000}k`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#202a36",
                            border: "1px solid #465165",
                            borderRadius: 10,
                            color: "#fff",
                          }}
                          formatter={(v) => money(Math.round(Number(v) * 100))}
                        />
                        <Bar
                          dataKey="amount"
                          fill="#b9ed83"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <details>
                    <summary>Show the numbers</summary>
                    {months.map((m) => (
                      <p key={m}>
                        {monthName(m)}: {money(total(s, person, m))}
                      </p>
                    ))}
                  </details>
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Coming up next</h2>
                      <p>A little planning goes a long way.</p>
                    </div>
                    <CalendarDays size={18} />
                  </div>
                  {upcoming.slice(0, 4).map((a) => (
                    <div className="timeline" key={a.id}>
                      <span className="date-tile">{dateName(a.date)}</span>
                      <div>
                        <strong>{a.merchant}</strong>
                        <small>
                          {a.person} | Installment {a.number}/6
                        </small>
                      </div>
                      <b>{money(remaining(s, a.id))}</b>
                    </div>
                  ))}
                  <Link className="text-link" href="/planner">
                    See payment planner <ArrowUpRight size={15} />
                  </Link>
                </section>
              </div>
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    {person ? "Your installments" : "All payment commitments"}
                  </h2>
                  <span>{selected.length} allocations</span>
                </div>
                {controls}
                {allocationTable(selected)}
              </section>
            </>
          )}
          {path === "/planner" && (
            <>
              <section className="panel">
                {controls}
                <div className="section-heading">
                  <h2>{month ? monthName(month) : "All scheduled payments"}</h2>
                  <button onClick={() => setCalendar(!calendar)}>
                    {calendar ? "List view" : "Calendar view"}
                  </button>
                </div>
                <div className="person-grid">
                  {people.map((p) => (
                    <div key={p.id}>
                      <small style={{ color: p.color }}>{p.name}</small>
                      <h2>{money(total(s, p.id, month))}</h2>
                    </div>
                  ))}
                </div>
                {calendar ? (
                  <>
                    <p className="muted">
                      Select a month to view its calendar.
                    </p>
                    {month && (
                      <div className="calendar">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (d) => (
                            <strong className="weekday" key={d}>
                              {d}
                            </strong>
                          ),
                        )}
                        {Array.from(
                          { length: new Date(month + "-01T12:00:00").getDay() },
                          (_, i) => (
                            <div className="calendar-blank" key={"blank" + i} />
                          ),
                        )}
                        {Array.from(
                          {
                            length: new Date(
                              Number(month.slice(0, 4)),
                              Number(month.slice(5)),
                              0,
                            ).getDate(),
                          },
                          (_, i) => {
                            const day =
                              month + "-" + String(i + 1).padStart(2, "0");
                            const due = selected.filter((a) => a.date === day);
                            return (
                              <div key={day}>
                                <b>{i + 1}</b>
                                {due.map((a) => (
                                  <small key={a.id}>
                                    {a.person} | {money(remaining(s, a.id))}
                                  </small>
                                ))}
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  allocationTable(
                    selected.sort((a, b) => a.date.localeCompare(b.date)),
                  )
                )}
              </section>
            </>
          )}
          {path === "/purchases" && (
            <>
              {controls}
              {s.plans
                .filter(
                  (p) =>
                    !search ||
                    `${p.id} ${p.merchant}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((p) => (
                  <section className="panel" key={p.id}>
                    <div className="section-heading">
                      <div>
                        <h2>{p.merchant}</h2>
                        <p>
                          {p.id} | {p.installments.length} installments
                        </p>
                      </div>
                      <button onClick={() => openPlan(p)}>
                        Edit purchase / split
                      </button>
                    </div>
                    {allocationTable(selected.filter((a) => a.planId === p.id))}
                  </section>
                ))}
            </>
          )}
          {path === "/history" && (
            <section className="panel">
              {controls}
              <div className="filters">
                <label>
                  From date
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To date
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recorded</th>
                      <th>Person / purchase</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.transactions]
                      .reverse()
                      .filter((t) => {
                        const a = all.find((a) => a.id === t.allocationId)!;
                        return (
                          (!filter || a.person === filter) &&
                          (!search ||
                            `${a.merchant} ${a.planId}`
                              .toLowerCase()
                              .includes(search.toLowerCase())) &&
                          (!month || a.date.startsWith(month)) &&
                          (!from || t.at.slice(0, 10) >= from) &&
                          (!to || t.at.slice(0, 10) <= to)
                        );
                      })
                      .map((t) => {
                        const a = all.find((a) => a.id === t.allocationId)!;
                        const reversed = s.transactions.some(
                          (x) => x.reverses === t.id,
                        );
                        return (
                          <tr key={t.id}>
                            <td>{new Date(t.at).toLocaleString()}</td>
                            <td>
                              {a.person}
                              <small>{a.merchant}</small>
                            </td>
                            <td>{money(t.cents)}</td>
                            <td>
                              {t.reverses
                                ? "Reversal"
                                : reversed
                                  ? "Reversed settlement"
                                  : "Settlement"}
                            </td>
                            <td>
                              {t.cents > 0 && !reversed && (
                                <div className="actions">
                                  <button
                                    onClick={() =>
                                      setModal({
                                        id: a.id,
                                        tx: t.id,
                                        amount: String(t.cents / 100),
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      commit((v) =>
                                        reverse(v, t.id, crypto.randomUUID()),
                                      )
                                    }
                                  >
                                    Undo
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!s.transactions.length && (
                  <p className="empty">
                    Your story starts here. Recorded settlements and reversals
                    will appear here.
                  </p>
                )}
              </div>
            </section>
          )}
          {path === "/import" && (
            <section className="panel import-panel">
              <ScanLine size={40} />
              <h2>Bring your Koko screenshot.</h2>
              <p>
                Preview your image, then review the purchase details manually
                before adding them.
              </p>
              <label className="upload">
                Choose a screenshot
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 10 * 1024 * 1024) {
                      setError("Choose an image smaller than 10 MB");
                      return;
                    }
                    if (
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        f.type,
                      )
                    ) {
                      setError("Unsupported image format");
                      return;
                    }
                    const h = Array.from(
                      new Uint8Array(
                        await crypto.subtle.digest(
                          "SHA-256",
                          await f.arrayBuffer(),
                        ),
                      ),
                    )
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join("");
                    setHash(h);
                    setDuplicate(s.imports.includes(h));
                    setFileName(f.name);
                    setPreview((v) => {
                      if (v) URL.revokeObjectURL(v);
                      return URL.createObjectURL(f);
                    });
                  }}
                />
              </label>
              {preview && (
                <>
                  <img
                    src={preview}
                    alt="Screenshot for manual purchase review"
                    className="preview"
                  />
                  <p>{fileName}</p>
                  <p>
                    {duplicate
                      ? "Duplicate image: this screenshot has already been reviewed."
                      : "New screenshot. Verify merchant, dates, amounts and person split."}
                  </p>
                  <button disabled={duplicate} onClick={() => openPlan()}>
                    Enter reviewed purchase
                  </button>
                  <button
                    disabled={duplicate}
                    onClick={async () => {
                      if (
                        await commit((v) => ({
                          ...v,
                          revision: v.revision + 1,
                          imports: [...new Set([...v.imports, hash])],
                        }))
                      ) {
                        setDuplicate(true);
                        setNotice(
                          "Screenshot fingerprint saved. Purchase entries are reviewed separately.",
                        );
                      }
                    }}
                  >
                    Mark screenshot reviewed
                  </button>
                </>
              )}
              <small>
                Images stay on this device. No automatic OCR or external upload.
              </small>
            </section>
          )}
          {path === "/settings" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>Workspace</h2>
                <label>
                  Owner
                  <input value="Oshadha Perera" readOnly />
                </label>
                <label>
                  Storage mode
                  <select value="local" onChange={() => {}}>
                    <option value="local">Local | this browser</option>
                    <option value="supabase" disabled>
                      Supabase | requires deployment configuration
                    </option>
                  </select>
                </label>
                <p>
                  Transactions are saved locally after every action. Export a
                  backup regularly; clearing browser data removes local records.
                </p>
                <button
                  onClick={() => {
                    setLight(!light);
                    localStorage.setItem(
                      "oska-theme",
                      light ? "dark" : "light",
                    );
                  }}
                >
                  {light ? <Moon size={16} /> : <Sun size={16} />} Switch to{" "}
                  {light ? "dark" : "light"} theme
                </button>
              </section>
              <section className="panel">
                <h2>Your data, your control</h2>
                <p>
                  Back up everything or export allocation balances for your
                  spreadsheet.
                </p>
                <button
                  onClick={() =>
                    download(
                      "oska-due-backup.json",
                      JSON.stringify(s, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={16} /> Export JSON
                </button>
                <button
                  onClick={() =>
                    download(
                      "oska-due-balances.csv",
                      "Plan,Merchant,Date,Person,Allocated cents,Settled cents,Remaining cents\n" +
                        all
                          .map((a) =>
                            [
                              a.planId,
                              a.merchant,
                              a.date,
                              a.person,
                              a.cents,
                              paid(s, a.id),
                              remaining(s, a.id),
                            ]
                              .map(
                                (v) =>
                                  '"' + String(v).replaceAll('"', '""') + '"',
                              )
                              .join(","),
                          )
                          .join("\n"),
                      "text/csv",
                    )
                  }
                >
                  <Download size={16} /> Export CSV
                </button>
                <label>
                  Restore JSON backup (replaces current local data)
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const data = validate(JSON.parse(await file.text()));
                        if (
                          !window.confirm(
                            "Replace this browser\u2019s current records with the selected backup? Export your current data first.",
                          )
                        )
                          return;
                        localStorage.setItem(KEY, JSON.stringify(data));
                        ref.current = data;
                        setS(data);
                        setBlocked(false);
                        setError("");
                        setNotice("Backup restored successfully.");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                </label>
                <button
                  onClick={() =>
                    download(
                      "oska-due-recovery.txt",
                      localStorage.getItem(KEY) || "No saved data",
                      "text/plain",
                    )
                  }
                >
                  Export raw recovery copy
                </button>
                <p>
                  Supabase migration and RLS policies are included in the
                  project. Cloud sync is not enabled in this local build.
                </p>
              </section>
            </div>
          )}
          <footer>
            <span className="brand-footer">
              OSKA DUE <span>Less mental load. More living.</span>
            </span>
            <span>Amounts in LKR | Asia/Colombo | Local storage</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Payment details"
            className="dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              if (formBusy.current) return;
              formBusy.current = true;
              try {
                const cents = parseMoney(modal.amount);
                const ok = await commit((v) =>
                  modal.tx
                    ? edit(v, modal.tx!, cents, crypto.randomUUID())
                    : settle(v, modal.id, cents, crypto.randomUUID()),
                );
                if (ok) setModal(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                formBusy.current = false;
              }
            }}
          >
            <div role="alert">{error}</div>
            <h2>
              {modal.tx ? "Edit settlement" : "Record partial settlement"}
            </h2>
            <p>
              {all.find((a) => a.id === modal.id)?.merchant} |{" "}
              {all.find((a) => a.id === modal.id)?.person}
            </p>
            <label>
              Amount (LKR)
              <input
                required
                autoFocus
                inputMode="decimal"
                value={modal.amount}
                onChange={(e) => setModal({ ...modal, amount: e.target.value })}
              />
            </label>
            <p>Remaining: {money(remaining(s, modal.id))}</p>
            <div className="actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="primary">Save settlement</button>
            </div>
          </form>
        </div>
      )}
      {purchase && (
        <div className="overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Payment details"
            className="dialog"
            onSubmit={submitPlan}
          >
            <div role="alert">{error}</div>
            <h2>{purchase.original ? "Edit purchase" : "Add a purchase"}</h2>
            <p>Plans with settlement history are protected from edits.</p>
            {(
              ["id", "merchant", "dates", "amount", "split", "start"] as const
            ).map((k) => (
              <label key={k}>
                {
                  {
                    id: "Unique purchase ID",
                    merchant: "Merchant",
                    dates: "Due dates (YYYY-MM-DD, comma separated)",
                    amount: "Total per installment (LKR)",
                    split: "First person share (optional, LKR)",
                    start: "Starting installment number",
                  }[k]
                }
                <input
                  required={k !== "split"}
                  value={purchase[k]}
                  onChange={(e) =>
                    setPurchase({ ...purchase, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              First person
              <select
                value={purchase.person}
                onChange={(e) =>
                  setPurchase({ ...purchase, person: e.target.value })
                }
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <small>
              If split, the remainder belongs to{" "}
              {purchase.person === "oshadha" ? "Thiranji" : "Oshadha"}.
            </small>
            <div className="actions">
              <button type="button" onClick={() => setPurchase(null)}>
                Cancel
              </button>
              <button className="primary">Save purchase</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
