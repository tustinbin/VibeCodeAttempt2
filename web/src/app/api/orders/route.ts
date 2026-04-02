import { NextResponse } from "next/server";
import { z } from "zod";

import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  customer_id: z.number().int().positive(),
  billing_zip: z.string().min(3).max(20),
  shipping_zip: z.string().min(3).max(20),
  shipping_state: z.string().min(2).max(2),
  payment_method: z.enum(["bank", "card", "paypal", "crypto"]),
  device_type: z.enum(["desktop", "tablet", "mobile"]),
  ip_country: z.enum(["BR", "CA", "GB", "IN", "NG", "US"]),
  promo_used: z.boolean(),
  promo_code: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1),
});

function computeFees(subtotal: number) {
  const shipping_fee = Math.max(9.99, Math.round(subtotal * 0.023 * 100) / 100);
  const tax_amount = Math.round(subtotal * 0.07 * 100) / 100;
  const order_total = Math.round((subtotal + shipping_fee + tax_amount) * 100) / 100;
  return { shipping_fee, tax_amount, order_total };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const b = parsed.data;
    const sql = getSql();

    const [cust] = await sql`
      SELECT customer_id FROM customers WHERE customer_id = ${b.customer_id}
    `;
    if (!cust) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const lines: { product_id: number; quantity: number; unit_price: number; line_total: number }[] =
      [];
    for (const item of b.items) {
      const [p] = await sql`
        SELECT product_id, price FROM products WHERE product_id = ${item.product_id} AND is_active = 1
      `;
      if (!p) {
        return NextResponse.json(
          { error: `Product ${item.product_id} not found` },
          { status: 400 }
        );
      }
      const unit = Number(p.price);
      const line_total = Math.round(unit * item.quantity * 100) / 100;
      lines.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unit,
        line_total,
      });
    }

    const order_subtotal =
      Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
    const { shipping_fee, tax_amount, order_total } = computeFees(order_subtotal);

    const promo_used = b.promo_used ? 1 : 0;
    const promo_code = b.promo_code?.trim() || null;
    const order_datetime = new Date().toISOString();

    // postgres TransactionSql typings omit the tagged-template call signature; runtime is correct.
    const result = await sql.begin(async (tx) => {
      const txn = tx as unknown as typeof sql;
      const [order] = await txn`
        INSERT INTO orders (
          customer_id,
          order_datetime,
          billing_zip,
          shipping_zip,
          shipping_state,
          payment_method,
          device_type,
          ip_country,
          promo_used,
          promo_code,
          order_subtotal,
          shipping_fee,
          tax_amount,
          order_total,
          is_fraud,
          predicted_is_fraud
        ) VALUES (
          ${b.customer_id},
          ${order_datetime},
          ${b.billing_zip},
          ${b.shipping_zip},
          ${b.shipping_state},
          ${b.payment_method},
          ${b.device_type},
          ${b.ip_country},
          ${promo_used},
          ${promo_code},
          ${order_subtotal},
          ${shipping_fee},
          ${tax_amount},
          ${order_total},
          0,
          NULL
        )
        RETURNING order_id, order_total, order_subtotal
      `;

      for (const line of lines) {
        await txn`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
          VALUES (
            ${order.order_id},
            ${line.product_id},
            ${line.quantity},
            ${line.unit_price},
            ${line.line_total}
          )
        `;
      }

      return order;
    });

    return NextResponse.json({
      order_id: result.order_id,
      order_subtotal: result.order_subtotal,
      order_total: result.order_total,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
