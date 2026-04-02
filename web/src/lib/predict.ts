import { readFileSync } from "fs";
import { join } from "path";

import type { ModelSpec } from "./modelSpec";
import { featurizeOrderRow, type OrderFeaturesInput } from "./featurize";

let cached: ModelSpec | null = null;

export function loadModelSpec(): ModelSpec {
  if (cached) return cached;
  const path = join(process.cwd(), "public", "model.json");
  const raw = readFileSync(path, "utf8");
  cached = JSON.parse(raw) as ModelSpec;
  return cached;
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function predictFraudProbability(
  row: OrderFeaturesInput,
  spec: ModelSpec = loadModelSpec()
): number {
  const x = featurizeOrderRow(row, spec);
  if (x.length !== spec.coef.length) {
    throw new Error(
      `Feature length ${x.length} does not match coef length ${spec.coef.length}`
    );
  }
  let z = spec.intercept;
  for (let i = 0; i < x.length; i++) {
    const scaled =
      (x[i] - spec.scaler_mean[i]) / (spec.scaler_scale[i] || 1e-9);
    z += spec.coef[i] * scaled;
  }
  return sigmoid(z);
}
