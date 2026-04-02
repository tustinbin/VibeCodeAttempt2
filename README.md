# IS 455 — Shop fraud pipeline & deployed web app

This repository is a **course deployment project** (IS 455, Chapter 17): a **Next.js** web app backed by a **PostgreSQL** database (e.g. Supabase), plus a **CRISP-DM** fraud-detection notebook and training scripts that export a model for the live “Run scoring” flow.

---

## What’s in the repo (high level)

| Path | Purpose |
|------|--------|
| **`instructions.txt`** | Pasted assignment text (Vercel app + notebook deliverables). |
| **`shop.db`** | SQLite **source of truth** for the assignment dataset (customers, orders, products, etc.). |
| **`web/`** | **Next.js 16** app: customer selection, place order, admin order history, **Run scoring** (ML inference). Deployed to **Vercel**; reads **`DATABASE_URL`** (or embedded fallback in `web/src/lib/db.ts`). |
| **`fraud_pipeline.ipynb`** | Jupyter notebook: EDA, **same featurization** as training script, **sklearn** `Pipeline(StandardScaler + LogisticRegression)` and **RandomForest**, evaluation, optional `joblib` saves. |
| **`scripts/train_export_model.py`** | Trains on `shop.db`, exports **`web/public/model.json`** (for Node) and **`models/fraud_model.sav`** / **`models/fraud_model_rf.sav`** (for Python). |
| **`scripts/migrate_sqlite_to_supabase.py`** | One-shot tool to load `shop.db` into Postgres (used when seeding Supabase). |
| **`requirements-ml.txt`** | Python deps for training (`numpy`, `pandas`, `scikit-learn`). |
| **`models/`** | Created when you run the training script; holds **`.sav`** joblib dumps. |

---

## Web application (`web/`)

- **Framework:** Next.js (App Router), TypeScript, Tailwind.
- **Database:** Postgres via the `postgres` package; use the **Supabase transaction pooler** URI (port **6543**) on Vercel so serverless works with PgBouncer (`prepare: false` in `db.ts`).
- **Main flows**
  - **Select customer** → **Place order** (writes to `orders` / `order_items`).
  - **Admin** → lists orders with **dataset label** `is_fraud` (from imported data) and **model prediction** `predicted_is_fraud` after scoring.
  - **Run scoring** → `POST /api/run-scoring` loads `public/model.json`, scores each order, updates `predicted_is_fraud`.

Copy **`web/.env.example`** to **`web/.env.local`** and set `DATABASE_URL` if you do not rely on the embedded default in `db.ts`.

**Build / run locally**

```bash
cd web
npm install
npm run dev
```

---

## Machine learning pipeline

### 1. Notebook (`fraud_pipeline.ipynb`)

- Loads **`shop.db`**, builds features (numeric fields, ZIP mismatch, one-hot payment / device / country / **sorted shipping states**).
- Trains **logistic regression** (balanced) and **random forest** for comparison.
- You can save models with **joblib** to `models/*.sav` (see notebook).

### 2. Training & export (`scripts/train_export_model.py`)

Run from the **repository root**:

```bash
pip install -r requirements-ml.txt
python scripts/train_export_model.py
```

This script:

1. Fits the **same logistic pipeline** as the notebook (scaler + balanced logistic).
2. Picks a **`decision_threshold`** on a validation split (F1 search over probability).
3. Writes **`web/public/model.json`** — scaler means/scales, coefficients, intercept, threshold, and metadata.
4. Writes **`models/fraud_model.sav`** (logistic pipeline) and **`models/fraud_model_rf.sav`** (forest).

### 3. Why both `model.json` and `.sav`?

- **`.sav`**: Full sklearn object; load in Python with `joblib.load("models/fraud_model.sav")`. Good for notebooks, reports, or submission requirements.
- **`model.json`**: The **deployed** app runs on **Node** and cannot execute sklearn pickles. Inference reimplements the linear model: scale features, then **σ(logit)** as **P(fraud)**, compare to **`decision_threshold`**.

The TypeScript featurization must stay **byte-for-byte aligned** with `train_export_model.py` / the notebook (`web/src/lib/featurize.ts`).

---

## Database seeding (SQLite → Supabase)

If Postgres is empty or you need to reset from `shop.db`:

```bash
python scripts/migrate_sqlite_to_supabase.py
```

(Requires `psycopg2-binary` and a valid `DATABASE_URL` in that script or via env.)

---

## API routes (under `web/src/app/api/`)

| Route | Role |
|-------|------|
| `GET /api/customers` | List customers for selection. |
| `GET /api/products` | Products for cart. |
| `POST /api/orders` | Create order + line items. |
| `GET /api/admin/orders` | Admin table data. |
| `POST /api/run-scoring` | Batch score all orders; updates `predicted_is_fraud`. |

---

## Important: “Dataset label” vs “Predicted (model)”

- **`is_fraud`** in the database comes from **`shop.db`** — it is the **ground truth column** in the class dataset, not the live model.
- **`predicted_is_fraud`** is whatever **`model.json`** produces after **Run scoring**.

Do not confuse the two when judging whether the model “works.”

---

## Known limitation — ML is still not functioning as a reliable product

**Status (verified):** Fraud prediction in this project is **not** behaving like a trustworthy production system yet. The plumbing exists (training script → JSON → API), but **end-to-end behavior is still wrong or misleading** in practice.

Reasons this happens (any combination may apply):

1. **Train vs deploy distribution** — The model and threshold are fit on **`shop.db`**. Live orders on Supabase can differ (new customers, drift, or slightly different feature values), so probabilities and errors won’t match notebook metrics.
2. **JSON reimplementation** — Node inference **must** match sklearn’s scaling and linear algebra exactly. Any mismatch (state ordering, missing state, float quirks) silently breaks predictions.
3. **Threshold tuning** — `decision_threshold` is chosen on a **validation split of the training run**, not on your live traffic. It can be miscalibrated for real orders.
4. **Model quality** — The logistic model may have **weak ROC-AUC / F1** on held-out data; the notebook prints metrics. A bad model will look “broken” even if the code path is correct.
5. **Stale artifact** — If **`model.json`** was not regenerated and redeployed after changing `shop.db` or the training code, the site scores with an **out-of-date** model.
6. **Random forest** — The forest is **not** used in Vercel; only the logistic export in **`model.json`** is. Expect different behavior if you compare notebook RF to the site.

**What to do next (for contributors):**

- Re-run **`python scripts/train_export_model.py`**, commit **`web/public/model.json`**, redeploy.
- In the notebook, inspect **confusion matrix / ROC-AUC** and feature sanity checks.
- Compare a few rows: sklearn `predict_proba` in Python vs what you’d get from the same features in TS (add temporary logging if needed).

---

## Security note

Avoid committing **production database passwords**. Prefer **environment variables** on Vercel and rotate credentials if they were ever committed or shared.

---

## License / course use

Built for an academic assignment; not warranted for real fraud prevention.
