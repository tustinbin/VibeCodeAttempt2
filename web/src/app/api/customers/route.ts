import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT customer_id, full_name, email, city, zip_code
      FROM customers
      ORDER BY full_name ASC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
