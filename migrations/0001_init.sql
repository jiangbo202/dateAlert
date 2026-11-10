-- 0001_init.sql — date_alert 初始结构

CREATE TABLE IF NOT EXISTS reminders (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  due_date       TEXT NOT NULL,
  is_public      INTEGER NOT NULL DEFAULT 1,
  is_done        INTEGER NOT NULL DEFAULT 0,
  done_at        TEXT,
  done_by        TEXT,
  notify_mode    TEXT NOT NULL DEFAULT 'global',
  notify_offsets TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_done, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_public ON reminders(is_public, is_done, due_date);

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash        TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip         TEXT,
  ua         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  ts TEXT NOT NULL,
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, ts);

CREATE TABLE IF NOT EXISTS notify_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key     TEXT NOT NULL,
  local_date  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  trigger     TEXT NOT NULL,
  status      TEXT NOT NULL,
  item_count  INTEGER NOT NULL DEFAULT 0,
  title       TEXT,
  body        TEXT,
  http_status INTEGER,
  elapsed_ms  INTEGER,
  attempts    INTEGER NOT NULL DEFAULT 1,
  error       TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notify_run ON notify_log(run_key, channel);
CREATE INDEX IF NOT EXISTS idx_notify_status ON notify_log(status, created_at);
