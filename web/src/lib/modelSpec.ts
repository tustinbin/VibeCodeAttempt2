export type ModelMetrics = {
  val_f1_at_threshold?: number;
  test_roc_auc?: number;
  test_f1_at_threshold?: number;
};

/** Serialized sklearn Pipeline(StandardScaler + LogisticRegression) from scripts/train_export_model.py */
export type ModelSpec = {
  version: number;
  model_type?: string;
  description?: string;
  feature_names: string[];
  shipping_states: string[];
  payment_methods: string[];
  device_types: string[];
  ip_countries: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  coef: number[];
  intercept: number;
  /** P(fraud) cutoff tuned on validation F1 (see fraud_pipeline.ipynb + train_export_model.py) */
  decision_threshold?: number;
  metrics?: ModelMetrics;
};
