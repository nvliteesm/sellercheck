# SellerCheck SG: a pre-flight check for DataVendor sellers

One-page brief for HUD · Steven Lim · November 2026

> Unofficial concept. Not affiliated with HUD or DataVendor, and built only from public pages and docs. Not legal advice. Any figure marked *illustrative* is invented to explain the idea. It is not HUD data.

## The idea

DataVendor's required checks already look for credentials and personal data, but a seller only sees the result after signing up, accepting the agreements, building a listing and waiting through a locked review.

**Hypothesis:** a free check that runs in the seller's browser and shows the same kind of problem *before* sign-up will:

1. raise the share of listings that pass on the first submission, and
2. turn more visitors into sellers, because they get something useful before handing over anything.

This is not meant as a better scanner. It moves a light version of the same feedback to the front of the funnel.

| Job | Today (public journey) | With a pre-flight check |
| --- | --- | --- |
| Acquisition | The estimator asks for GitHub access or contact details before it shows anything | A useful result with no access, no account and no upload |
| Activation | Problems with credentials or personal data surface after a locked review | The seller fixes them before the first submission |
| Trust | "We handle your data carefully" | "Nothing leaves your device", which a seller can test in the browser |

## What the prototype does

- **Runs in the browser:** the seller drops in files or a folder. A background worker scans them against a Singapore rule pack.
- **Gives one verdict** (*Likely blocked*, *Needs review*, or *No issues found in scanned files*), always with the number of files scanned and skipped.
- **Lists every finding** with its file, line, a masked value, the reason and the fix. The report can be copied as plain text.
- **Blockers** cover only formats specific enough to be almost certainly real: private keys, AWS access keys, live Stripe, GitHub and Slack tokens, and NRIC/FIN numbers that pass the checksum.
- **Review items** cover heuristic matches: passwords in code or `.env` files, passport numbers, Singapore phone numbers, email addresses and Singapore addresses.
- **No network:** the page sends nothing. A browser security policy (CSP, `connect-src 'none'`) blocks every request, and a "Try to send data" button proves it on the spot.

**Measured in headless Chromium (4-CPU machine, production build):**

| Check | Result |
| --- | --- |
| Accessibility audit (axe, WCAG 2.2 AA) | 0 violations |
| Keyboard-only use | Works |
| Large folder (1,000 files, 24 MB) | Verdict in 4.1 s against a 10 s target |

Firefox and Safari have not been tested.

## Proposed pilot: A/B link (needs HUD)

The tool has no analytics by design, so it cannot measure its own impact. HUD would show a "Run a pre-flight check" link on the estimator and listing form to a random half of new sellers for 4 to 6 weeks, then compare the two groups using data it already has. The tool still sends nothing.

**Example: Wei, a data owner at a Singapore retailer** *(illustrative)*

| | Without the link (today) | With the link |
| --- | --- | --- |
| 1 | Connects GitHub or gives contact details to see an estimate | Drops the folder in. No account, nothing uploaded |
| 2 | Signs up, accepts the agreements, builds the listing, submits | Sees *Likely blocked*: 3 NRIC numbers in `members.csv` and a cloud key in `config.js` |
| 3 | Review locks; days later the listing is blocked over the NRICs | Fixes both in an hour, then signs up and submits |
| 4 | Fixes, resubmits, waits again; live on attempt 2 | Live on attempt 1 |

**What HUD would compare, per group:**

- **First-attempt pass rate** (the north star)
- **Visitor to sign-up**
- **Resubmissions per listing**
- **Time to first live listing**

**Guardrail:** sellers who were told "No issues found" but were then blocked on a pattern the tool covers. That number should trend towards zero.

*Illustrative* outcome to show the shape of the result, not a forecast:

| Metric | Without link | With link |
| --- | --- | --- |
| First-attempt pass rate | 55% | 70% |
| Visitor to sign-up | 4% | 6% |
| Resubmissions per listing | 1.8 | 1.3 |

If the link doesn't win, HUD learns that cheaply. A fallback (an opt-in anonymous counter) exists, but it would open one network endpoint and weaken the privacy claim, so it is not the recommendation.

## Known gaps and limits

- **Not detected:**
  - M-series FIN, because the checksum hasn't been confirmed from an official source
  - personal names
  - JSON Web Tokens
  - cloud keys other than AWS
  - payment card numbers
  - unquoted secrets with lower-case names in `.ini` or `.properties` files
- **Not scanned:**
  - binaries, PDFs, images and archives
  - files over 1.5 MB
  - anything beyond 3,000 files
  - `node_modules`, `.git` and build output
  - lines are read only up to 4,000 characters
- **Pattern matching only:** a clean result means "no issues found in the scanned files". It is not permission to sell the data.
- **Singapore only** in version 1. The rules are data, so another country is a new rule pack.
- **Policy basis, to be verified by Steven:** the NRIC finding cites PDPC advisory guidance that organisations generally should not collect, use or disclose NRIC and other national ID numbers, with limited exceptions. It also cites the PDPA's requirement for consent or an exception before personal data is used or disclosed. Both statements still need to be checked against PDPC sources.

## Questions for HUD

1. What share of listings pass required checks on the first attempt, and why do the rest fail?
2. Does any credential or personal-data feedback reach sellers before sign-up today?
3. What do the required checks cover, and for which countries?
4. Where do sellers drop out between the landing page, the estimator and a live listing?
5. Could HUD run a 4 to 6 week A/B link test on the listing form or estimator?

If the answer to question 2 is "yes, already", the idea adds little. That is the first thing worth learning.
