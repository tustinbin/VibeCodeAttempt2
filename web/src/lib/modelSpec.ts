export type ModelSpec = {
  version: number;
  feature_names: string[];
  shipping_states: string[];
  payment_methods: string[];
  device_types: string[];
  ip_countries: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  coef: number[];
  intercept: number;
};

/**
 * Classify as predicted fraud when P(fraud) exceeds this.
 * 0.5 is a poor default for rare fraud; higher reduces false positives.
 */
export const FRAUD_PROB_THRESHOLD = 0.85;
