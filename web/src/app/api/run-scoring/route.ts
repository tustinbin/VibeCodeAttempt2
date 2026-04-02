import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";
import { predictFraudProbability } from "@/lib/predict";

export const runtime = "nodejs";

export async function POST() {
  try {
    const sql = getSql();
    const orders = await sql`
      SELECT
        order_id,
        order_subtotal,
        shipping_fee,
        tax_amount,
        order_total,
        promo_used,
        billing_zip,
        shipping_zip,
        payment_method,
        device_type,
        ip_country,
        shipping_state
      FROM orders
    `;

    let updated = 0;
    for (const o of orders) {
      const prob = predictFraudProbability({
        order_subtotal: Number(o.order_subtotal),
        shipping_fee: Number(o.shipping_fee),
        tax_amount: Number(o.tax_amount),
        order_total: Number(o.order_total),
        promo_used: Number(o.promo_used),
        billing_zip: String(o.billing_zip),
        shipping_zip: String(o.shipping_zip),
        payment_method: String(o.payment_method),
        device_type: String(o.device_type),
        ip_country: String(o.ip_country),
        shipping_state: String(o.shipping_state),
      });
      const risk = Math.round(prob * 1000) / 10;
      const predicted = prob >= 0.5 ? 1 : 0;
      await sql`
        UPDATE orders
        SET predicted_is_fraud = ${predicted},
            risk_score = ${risk}
        WHERE order_id = ${o.order_id}
      `;
      updated += 1;
    }

    return NextResponse.json({ ok: true, orders_scored: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
