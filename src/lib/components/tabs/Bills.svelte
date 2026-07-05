<script lang="ts">
  import type { BillEntry, BillsData, OpenLoop } from "$lib/types";

  const RELAY_URL = "/api";

  let { bills }: { bills: BillsData } = $props();

  type BillRow = {
    id: string;
    name: string;
    amount: string;
    due: string;
    status: "paid" | "pending" | "overdue";
    link: string;
    raw: string;
  };

  type ActionBtnState = "idle" | "loading" | "ok" | "error" | "offline";

  let paidBtnStates = $state<Record<string, ActionBtnState>>({});

  const billRows = $derived(bills.bills.map(parseBillRow));

  function parseBillRow(bill: BillEntry): BillRow {
    const desc = bill.desc.replace(/^\s*[-*]\s*\[?\s*[x ]\s*\]?\s*/, "").trim();
    const checked = /^\[x\]/i.test(bill.desc) || bill.desc.includes("[x]");
    const amountMatch = desc.match(/(\d[\d\s.,]*)\s*Ft/i);
    const amount = amountMatch ? `${amountMatch[1]?.trim()} Ft` : "—";
    const dueMatch = desc.match(
      /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}|\d{1,2}\.\s*\w+)/,
    );
    const due = dueMatch?.[1] ?? "—";
    const linkMatch = desc.match(/https?:\/\/\S+/);
    const link = linkMatch?.[0] ?? "";

    let status: BillRow["status"] = checked ? "paid" : "pending";
    if (!checked && dueMatch) {
      const dueDate = parseDueDate(dueMatch[1] ?? "");
      if (dueDate) {
        const today = startOfDay(new Date());
        const dueDay = startOfDay(dueDate);
        if (dueDay < today) status = "overdue";
      }
    }

    return {
      id: bill.id,
      name:
        desc
          .replace(/https?:\/\/\S+/g, "")
          .replace(/\d[\d\s.,]*\s*Ft/i, "")
          .trim() || desc,
      amount,
      due,
      status,
      link,
      raw: desc,
    };
  }

  function parseDueDate(raw: string): Date | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function billStatusClass(status: BillRow["status"]): string {
    if (status === "overdue") return "status-overdue";
    if (status === "paid") return "status-paid";
    return "status-pending";
  }

  function billDueClass(row: BillRow): string {
    if (row.status === "overdue") return "due-overdue";
    if (row.due === "—") return "";
    const dueDate = parseDueDate(row.due);
    if (!dueDate) return "";
    const today = startOfDay(new Date());
    const dueDay = startOfDay(dueDate);
    if (dueDay.getTime() === today.getTime()) return "due-today";
    if (dueDay > today) return "due-future";
    return "due-overdue";
  }

  function parseAgeDays(age: string): number | null {
    const match = age.match(/(\d+)\s*d/i);
    return match ? parseInt(match[1] ?? "0", 10) : null;
  }

  function escalationLevel(loop: OpenLoop): {
    icon: string;
    className: string;
  } {
    const days = parseAgeDays(loop.age);
    if (days != null) {
      if (days >= 14) return { icon: "🔴", className: "esc-red" };
      if (days >= 7) return { icon: "🚩", className: "esc-flag" };
      if (days >= 3) return { icon: "⚠️", className: "esc-warn" };
    }
    if (loop.severity === "red") return { icon: "🔴", className: "esc-red" };
    if (loop.severity === "yellow")
      return { icon: "🚩", className: "esc-flag" };
    return { icon: "⚠️", className: "esc-ok" };
  }

  async function markPaid(id: string, description: string) {
    paidBtnStates = { ...paidBtnStates, [id]: "loading" };
    try {
      const res = await fetch(`${RELAY_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", id, description }),
      });
      const body = await res.json();
      paidBtnStates = { ...paidBtnStates, [id]: body.ok ? "ok" : "error" };
      setTimeout(() => {
        paidBtnStates = { ...paidBtnStates, [id]: "idle" };
      }, 2500);
    } catch {
      paidBtnStates = { ...paidBtnStates, [id]: "offline" };
      setTimeout(() => {
        paidBtnStates = { ...paidBtnStates, [id]: "idle" };
      }, 2500);
    }
  }
</script>

<section class="bills-tab">
  <h3 class="section-title">💰 Bills</h3>

  {#if bills.error}
    <p class="empty">Bills unavailable — {bills.error}</p>
  {:else if billRows.length === 0}
    <p class="empty">No bills in tasks.md</p>
  {:else}
    <div class="table-wrap card">
      <table class="bills-table">
        <thead>
          <tr>
            <th>Név</th>
            <th>Összeg</th>
            <th>Határidő</th>
            <th>Státusz</th>
            <th>Link</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each billRows as row (row.id)}
            {@const state = paidBtnStates[row.id] ?? "idle"}
            <tr class={billDueClass(row)}>
              <td>{row.name}</td>
              <td>{row.amount}</td>
              <td class={billDueClass(row)}>{row.due}</td>
              <td>
                <span class="status-badge {billStatusClass(row.status)}"
                  >{row.status}</span
                >
              </td>
              <td>
                {#if row.link}
                  <a href={row.link} target="_blank" rel="noopener noreferrer"
                    >Open</a
                  >
                {:else}
                  —
                {/if}
              </td>
              <td>
                <button
                  type="button"
                  class="action-btn"
                  class:loading={state === "loading"}
                  disabled={state === "loading" || row.status === "paid"}
                  onclick={() => markPaid(row.id, row.raw)}
                >
                  {state === "loading"
                    ? "⏳"
                    : state === "ok"
                      ? "✅"
                      : "💰 Paid"}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <h3 class="section-title">🔓 Open Loops</h3>

  {#if bills.openLoops.length === 0}
    <p class="empty">No open loops</p>
  {:else}
    <div class="loops-list card">
      {#each bills.openLoops as loop (loop.id)}
        {@const esc = escalationLevel(loop)}
        <div class="loop-row {esc.className}">
          <span class="loop-badge">{esc.icon} {loop.id}</span>
          <span class="loop-desc">
            {loop.desc}
            <span class="loop-age">({loop.age})</span>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .bills-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    font-weight: 600;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  .bills-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }

  .bills-table th,
  .bills-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .bills-table th {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.85em;
  }

  tr.due-overdue td {
    background: color-mix(in srgb, var(--red) 8%, transparent);
  }

  tr.due-today td,
  td.due-today {
    background: color-mix(in srgb, var(--yellow) 10%, transparent);
  }

  tr.due-future td,
  td.due-future {
    background: color-mix(in srgb, var(--green) 8%, transparent);
  }

  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.82em;
    text-transform: uppercase;
  }

  .status-overdue {
    background: var(--r-bg);
    color: var(--red);
  }

  .status-pending {
    background: var(--y-bg);
    color: var(--yellow);
  }

  .status-paid {
    background: var(--g-bg);
    color: var(--green);
  }

  .bills-table a {
    color: var(--accent);
  }

  .action-btn {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    font-size: 0.82em;
  }

  .action-btn.loading {
    opacity: 0.6;
    cursor: wait;
  }

  .loops-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .loop-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9em;
    line-height: 1.5;
    padding: 6px 8px;
    border-radius: 4px;
  }

  .loop-badge {
    flex-shrink: 0;
    font-family: monospace;
    font-size: 0.88em;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
  }

  .loop-desc {
    flex: 1;
  }

  .loop-age {
    color: var(--muted);
  }

  .esc-red .loop-badge {
    border-color: var(--red);
    color: var(--red);
  }

  .esc-flag .loop-badge {
    border-color: var(--yellow);
    color: var(--yellow);
  }

  .esc-warn .loop-badge {
    border-color: var(--orange);
  }

  .empty {
    color: var(--muted);
    font-size: 0.92em;
  }

  @media (max-width: 768px) {
    .bills-table {
      font-size: 0.82em;
    }
  }
</style>
