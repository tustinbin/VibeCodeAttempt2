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

/** P(fraud) threshold from training; fallback 0.5 only for legacy model.json without the field. */
export function fraudDecisionThreshold(spec: ModelSpec = loadModelSpec()): number {
  return spec.decision_threshold ?? 0.5;
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** Linear score before sigmoid; use for ranking. Do not treat as a calibrated “percent”. */
export function predictLogit(
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
  return z;
}

export function predictLogitAndProbability(
  row: OrderFeaturesInput,
  spec: ModelSpec = loadModelSpec()
): { logit: number; prob: number } {
  const logit = predictLogit(row, spec);
  return { logit, prob: sigmoid(logit) };
}

export function predictFraudProbability(
  row: OrderFeaturesInput,
  spec: ModelSpec = loadModelSpec()
): number {
  return predictLogitAndProbability(row, spec).prob;
}
