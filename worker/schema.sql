CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL,
  identity TEXT,
  large_font INTEGER NOT NULL DEFAULT 0,
  nickname TEXT,
  city TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  members_json TEXT NOT NULL
);
