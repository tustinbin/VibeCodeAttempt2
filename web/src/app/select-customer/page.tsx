"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteNav } from "@/components/SiteNav";

type Customer = {
  customer_id: number;
  full_name: string;
  email: string;
  city: string | null;
  state: string | null;
};

export default function SelectCustomerPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customers");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load customers");
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load customers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Select customer
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          No login required. Pick who is placing the order.
        </p>

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading customers…</p>
        )}
        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        {!loading && !error && (
          <ul className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {rows.map((c) => (
              <li
                key={c.customer_id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {c.full_name}
                  </p>
                  <p className="text-xs text-zinc-500">{c.email}</p>
                  {(c.city || c.state) && (
                    <p className="text-xs text-zinc-500">
                      {[c.city, c.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <Link
                  href={`/place-order?customer=${c.customer_id}`}
                  className="mt-2 inline-flex shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 sm:mt-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Place order
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
