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
