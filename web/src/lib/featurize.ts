import type { ModelSpec } from "./modelSpec";

export type OrderFeaturesInput = {
  order_subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  order_total: number;
  promo_used: number;
  billing_zip: string;
  shipping_zip: string;
  payment_method: string;
  device_type: string;
  ip_country: string;
  shipping_state: string;
};

/**
 * Must match `featurize()` in scripts/train_export_model.py and fraud_pipeline.ipynb.
 */
export function featurizeOrderRow(
  row: OrderFeaturesInput,
  spec: ModelSpec
): number[] {
  const zipMismatch =
    String(row.billing_zip).trim() !== String(row.shipping_zip).trim()
      ? 1
      : 0;
  const v: number[] = [
    row.order_subtotal,
    row.shipping_fee,
    row.tax_amount,
    row.order_total,
    row.promo_used,
    zipMismatch,
  ];
  for (const p of spec.payment_methods) {
    v.push(row.payment_method === p ? 1 : 0);
  }
  for (const d of spec.device_types) {
    v.push(row.device_type === d ? 1 : 0);
  }
  for (const c of spec.ip_countries) {
    v.push(row.ip_country === c ? 1 : 0);
  }
  for (const s of spec.shipping_states) {
    v.push(row.shipping_state === s ? 1 : 0);
  }
  return v;
}
