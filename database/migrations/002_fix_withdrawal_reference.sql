-- Drop the broken unique key
ALTER TABLE wp_bl_withdrawals DROP INDEX uq_reference;

-- A generated column that only carries a value while the withdrawal is
-- still active. Cancelled withdrawals collapse to NULL and drop out of
-- the uniqueness check entirely, since a cancelled reference is safe to reuse.
ALTER TABLE wp_bl_withdrawals
  ADD COLUMN active_reference VARCHAR(64)
    GENERATED ALWAYS AS (IF(cancelled_at IS NULL, payout_reference, NULL)) STORED;

-- Clean up existing duplicates before the new unique key can be created
-- (keep the earliest active row per instructor+reference, cancel the rest)
UPDATE wp_bl_withdrawals w
JOIN (
  SELECT MIN(id) AS keep_id, instructor_id, payout_reference
  FROM wp_bl_withdrawals
  WHERE cancelled_at IS NULL
  GROUP BY instructor_id, payout_reference
  HAVING COUNT(*) > 1
) dupes ON w.instructor_id = dupes.instructor_id
       AND w.payout_reference = dupes.payout_reference
       AND w.id != dupes.keep_id
SET w.status = 'cancelled', w.cancelled_at = NOW()
WHERE w.cancelled_at IS NULL;

-- Now safe to add the real constraint
ALTER TABLE wp_bl_withdrawals
  ADD UNIQUE KEY uq_reference_active (instructor_id, active_reference);