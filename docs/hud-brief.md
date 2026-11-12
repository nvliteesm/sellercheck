# SellerCheck SG: a pre-flight check for DataVendor sellers

Brief for HUD · Steven Lim · November 2026

> Unofficial concept, not affiliated with HUD or DataVendor, built only from public pages and docs. Not legal advice. It uses no HUD data.

**Hypothesis.** Sellers learn about credential and personal-data problems only after sign-up, the agreements and a locked review. A free in-browser check that shows them *before* sign-up should raise the first-attempt pass rate and turn more visitors into sellers, because they get value before giving anything.

| Job | Today (public journey) | With a pre-flight check |
| --- | --- | --- |
| Acquisition | Estimate needs GitHub access or contact details | A result with no access, account or upload |
| Activation | Problems surface after a locked review | Fixed before the first submission |
| Trust | "We handle your data carefully" | "Nothing leaves your device", testable |

**What the prototype does.**

- **Scans in the browser.** The seller drops in files or a folder and gets one verdict (*Likely blocked*, *Needs review* or *No issues found in scanned files*) with scanned and skipped counts. Each finding shows the file, line, masked value, reason and fix.
- **Blocks only on near-certain formats:** private keys, AWS keys, live tokens, and NRIC/FIN numbers that pass the checksum. Heuristic matches (passwords, phones, emails, addresses, passports) are marked for review.
- **Sends nothing.** A Content Security Policy blocks all network requests, and a button on the page proves it.
- **Measured in headless Chromium:** 0 axe violations (WCAG 2.2 AA), usable with the keyboard alone, and 1,000 files (24 MB) scanned in 4.1 s against a 10 s target. Firefox and Safari are not yet tested.

**Proposed pilot (needs HUD).** HUD shows a "Run a pre-flight check" link on the estimator and listing form to a random half of new sellers for 4 to 6 weeks, then compares the two groups using data it already has. The tool still sends nothing.

- **Metrics:** first-attempt pass rate (the north star), visitor to sign-up, resubmissions per listing, and time to first live listing.
- **Guardrail:** sellers shown "No issues found" who are then blocked on a pattern the tool covers. This should trend to zero.

**Known gaps and limits.**

- **Patterns not covered:** M-series FIN, personal names, JSON Web Tokens, cloud keys other than AWS, card numbers, and lower-case unquoted secrets in `.ini` or `.properties` files.
- **Files not scanned:** binaries, PDFs and images, files over 1.5 MB, files beyond the first 3,000, and dependency or build folders. Singapore rules only.
- **Policy basis (to be verified by Steven):** PDPC guidance that organisations are generally not allowed to collect, use or disclose NRIC numbers. A clean result is not permission to sell data.

**Questions for HUD.**

1. What share of listings pass required checks on the first attempt, and why do the rest fail?
2. What do the required checks cover, and does any of that feedback reach sellers before sign-up today? If it does, this idea adds little.
3. Could HUD run a 4 to 6 week A/B link test?
