"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SiteNav } from "@/components/SiteNav";

type Product = {
  product_id: number;
  sku: string;
  product_name: string;
  category: string;
  price: number;
};

type Meta = {
  payment_methods: string[];
  device_types: string[];
  ip_countries: string[];
  shipping_states: string[];
};

type Line = { product_id: number; quantity: number };

function PlaceOrderForm() {
  const router = useRouter();
  const params = useSearchParams();
  const customerId = Number(params.get("customer"));

  const [meta, setMeta] = useState<Meta | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([{ product_id: 0, quantity: 1 }]);
  const [billingZip, setBillingZip] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [deviceType, setDeviceType] = useState("mobile");
  const [ipCountry, setIpCountry] = useState("US");
  const [promoUsed, setPromoUsed] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rm, rp] = await Promise.all([
          fetch("/api/meta"),
          fetch("/api/products"),
        ]);
        const m = await rm.json();
        const p = await rp.json();
        if (!cancelled) {
          if (!rm.ok) throw new Error(m.error || "Meta failed");
          if (!rp.ok) throw new Error(p.error || "Products failed");
          setMeta(m);
          setProducts(Array.isArray(p) ? p : []);
          if (m.shipping_states?.length)
            setShippingState(m.shipping_states[0]);
          if (Array.isArray(p) && p.length) {
            setLines([{ product_id: p[0].product_id, quantity: 1 }]);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load form data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validCustomer = Number.isFinite(customerId) && customerId > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validCustomer) {
      setError("Missing customer. Go back to Select customer.");
      return;
    }
    const items = lines
      .filter((l) => l.product_id > 0 && l.quantity > 0)
      .map((l) => ({ product_id: l.product_id, quantity: l.quantity }));
    if (!items.length) {
      setError("Add at least one line item.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          billing_zip: billingZip,
          shipping_zip: shippingZip,
          shipping_state: shippingState,
          payment_method: paymentMethod,
          device_type: deviceType,
          ip_country: ipCountry,
          promo_used: promoUsed,
          promo_code: promoCode || null,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");
      router.push(`/admin?placed=${data.order_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Place order
        </h1>
        {!validCustomer && (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
            No customer selected.{" "}
            <Link href="/select-customer" className="underline">
              Choose a customer first
            </Link>
            .
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading catalog…</p>
        )}

        {!loading && meta && (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Billing ZIP
                </span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={billingZip}
                  onChange={(e) => setBillingZip(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Shipping ZIP
                </span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={shippingZip}
                  onChange={(e) => setShippingZip(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                Shipping state
              </span>
              <select
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
              >
                {meta.shipping_states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Payment
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {meta.payment_methods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Device
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                >
                  {meta.device_types.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  IP country
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={ipCountry}
                  onChange={(e) => setIpCountry(e.target.value)}
                >
                  {meta.ip_countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={promoUsed}
                onChange={(e) => setPromoUsed(e.target.checked)}
              />
              Promo used
            </label>
            {promoUsed && (
              <label className="block text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Promo code (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
              </label>
            )}

            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Line items
              </p>
              <div className="mt-2 space-y-3">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  >
                    <label className="block flex-1 text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        Product
                      </span>
                      <select
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        value={line.product_id || ""}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...next[idx],
                            product_id: Number(e.target.value),
                          };
                          setLines(next);
                        }}
                      >
                        <option value="">Select…</option>
                        {products.map((p) => (
                          <option key={p.product_id} value={p.product_id}>
                            {p.product_name} — ${Number(p.price).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block w-28 text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        Qty
                      </span>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...next[idx],
                            quantity: Number(e.target.value) || 1,
                          };
                          setLines(next);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() =>
                        setLines(lines.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-sm text-zinc-700 underline dark:text-zinc-300"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      product_id: products[0]?.product_id ?? 0,
                      quantity: 1,
                    },
                  ])
                }
              >
                + Add line
              </button>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!validCustomer || submitting}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {submitting ? "Submitting…" : "Submit order"}
              </button>
              <Link
                href="/select-customer"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Back
              </Link>
            </div>
            <p className="text-xs text-zinc-500">
              Subtotal, shipping, and tax are computed on the server from line
              items (same model as the course database).
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

export default function PlaceOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-zinc-500">Loading place order…</div>
      }
    >
      <PlaceOrderForm />
    </Suspense>
  );
}
