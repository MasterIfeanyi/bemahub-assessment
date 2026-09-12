# Task 5 — Database

> Paste the **terminal output** of every query, not just the SQL. For this task
> the output is the answer.

## 5.1 Investigate — NULL vs 0

```sql
SELECT id, title,
  CASE WHEN enrolment_count IS NULL THEN 'NULL' ELSE CAST(enrolment_count AS CHAR) END AS enrolment_count,
  CASE WHEN average_rating IS NULL THEN 'NULL' ELSE CAST(average_rating AS CHAR) END AS average_rating
FROM wp_bl_courses;
```

```
+----+------------------------------+-----------------+----------------+
| id | title                        | enrolment_count | average_rating |
+----+------------------------------+-----------------+----------------+
|  1 | Introduction to Bread Baking | 128              | 4.60           |
|  2 | Sourdough Starters           | 64               | 4.20           |
|  3 | Pastry Fundamentals          | NULL             | NULL           |
|  4 | Cake Decorating Basics       | 9                | 0.00           |
|  5 | Advanced Laminated Dough     | 0                | NULL           |
+----+------------------------------+-----------------+----------------+
```

**Which rows are genuinely 0, and which are NULL?**

- Course 3 ("Pastry Fundamentals") is genuinely `NULL` on both fields: it has
  never been counted or rated.
- Course 5 ("Advanced Laminated Dough") has a real `enrolment_count` of `0`
  (measured, zero enrolments so far) but a `NULL` `average_rating` (no ratings
  yet, not a rated-zero).
- Course 4 ("Cake Decorating Basics") has a real `average_rating` of `0.00`
  (it has actually been rated, and the rating came out to zero), alongside a
  real, non-zero `enrolment_count` of `9`.

**Why does this matter to a user?** If `NULL` and `0` are displayed the same
way, an instructor whose course simply hasn't been counted or rated yet looks
identical to one that has genuinely zero enrolments or a rock-bottom rating,
which is misleading and unfair to that instructor. The two states mean very
different things ("we have no data yet" versus "we have data, and it's zero"),
and collapsing them into one display hides real information from the user.

## 5.2 The constraint (the important one)

**Proof — two inserts with the same instructor_id and payout_reference, both
with cancelled_at NULL:**

```sql
INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, created_at)
VALUES (2, 60000, 'pending', 'dup-proof-001', NOW());

INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, created_at)
VALUES (2, 60000, 'pending', 'dup-proof-001', NOW());

SELECT id, instructor_id, payout_reference, cancelled_at
FROM wp_bl_withdrawals WHERE payout_reference='dup-proof-001';
```

```
+----+---------------+-------------------+--------------+
| id | instructor_id | payout_reference  | cancelled_at |
+----+---------------+-------------------+--------------+
|  1 |             2 | dup-proof-001     | NULL         |
|  2 |             2 | dup-proof-001     | NULL         |
+----+---------------+-------------------+--------------+
```

**Did the unique key prevent the duplicate? If not, exactly why?**

No. Both inserts succeeded with no error, producing two separate rows with
the identical `instructor_id` and `payout_reference`. The original key is
`UNIQUE KEY uq_reference (instructor_id, payout_reference, cancelled_at)`.
In MySQL (and SQL generally), a unique index treats each `NULL` as
"unknown", and two unknowns are never considered equal to one another for
uniqueness purposes. Since `cancelled_at` is `NULL` on both rows here, the
index sees the `cancelled_at` column as not matching, even though it holds
the same value (NULL) on both rows, so the three-column combination never
collides and the duplicate is let through. This is a real duplicate-payout
risk: a retried withdrawal request could create two separate payouts instead
of being recognised as the same one.

### The fix — `database/migrations/002_fix_withdrawal_reference.sql`

**Why a new migration rather than editing `001_initial.sql`:** `001_initial.sql`
has already been applied to the running database; editing it changes nothing
for this database and would silently rewrite the schema history for anyone
who applies the migrations fresh later, so the fix has to be forward-only.

Migration contents:

```sql
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
```

**Applying it:**

```
$ docker compose exec -T db mysql -u bemalearn -passessment bemalearn < ../database/migrations/002_fix_withdrawal_reference.sql
(no errors — ran cleanly, including the duplicate-cleanup step, which
cancelled one of the two dup-proof-001 rows created above)
```

**`SHOW CREATE TABLE wp_bl_withdrawals;` afterwards:**

```sql
CREATE TABLE `wp_bl_withdrawals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `instructor_id` bigint unsigned NOT NULL,
  `amount_minor` int unsigned NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT 'pending',
  `payout_reference` varchar(64) COLLATE utf8mb4_unicode_520_ci DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active_reference` varchar(64) COLLATE utf8mb4_unicode_520_ci
    GENERATED ALWAYS AS (if((`cancelled_at` is null),`payout_reference`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reference_active` (`instructor_id`,`active_reference`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci
```

**The duplicate insert, re-run and now rejected:**

```
$ docker compose exec db mysql -u bemalearn -passessment bemalearn -e "INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, created_at) VALUES (2, 60000, 'pending', 'dup-proof-001', NOW());"
ERROR 1062 (23000) at line 1: Duplicate entry '2-dup-proof-001' for key 'wp_bl_withdrawals.uq_reference_active'
```

The same insert that succeeded twice before the fix now correctly fails with
a duplicate-key error.

## 5.3 The join

```sql
SELECT c.id, c.title,
  COUNT(e.id) AS non_refunded_enrolments,
  COALESCE(SUM(e.amount_paid_minor), 0) AS non_refunded_revenue_minor
FROM wp_bl_courses c
LEFT JOIN wp_bl_enrolments e
  ON e.course_id = c.id AND e.refunded_at IS NULL
GROUP BY c.id, c.title
ORDER BY c.id;
```

```
+----+------------------------------+--------------------------+-----------------------------+
| id | title                        | non_refunded_enrolments  | non_refunded_revenue_minor  |
+----+------------------------------+--------------------------+-----------------------------+
|  1 | Introduction to Bread Baking |                        2 |                        9000 |
|  2 | Sourdough Starters           |                        0 |                           0 |
|  3 | Pastry Fundamentals          |                        0 |                           0 |
|  4 | Cake Decorating Basics       |                        0 |                           0 |
|  5 | Advanced Laminated Dough     |                        0 |                           0 |
+----+------------------------------+--------------------------+-----------------------------+
```

**Which join type did you use, and what would break with the other one?**

`LEFT JOIN`, with `wp_bl_courses` as the left (driving) table. An `INNER JOIN`
only returns rows where a match exists on both sides, so any course with no
non-refunded enrolments at all (either no enrolments, or every enrolment
refunded) would disappear from the results entirely instead of showing `0`,
which the task explicitly requires. The `refunded_at IS NULL` filter is
placed inside the `ON` clause rather than a `WHERE` clause deliberately: a
`WHERE` filter would run after the join and effectively turn the `LEFT JOIN`
back into an inner join for any course whose only enrolments were refunded,
since those rows would have `NULL` enrolment columns that then fail the
`WHERE` condition and get dropped. Filtering inside `ON` keeps every course
row intact while still only counting the non-refunded enrolments.