# Demo script (60 to 90 seconds)

## Before you start

- **Use the deployed Vercel URL, or `npm run build && npm run preview`.** Do not use `npm run dev`: it runs without the security header, so step 5 would show "did not block".
- **Put the four dummy files from [`tests/fixtures/`](../tests/fixtures/) in one folder:**
  - `dummy-config.js`
  - `dummy-customers.csv`
  - `dummy-support-chat.txt`
  - `dummy-README.md`

  They hold only invented people and fake keys.

## Script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the empty page | "Today a seller only finds out their files have credentials or personal data after signing up and waiting through a locked review. This check runs before sign-up, in the browser, with no account and no upload." |
| 0:10 | Click **Choose files** and select all four dummy files | "Four files: a config file, a customer CSV, a support chat and a README." |
| 0:15 | The verdict appears: **Likely blocked**, "4 scanned · 0 skipped", "5 likely to block · 13 to review · 1 role email address (such as support@) not flagged" | "One verdict, and it always says how many files it actually checked." |
| 0:25 | Scroll to `dummy-customers.csv` and point at an NRIC finding (`•••••369B`) | "Each finding gives the line, a masked value, why it matters and how to fix it. The full number never leaves the scanner." |
| 0:35 | Point at the cloud key in `dummy-config.js` | "Blockers are only formats that are almost certainly real: keys, live tokens, NRICs that pass the checksum. Anything heuristic, like a password, is marked for review." |
| 0:45 | Click **Copy report** | "The seller can paste this to whoever fixes the files." |
| 0:50 | Scroll down and click **Try to send data** | "Nothing leaves the device, and you can test it: the browser blocks the request." Wait for "Blocked by the security policy (connect-src). Nothing was sent." |
| 1:00 | Open **What this check does not cover** | "And it's honest about what it doesn't check, so a clean result isn't over-read." |
| 1:10 | Close | "I'd want to prove the impact with a 4 to 6 week A/B link on the estimator, measured with your existing data. The first question is whether sellers already get this feedback before sign-up." |

## If something goes wrong

- **"Try to send data" says the request was not blocked:** you are on `npm run dev`. Switch to the preview or deployed URL.
- **The counts differ from the script:** you picked a different set of files. Choose exactly the four files above.
- **Optional extra (adds about 10 s):** pick a whole project folder with **Choose folder** to show the skipped count, for example `node_modules/` listed once.
