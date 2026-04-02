import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        o.order_id,
        o.customer_id,
        c.full_name AS customer_name,
        o.order_datetime,
        o.billing_zip,
        o.shipping_zip,
        o.shipping_state,
        o.payment_method,
        o.device_type,
        o.ip_country,
        o.promo_used,
        o.order_subtotal,
        o.shipping_fee,
        o.tax_amount,
        o.order_total,
        o.risk_score,
        o.is_fraud,
        o.predicted_is_fraud
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      ORDER BY
        o.predicted_is_fraud DESC NULLS LAST,
        o.risk_score DESC NULLS LAST,
        o.order_datetime DESC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
