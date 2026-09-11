# SOLUTION.md — copy this to your repository root and fill it in

**Name:**
**Date:**
**Actual time spent:**

---

## 1. What I completed

| Task | Status | Evidence file |
|---|---|---|
| 1 — Course list | done | evidence/task-1-ui.png, evidence/task-1-network.png |
| 2 — Authentication | done | evidence/task-2-signedout.png, evidence/task-2-signedin.png, evidence/task-2-network.png |
| 3 — Withdrawal form | done | evidence/task-3-validation.png, evidence/task-3-server-error.png, evidence/task-3-success.png, evidence/task-3-network.png |
| 4 — PHP defects | 4 of 4 found and fixed | evidence/task-4-curl.txt |
| 5 — Database | not attempted yet | — |
| 6 — Infrastructure | not attempted yet | — |
| 7 — Python | not attempted yet | — |

## 2. What I did NOT finish, and how I would approach it

Tasks 5, 6, and 7 are not started yet.

- **Task 5 (Database, ~22 min):** I already have practical familiarity with the `wp_bl_withdrawals` table from debugging test data during Task 3 and Task 4 (checking pending/cancelled rows, confirming the unique-key behaviour would need investigating). My plan is to write the NULL-vs-0 investigation query first, then prove the unique constraint gap with two real inserts, then write `002_fix_withdrawal_reference.sql` as a forward-only migration.
- **Task 6 (Infrastructure, ~15 min):** No code required, just written reasoning on three incidents. Straightforward to slot in whenever time allows since it doesn't depend on the running environment.
- **Task 7 (Python, ~10 min):** Small, isolated script fix. Lowest point value, planned last if time is tight.

## 3. Task 4 — the defects

For each: what it was, why it is wrong, what I changed, how I proved it.

**Defect 1 (permission):**
`GET /me/earnings` was registered with `permission_callback => check_authenticated`, which only confirms a valid token exists, it never checks the user's role. The contract requires this endpoint to be instructor-only, returning 403 for a learner. This meant any signed-in learner could read another role's earnings data (a real balance, not an empty result). Changed the route to use `check_instructor` instead, which additionally checks for the `bl_instructor` role. Proved it with `curl -i` using a real learner token: before the fix, 200 with real `availableMinor` `pendingMinor` values; after the fix, 403 with `{"code":"forbidden","message":"Instructors only."}`. Both captured in `evidence/task-4-curl.txt`.

**Defect 2 (schema):**
`get_course()` read `$row->lessons_total`, a property that does not exist on the query result (the real database column is `lesson_count`, no "s", no "_total"). In PHP, reading a missing property returns `null` silently, no warning, no crash, and the `?? 0` fallback quietly turned that into `0`. Every course's `lessonCount` in `GET /courses/{id}` always showed `0` regardless of the real value. Confirmed the actual column name with `SHOW COLUMNS FROM wp_bl_courses` and the real value for course 1 (`12`) with a direct `SELECT`. Changed the code to read `$row->lesson_count`. Proved it with curl before (`"lessonCount":0`) and after (`"lessonCount":12`, matching the database), in `evidence/task-4-curl.txt`.

**Defect 3 (contract):**
`get_courses()` (the list endpoint) had no `WHERE` clause filtering on `is_published` at all, unlike `get_course()` (the single-course endpoint), which correctly checked it. This meant the seeded unpublished course (id 5, "Advanced Laminated Dough", `isPublished: false`) appeared in the public `GET /courses` list, which the contract explicitly forbids. Added `WHERE c.is_published = 1` to the list query. Proved it with curl before (course id 5 present in the response) and after (4 courses only, id 5 absent), in `evidence/task-4-curl.txt`.

**Defect 4 (validation):**
`create_withdrawal()` checked the maximum (`amount > $available` → `insufficient_balance`) and whether a withdrawal was already pending, but never checked the amount against `MINIMUM_WITHDRAWAL_MINOR`, even though the contract documents this as a required rule. This meant a withdrawal of 100 minor units (₦1.00), well below the ₦500 minimum, was accepted and a real row was created. Added a check: `if ($amount < self::MINIMUM_WITHDRAWAL_MINOR)` returning `below_minimum` with a 422, matching the shape of the existing `insufficient_balance` check. Proved it with curl before (201 Created, with a real database-generated id and timestamp for the under-minimum withdrawal) and after (422, `{"code":"below_minimum", ...}`), in `evidence/task-4-curl.txt`.

## 4. Specific questions

**Task 1:** How did you handle `previewExpiresInSeconds`, and why?

I read `previewExpiresInSeconds` directly from the API response and pass it into React Query's `refetchInterval`, so the client automatically refetches exactly when the server says the data expires (currently 300 seconds), rather than guessing a fixed polling interval. This avoids both over-fetching and serving data past its stated expiry.

**Task 3:** Why must `payoutReference` be generated once per attempt rather
than regenerated on retry? What would break?

If a request reaches the server and creates the withdrawal, but the response is lost before the client sees it (e.g. a dropped connection), a retry is indistinguishable from a brand new request unless it carries the same reference. A new reference on retry means the server treats it as a fresh withdrawal and pays out twice for one instruction. Reusing the same reference lets the server recognize "I already did this" and return the original result instead of creating a duplicate.

