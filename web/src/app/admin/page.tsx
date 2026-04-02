"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

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
  risk_score: number | null;
  is_fraud: number;
  predicted_is_fraud: number | null;
};

function AdminContent() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const params = useSearchParams();

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
      setBanner(`Order #${placed} was created. Run scoring to refresh risk.`);
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
      setBanner(`Scored ${data.orders_scored} orders. Priority queue updated.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoring(false);
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
              After scoring, orders sort by predicted fraud, then by model score (logit). Fraud
              labels use P(fraud) ≥ 85%, not a 50% “risk percent.”
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
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Predicted</th>
                  <th className="px-3 py-2">Score (logit)</th>
                  <th className="px-3 py-2">Labeled (is_fraud)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
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
                      {o.risk_score != null
                        ? Number(o.risk_score).toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {o.is_fraud === 1 ? "fraud" : "ok"}
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
