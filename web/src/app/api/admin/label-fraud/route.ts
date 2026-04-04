import { NextResponse } from "next/server";
import { z } from "zod";

import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  order_id: z.number().int().positive(),
  is_fraud: z.union([z.literal(0), z.literal(1)]),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body: order_id (positive int) and is_fraud (0 or 1) required." },
        { status: 400 }
      );
    }

    const { order_id, is_fraud } = parsed.data;
    const sql = getSql();
    const result = await sql`
      UPDATE orders
      SET is_fraud = ${is_fraud}
      WHERE order_id = ${order_id}
      RETURNING order_id, is_fraud
    `;

    const row = result[0];
    if (!row) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      order_id: Number(row.order_id),
      is_fraud: Number(row.is_fraud),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