**Task 5.2:** *Not yet answered — Task 5 not started.*

**Task 7:** *Not yet answered — Task 7 not started.*

## 5. Anything wrong in our brief

One small ambiguity noticed while building Task 3: a successful withdrawal response returns `"status": "pending"` (per the contract's own 201 example), so the UI's success message reads "Withdrawal requested: pending." At first glance during testing this looked like it might be an error rather than a success, since "pending" doesn't immediately read as "it worked." Not a contradiction, just worth flagging as something a first-time user of the API could misread. Handled it by showing an explicit "Withdrawal requested" prefix rather than just echoing the raw status word alone.

## 6. AI Tool Usage — required

**Which tools did you use?** Claude (chat), used interactively throughout
Tasks 1–4, plus a separate Claude Code session for part of Task 2.

### 6a. Where AI was used

| Task | What AI produced | Accepted / rejected / modified |
|---|---|---|
| 1 | I used AI to review existing scaffolded files together before writing anything | I accepted after understanding the reasoning and implementation |
| 2 | AI was used to build out the response interceptor, login/earnings pages, sign-out button | I manually tested all four scenarios (signed out, signed in, sign-out, learner-vs-instructor on /earnings) before treating it as done |
| 3 | Full withdrawal form code provided directly on request (zod schema, `WithdrawalForm.tsx`, `withdrawals.ts` mutation hook, idempotency-key wiring) | Accepted as given, but manually ran all four evidence scenarios (validation, server error, success, network) to confirm it actually worked end to end, including diagnosing a real `withdrawal_in_progress` state that came from my own earlier test data, not a bug |
| 4 | Diagnosis walked through step by step (what to compare, what to look at) rather than handed the fixes outright; I located and typed each fix myself | Accepted the diagnosis; one of my own fixes (`lesson_count` column name) had a typo on my first attempt (`lessons_count`), which I caught myself by cross-checking against a direct SQL `SELECT` rather than trusting the API response alone |
| 8 (this file) | Structure and draft wording for this SOLUTION.md, based on the actual work done in this conversation | Reviewing and will edit before submitting; treat this as a first draft |

### 6b. What you accepted or rejected, and why

I didn't reject any AI suggestions outright in this session, but I didn't take any of them on faith either: every fix in Task 4 was verified with a real `curl -i` before/after pair, and Task 3's flow was verified by actually clicking through the UI four separate times and checking the database directly when the behaviour looked unexpected (e.g. the "already pending" message that turned out to be correct, not a bug). The one place I caught and fixed something myself was the `lessons_count` vs `lesson_count` typo in Task 4, found because I cross-checked the API's `lessonCount: 0` against a direct `SELECT lesson_count FROM wp_bl_courses`, which showed the real value was `12`, telling me the fix hadn't actually landed yet.

### 6c. What you verified yourself, and how

- **Task 1:** Confirmed null-vs-zero rendering against the real API response for course ids 3 (`enrolmentCount: null`, `averageRating: null`) and 4 (`averageRating: 0`), checked in the browser and in DevTools Network.
- **Task 2:** Manually tested `/earnings` signed out, signed in as instructor, signed out again, and signed in as learner, and captured the actual 200 response body for the learner case as evidence of the bug (later fixed in Task 4).
- **Task 3:** Ran the withdrawal form four separate times through the actual UI, and after each attempt queried `wp_bl_withdrawals` directly via `mysql -u bemalearn ...` to see the real row state (pending/cancelled) rather than trusting the UI message alone.
- **Task 4:** For every one of the 4 defects, ran `curl -i` against the live API before and after each fix (temporarily reverting the fix to capture a "before" snapshot), and additionally ran a direct SQL query (`SHOW COLUMNS`, `SELECT lesson_count`) to confirm the schema-mismatch fix matched real data rather than just checking the response changed shape.

### 6d. Assumptions you made

*No answer*

## 7. Assumptions and trade-offs

- I did not add any validation, filtering, or hardening beyond the 4 documented Task 4 defects, per the brief's explicit instruction not to "fix" things the contract doesn't ask for.

- For Task 3, I generated `payoutReference` with `crypto.randomUUID()` client-side and stored it in a `ref` so it persists across a failed submit but resets after a real success, the contract said to "generate it once per attempt."

## 8. If this went to production tomorrow

- I guess I would add automated unit tests for the frontend or backend changes, today everything was verified manually via curl, SQL, and the browser.
- The `pending`-withdrawal check and the subsequent insert in `create_withdrawal()` are two separate queries, not wrapped in a transaction or row lock. Two near-simultaneous requests could both pass the "no pending withdrawal" check before either one inserts, a race condition I did not test for and did not fix, since it's outside the 4 documented defects.
- I sent `payoutReference` in both the request body and the `Idempotency-Key` header as required, but I did not verify whether the backend actually enforces the header value separately from the body value, only that the body-based idempotency (matching on `instructor_id` + `payout_reference`) works as tested.
- Tasks 5, 6, and 7 are not done yet. In prod, those would be the immediate risk, particularly Task 5, since the unique-key gap it targets is a real duplicate-payout risk in the same withdrawal flow Task 3 and Task 4 already touch.