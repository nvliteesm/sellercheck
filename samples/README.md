# Sample files to try

Five invented files in different formats for trying SellerCheck by hand. No real people, keys or
accounts. NRIC and FIN values are made up but pass the checksum, so the scanner treats them as real.
These are not used by the tests (those live in `tests/fixtures`).

| File | Blockers | Review | What it is |
| --- | --- | --- | --- |
| orders-export.jsonl | 2 | 9 | Order export with buyer NRICs, emails, +65 phones and addresses |
| app-server.log | 1 | 3 | Server log that leaked a GitHub token, plus user emails and a phone (support@ skipped) |
| shop-config.yaml | 0 | 4 | Shop config with a hard-coded SMTP password, phone, owner email and address (support@ skipped) |
| customers-dump.sql | 3 | 4 | SQL dump with S, F and G series IDs and emails; row 4's ID has a wrong check letter and is ignored |
| delivery_fee.py | 0 | 0 | Clean code file: "No issues found in scanned files" |

All five together: 6 blockers, 20 to review, 2 generic emails skipped.
