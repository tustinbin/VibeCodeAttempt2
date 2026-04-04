"""
Train fraud models to match fraud_pipeline.ipynb, export artifacts:

- **web/public/model.json** — scaler + logistic weights + decision_threshold for the Next.js API
  (Node cannot load sklearn pickles; JSON is the deployed inference format).

- **models/fraud_model.sav** — full sklearn Pipeline via joblib (same bytes as .joblib; .sav is
  a common extension for course submissions / Python reload with joblib.load).

- **models/fraud_model_rf.sav** — RandomForest reference only.

Run from repo root:
  pip install -r requirements-ml.txt
  python scripts/train_export_model.py

If DATABASE_URL is set (e.g. Supabase Postgres), training reads orders from Postgres;
otherwise it uses shop.db at the repo root.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "shop.db"
OUT_JSON = ROOT / "web" / "public" / "model.json"
MODELS_DIR = ROOT / "models"

PAYMENT = ["bank", "card", "paypal", "crypto"]
DEVICE = ["desktop", "tablet", "mobile"]
COUNTRY = ["BR", "CA", "GB", "IN", "NG", "US"]


def featurize(df: pd.DataFrame, states: list[str]) -> tuple[np.ndarray, list[str]]:
    names = (
        ["order_subtotal", "shipping_fee", "tax_amount", "order_total", "promo_used", "zip_mismatch"]
        + [f"payment_{p}" for p in PAYMENT]
        + [f"device_{d}" for d in DEVICE]
        + [f"country_{c}" for c in COUNTRY]
        + [f"state_{s}" for s in states]
    )
    rows = []
    for _, row in df.iterrows():
        z = (
            1.0
            if str(row["billing_zip"]).strip() != str(row["shipping_zip"]).strip()
            else 0.0
        )
        base = [
            float(row["order_subtotal"]),
            float(row["shipping_fee"]),
            float(row["tax_amount"]),
            float(row["order_total"]),
            float(row["promo_used"]),
            z,
        ]
        pm = str(row["payment_method"])
        base += [1.0 if pm == p else 0.0 for p in PAYMENT]
        dev = str(row["device_type"])
        base += [1.0 if dev == d else 0.0 for d in DEVICE]
        ic = str(row["ip_country"])
        base += [1.0 if ic == c else 0.0 for c in COUNTRY]
        st = str(row["shipping_state"])
        base += [1.0 if st == s else 0.0 for s in states]
        rows.append(base)
    return np.asarray(rows, dtype=np.float64), names


def best_f1_threshold(y_true: np.ndarray, proba: np.ndarray) -> tuple[float, float]:
    best_t, best_f1 = 0.5, 0.0
    for t in np.linspace(0.01, 0.99, 99):
        pred = (proba >= t).astype(int)
        f1 = f1_score(y_true, pred, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_t = float(t)
    return best_t, best_f1


def load_orders() -> pd.DataFrame:
    """Prefer Postgres when DATABASE_URL is set (e.g. GitHub Actions + Supabase); else shop.db."""
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url:
        import psycopg2

        print("Training data: PostgreSQL (DATABASE_URL)")
        conn = psycopg2.connect(db_url)
        try:
            return pd.read_sql_query("SELECT * FROM orders", conn)
        finally:
            conn.close()

    if not DB_PATH.is_file():
        print(
            f"ERROR: {DB_PATH} not found and DATABASE_URL is not set",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Training data: SQLite (shop.db)")
    lite = __import__("sqlite3").connect(str(DB_PATH))
    try:
        return pd.read_sql_query("SELECT * FROM orders", lite)
    finally:
        lite.close()


def main() -> None:
    orders = load_orders()

    states = sorted(orders["shipping_state"].dropna().astype(str).unique().tolist())
    X, feature_names = featurize(orders, states)
    y = orders["is_fraud"].astype(int).values

    # Train / val / test (60 / 20 / 20) — threshold from val, report on test
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.25, random_state=42, stratify=y_temp
    )

    log_reg = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000, class_weight="balanced", random_state=42
                ),
            ),
        ]
    )
    log_reg.fit(X_train, y_train)

    proba_val = log_reg.predict_proba(X_val)[:, 1]
    decision_threshold, val_f1 = best_f1_threshold(y_val, proba_val)

    proba_test = log_reg.predict_proba(X_test)[:, 1]
    test_pred = (proba_test >= decision_threshold).astype(int)
    test_f1 = f1_score(y_test, test_pred, zero_division=0)
    test_auc = roc_auc_score(y_test, proba_test)

    print("Logistic regression (deployed to model.json)")
    print(f"  Val F1 at chosen threshold: {val_f1:.4f} (threshold={decision_threshold:.4f})")
    print(f"  Test ROC-AUC: {test_auc:.4f}")
    print(f"  Test F1 at exported threshold: {test_f1:.4f}")

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    rf_proba = rf.predict_proba(X_test)[:, 1]
    print("RandomForest (reference only, not deployed to Vercel)")
    print(f"  Test ROC-AUC: {roc_auc_score(y_test, rf_proba):.4f}")
    print(classification_report(y_test, rf.predict(X_test), digits=3))

    scaler = log_reg.named_steps["scaler"]
    clf = log_reg.named_steps["clf"]

    spec = {
        "version": 2,
        "model_type": "sklearn_logistic_regression",
        "description": "StandardScaler + LogisticRegression(balanced); matches fraud_pipeline.ipynb",
        "feature_names": feature_names,
        "shipping_states": states,
        "payment_methods": PAYMENT,
        "device_types": DEVICE,
        "ip_countries": COUNTRY,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "coef": clf.coef_[0].tolist(),
        "intercept": float(clf.intercept_[0]),
        "decision_threshold": decision_threshold,
        "metrics": {
            "val_f1_at_threshold": val_f1,
            "test_roc_auc": test_auc,
            "test_f1_at_threshold": test_f1,
        },
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_JSON}")

    try:
        import joblib

        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(log_reg, MODELS_DIR / "fraud_model.sav")
        joblib.dump(rf, MODELS_DIR / "fraud_model_rf.sav")
        print(f"Wrote {MODELS_DIR / 'fraud_model.sav'} (logistic pipeline) and fraud_model_rf.sav")
    except Exception as e:
        print(f"(optional) joblib export skipped: {e}")


if __name__ == "__main__":
    main()
