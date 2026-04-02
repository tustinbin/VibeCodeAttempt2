import { NextResponse } from "next/server";

import { loadModelSpec } from "@/lib/predict";

export const runtime = "nodejs";

export async function GET() {
  try {
    const spec = loadModelSpec();
    return NextResponse.json({
      payment_methods: spec.payment_methods,
      device_types: spec.device_types,
      ip_countries: spec.ip_countries,
      shipping_states: spec.shipping_states,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load model metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
