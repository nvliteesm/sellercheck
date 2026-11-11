# Dummy fixtures

Invented data for tests. No real people, no real keys. NRIC and FIN values are made up
but pass the checksum on purpose, so the scanner treats them as real.

Expected result for all four files together (PRD appendix):
4 scanned, 0 skipped, 5 blockers, 13 to review, 1 generic email skipped, verdict "Likely blocked".

| File | Expected |
| --- | --- |
| dummy-config.js | 2 blockers (cloud key, payment token), 1 review (password) |
| dummy-customers.csv | 3 blockers (NRIC/FIN S, T, G series), 9 review (3 phones, 3 emails, 3 addresses) |
| dummy-support-chat.txt | 3 review (phone, email, passport) |
| dummy-README.md | 0 findings, 1 generic email skipped (support@) |

## Why the payment token looks odd

GitHub push protection rejects anything shaped exactly like a Stripe live key, even a fake one.
The fixture token `sk_live_FAKE_0000_DUMMY_0000_NOT_REAL` uses underscores so GitHub does not
flag it. The service-token rule (step 3) must therefore accept `[A-Za-z0-9_]` after the prefix.
