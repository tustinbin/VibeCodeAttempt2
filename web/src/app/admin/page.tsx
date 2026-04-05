"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { SiteNav } from "@/components/SiteNav";

type OrderRow = {
  order_id: number;
  customer_id: number;
  customer_name: string;
  order_datetime: string;
  billing_zip: string;
  shipping_zip: string;
  shipping_state: string;
  payment_method: string;
  device_type: string;
  ip_country: string;
  promo_used: number;
  order_subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  order_total: number;
  is_fraud: number;
  predicted_is_fraud: number | null;
};

type SortKey =
  | "order_id"
  | "customer_name"
  | "order_datetime"
  | "order_total"
  | "predicted_is_fraud"
  | "is_fraud"
  | "label_action";

function labelActionSortText(o: OrderRow): string {
  return o.is_fraud === 1 ? "Mark not fraud" : "Mark fraud";
}

function compareOrderRows(
  a: OrderRow,
  b: OrderRow,
  key: SortKey,
  dir: "asc" | "desc"
): number {
  const m = dir === "asc" ? 1 : -1;
  switch (key) {
    case "order_id":
      return (a.order_id - b.order_id) * m;
    case "customer_name":
      return (
        a.customer_name.localeCompare(b.customer_name, undefined, {
          sensitivity: "base",
        }) * m
      );
    case "order_datetime":
      return (
        (new Date(a.order_datetime).getTime() -
          new Date(b.order_datetime).getTime()) *
        m
      );
    case "order_total":
      return (Number(a.order_total) - Number(b.order_total)) * m;
    case "predicted_is_fraud": {
      const pa = a.predicted_is_fraud;
      const pb = b.predicted_is_fraud;
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * m;
    }
    case "is_fraud":
      return (a.is_fraud - b.is_fraud) * m;
    case "label_action":
      return (
        labelActionSortText(a).localeCompare(labelActionSortText(b), undefined, {
          sensitivity: "base",
        }) * m
      );
  }
}

function AdminContent() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [labelingOrderId, setLabelingOrderId] = useState<number | null>(null);
  const [sort, setSort] = useState<{
    key: SortKey | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });
  const params = useSearchParams();

  const sortedRows = useMemo(() => {
    const key = sort.key;
    if (key === null) return rows;
    return [...rows].sort((a, b) => compareOrderRows(a, b, key, sort.dir));
  }, [rows, sort.key, sort.dir]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/orders");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load orders");
    setRows(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const placed = params.get("placed");
    if (placed) {
      setBanner(`Order #${placed} was created. Run scoring to refresh predictions.`);
    }
  }, [params]);

  async function runScoring() {
    setScoring(true);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch("/api/run-scoring", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed");
      setBanner(
        `Scored ${data.orders_scored} orders — sklearn P(fraud) ≥ ${data.decision_threshold ?? "?"} → ${data.predicted_fraud_count ?? "?"} predicted fraud.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  async function setGroundTruthLabel(orderId: number, isFraud: 0 | 1) {
    setLabelingOrderId(orderId);
    setError(null);
    try {
      const res = await fetch("/api/admin/label-fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, is_fraud: isFraud }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update label");
      setRows((prev) =>
        prev.map((r) =>
          r.order_id === orderId ? { ...r, is_fraud: data.is_fraud } : r
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Label update failed");
    } finally {
      setLabelingOrderId(null);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Administrator — order history & priority queue
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <strong>Predicted</strong> uses the trained logistic model in{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">model.json</code> (same pipeline as{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">fraud_pipeline.ipynb</code>
              ): StandardScaler + balanced logistic regression, with a validation-tuned probability
              threshold. <strong>Dataset label</strong> is ground truth (seeded from{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">shop.db</code>); use{" "}
              <strong>Set label</strong> to correct rows in Postgres for retraining. Rows load from the server
              (predicted fraud first, then newest); use column headers to sort in the browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runScoring}
              disabled={scoring}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {scoring ? "Running scoring…" : "Run scoring"}
            </button>
            <button
              type="button"
              onClick={() => load().catch(() => {})}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Refresh
            </button>
          </div>
        </div>

        {banner && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {banner}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-sm text-zinc-500">Loading orders…</p>
        )}
        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-xs text-zinc-800 dark:text-zinc-200">
              <thead className="bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  {(
                    [
                      ["order_id", "Order"],
                      ["customer_name", "Customer"],
                      ["order_datetime", "When"],
                      ["order_total", "Total"],
                      ["predicted_is_fraud", "Predicted (model)"],
                      ["is_fraud", "Dataset label (is_fraud)"],
                      ["label_action", "Set label"],
                    ] as const
                  ).map(([col, label]) => {
                    const active = sort.key === col;
                    const ariaSort = !active
                      ? "none"
                      : sort.dir === "asc"
                        ? "ascending"
                        : "descending";
                    return (
                      <th key={col} className="px-3 py-2" aria-sort={ariaSort}>
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className="inline-flex w-full items-center gap-1 text-left font-semibold uppercase tracking-wide text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        >
                          <span>{label}</span>
                          {active && (
                            <span aria-hidden className="font-normal normal-case">
                              {sort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((o) => (
                  <tr
                    key={o.order_id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-mono">#{o.order_id}</td>
                    <td className="px-3 py-2">{o.customer_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(o.order_datetime).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      ${Number(o.order_total).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {o.predicted_is_fraud === null
                        ? "—"
                        : o.predicted_is_fraud === 1
                          ? "fraud"
                          : "ok"}
                    </td>
                    <td className="px-3 py-2">
                      {o.is_fraud === 1 ? "fraud" : "ok"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.is_fraud === 1 ? (
                        <button
                          type="button"
                          disabled={labelingOrderId !== null}
                          onClick={() => setGroundTruthLabel(o.order_id, 0)}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          {labelingOrderId === o.order_id
                            ? "Saving…"
                            : "Mark not fraud"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={labelingOrderId !== null}
                          onClick={() => setGroundTruthLabel(o.order_id, 1)}
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                        >
                          {labelingOrderId === o.order_id
                            ? "Saving…"
                            : "Mark fraud"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-3 py-6 text-sm text-zinc-500">No orders yet.</p>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-zinc-500">
          <Link href="/select-customer" className="underline">
            Place another order
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-zinc-500">Loading admin…</div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
