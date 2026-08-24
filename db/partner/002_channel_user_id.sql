-- The platform's own user id, alongside the handle.
--
-- A handle is not an identity: Discord usernames and Telegram usernames can both be changed by
-- their owner, and freed handles can be claimed by someone else. Verifying "@gulfsignals" and
-- storing only that means a later rename silently transfers the verified status to a stranger.
-- The numeric id never changes, so it is the real key; `handle` is kept for display.

ALTER TABLE partner_contact ADD COLUMN IF NOT EXISTS channel_user_id TEXT;

-- Two partner addresses behind one platform account is the shared-contact case the risk screen
-- reports. Indexed because that lookup groups on it.
CREATE INDEX IF NOT EXISTS partner_contact_channel_user_idx
  ON partner_contact (channel, channel_user_id);
