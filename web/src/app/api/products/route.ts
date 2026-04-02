import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT product_id, sku, product_name, category, price
      FROM products
      WHERE is_active = 1
      ORDER BY product_name ASC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
