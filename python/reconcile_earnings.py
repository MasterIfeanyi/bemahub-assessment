#!/usr/bin/env python3
"""
Operational reconciliation script.

Reads a payouts export and reports, per instructor, how much was paid.
Operations runs this after each payout batch to check the provider's file
against what we expected to send.

Usage:
    python3 reconcile_earnings.py payouts.json

Exit codes:
    0  reconciled cleanly
    1  usage error
    2  file could not be read or parsed
    3  discrepancies found
"""

import json
import sys


def load_payouts(path):
    with open(path) as fh:
        return json.load(fh)


def summarise(payouts):
    """Total the payouts per instructor.

    Only PAID rows count towards the total. A failed or pending payout has not
    moved any money.

    A row with a missing or null fee_minor is treated as a data problem, not
    a zero fee: silently assuming "no fee" on a money-reconciliation script
    could hide a real charge that just wasn't recorded. Such rows are skipped
    from the totals and reported separately so a human can check them.
    """
    totals = {}
    unknown_fee = []

    for row in payouts:
        if row.get("status") != "paid":
            continue

        instructor = row["instructor_id"]
        amount = row["amount_minor"]
        fee = row.get("fee_minor")

        if fee is None:
            unknown_fee.append(instructor)
            continue

        net = amount - fee

        if instructor not in totals:
            totals[instructor] = 0
        totals[instructor] += net

    return totals, unknown_fee


def main(argv):
    if len(argv) != 2:
        print("usage: reconcile_earnings.py <payouts.json>", file=sys.stderr)
        return 1

    try:
        payouts = load_payouts(argv[1])
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"error: could not read {argv[1]}: {exc}", file=sys.stderr)
        return 2

    totals, unknown_fee = summarise(payouts)

    print("instructor_id,total_net_minor")
    for instructor, total in sorted(totals.items()):
        print(f"{instructor},{total}")

    if unknown_fee:
        print(f"warning: {len(unknown_fee)} paid row(s) had a missing/null fee_minor and were excluded: instructor ids {unknown_fee}", file=sys.stderr)
        return 3

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
