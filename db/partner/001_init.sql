-- Partner contact details for the partnerships programme.
--
-- Nothing here is on-chain and nothing here is public. The only fact the product ever exposes is
-- the boolean "this partner has a verified channel" — the handle itself never leaves this table.
--
-- Addresses are stored lowercased so a checksummed and an unchecksummed address are one partner.

CREATE TABLE IF NOT EXISTS partner_contact (
  address      TEXT PRIMARY KEY,
  name         TEXT,
  channel      TEXT CHECK (channel IN ('discord', 'telegram', 'email')),
  handle       TEXT,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-shot nonces for wallet login. Rows are deleted the moment they are spent, so a replayed
-- signature finds nothing to match.
CREATE TABLE IF NOT EXISTS partner_nonce (
  nonce       TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS partner_nonce_expires_idx ON partner_nonce (expires_at);

-- An in-flight channel verification. `secret` is the six-digit code we emailed or the token the
-- partner sends to the Telegram bot. `attempts` caps guessing.
CREATE TABLE IF NOT EXISTS partner_contact_challenge (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('discord', 'telegram', 'email')),
  handle      TEXT NOT NULL,
  secret      TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the newest challenge per address matters; the lookup is always address-scoped.
CREATE INDEX IF NOT EXISTS partner_contact_challenge_address_idx
  ON partner_contact_challenge (address, created_at DESC);
