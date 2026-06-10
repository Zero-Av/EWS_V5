import psycopg2
from psycopg2.extras import DictCursor
import os

DB_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/ews")

class SQLiteRowLikeDictCursor(DictCursor):
    def fetchone(self):
        res = super().fetchone()
        return self._wrap(res) if res else None
        
    def fetchall(self):
        res = super().fetchall()
        return [self._wrap(r) for r in res] if res else []
        
    def _wrap(self, row):
        # DictRow supports integer indexing like row[0] natively in psycopg2
        return row

def _connect():
    conn = psycopg2.connect(DB_URL, cursor_factory=SQLiteRowLikeDictCursor)
    conn.autocommit = False
    return conn
