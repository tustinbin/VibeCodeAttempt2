"""
Train a fraud model on shop.db and export artifacts for the Next.js app.
Run from repo root: python scripts/train_export_model.py
Outputs:
  - web/public/model.json (inference for TypeScript)
  - models/fraud_model.joblib (for notebook / CRISP-DM submission)
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "shop.db"
OUT_JSON = ROOT / "web" / "public" / "model.json"
OUT_JOBLIB = ROOT / "models" / "fraud_model.joblib"

PAYMENT = ["bank", "card", "paypal", "crypto"]
DEVICE = ["desktop", "tablet", "mobile"]
COUNTRY = ["BR", "CA", "GB", "IN", "NG", "US"]


def load_orders() -> pd.DataFrame:
    con = sqlite3.connect(DB)
    df = pd.read_sql_query("SELECT * FROM orders", con)
    con.close()
    return df


def featurize(df: pd.DataFrame, states: list[str]) -> tuple[np.ndarray, list[str]]:
    """Build design matrix; must stay in sync with web/src/lib/featurize.ts"""
    names: list[str] = [
        "order_subtotal",
        "shipping_fee",
        "tax_amount",
        "order_total",
        "promo_used",
        "zip_mismatch",
    ]
    for p in PAYMENT:
        names.append(f"payment_{p}")
    for d in DEVICE:
        names.append(f"device_{d}")
    for c in COUNTRY:
        names.append(f"country_{c}")
    for s in states:
        names.append(f"state_{s}")

    rows: list[list[float]] = []
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
        for p in PAYMENT:
            base.append(1.0 if pm == p else 0.0)
        dev = str(row["device_type"])
        for d in DEVICE:
            base.append(1.0 if dev == d else 0.0)
        ic = str(row["ip_country"])
        for c in COUNTRY:
            base.append(1.0 if ic == c else 0.0)
        st = str(row["shipping_state"])
        for s in states:
            base.append(1.0 if st == s else 0.0)
        rows.append(base)

    return np.asarray(rows, dtype=np.float64), names


def main() -> None:
    df = load_orders()
    y = df["is_fraud"].astype(int).values
    states = sorted(df["shipping_state"].dropna().unique().tolist())
    X, feature_names = featurize(df, states)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    pipe = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "clf",
                LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42),
            ),
        ]
    )
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    print("ROC-AUC:", roc_auc_score(y_test, proba))
    print(classification_report(y_test, pipe.predict(X_test), digits=3))

    scaler = pipe.named_steps["scaler"]
    clf = pipe.named_steps["clf"]
    means = scaler.mean_.tolist()
    scales = scaler.scale_.tolist()
    coef = clf.coef_[0].tolist()
    intercept = float(clf.intercept_[0])

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JOBLIB.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "version": 1,
        "feature_names": feature_names,
        "shipping_states": states,
        "payment_methods": PAYMENT,
        "device_types": DEVICE,
        "ip_countries": COUNTRY,
        "scaler_mean": means,
        "scaler_scale": scales,
        "coef": coef,
        "intercept": intercept,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)

    joblib.dump(
        {"pipeline": pipe, "feature_names": feature_names},
        OUT_JOBLIB,
    )
    print("Wrote", OUT_JOBLIB)


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
