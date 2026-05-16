from __future__ import annotations

import os

import psycopg


def main() -> None:
    print("connecting...")
    with psycopg.connect(
        host="aws-1-us-east-2.pooler.supabase.com",
        port=5432,
        dbname="postgres",
        user="postgres.wwxkdnvlksbmpddhooae",
        password=os.environ["DB_PASSWORD"],
        sslmode="require",
        connect_timeout=10,
    ) as conn:
        row = conn.execute("select current_database(), current_user").fetchone()
        print(row)


if __name__ == "__main__":
    main()
