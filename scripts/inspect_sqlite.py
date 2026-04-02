import sqlite3
import json
import sys

DB = r"c:\Users\William\Documents\.Personal Documents\.Winter 2026\Junior Core\IS 455\Deployment\VibeCodeAttempt2\shop.db"

def main():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    rows = c.execute(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"
    ).fetchall()
    for r in rows:
        print("===", r["type"], r["name"], "===")
        print(r["sql"])
        print()
    # indexes/triggers without sql?
    tables = [r["name"] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()]
    for t in tables:
        n = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"COUNT {t}: {n}")
    c.close()

if __name__ == "__main__":
    main()
