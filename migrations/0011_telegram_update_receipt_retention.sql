-- OTYA-DESTRUCTIVE-MIGRATION-APPROVED: delete only Telegram webhook replay receipts older than 30 days.
-- Keep the Telegram replay ledger bounded without adding another cron or
-- executing a cleanup query for every webhook. Telegram update IDs are
-- positive, increasing integers; one out of every 128 accepted receipts runs
-- a 30-day prune. If traffic is idle the table is not growing, so cleanup can
-- safely wait for the next qualifying receipt.
CREATE TRIGGER IF NOT EXISTS trg_telegram_update_receipts_retention
AFTER INSERT ON telegram_update_receipts
WHEN (NEW.update_id % 128) = 0
BEGIN
  DELETE FROM telegram_update_receipts
  WHERE received_at < datetime('now', '-30 days');
END;
