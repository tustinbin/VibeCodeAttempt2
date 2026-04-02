import Link from "next/link";

import { SiteNav } from "@/components/SiteNav";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Operational orders & fraud scoring
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Choose a customer, place an order against the Supabase-backed shop
            database, then review the administrator queue. Run scoring to refresh
            fraud risk and the priority list of orders to verify before
            fulfilling.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/select-customer"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Select customer
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Admin order history
          </Link>
        </div>
      </main>
    </div>
  );
}
