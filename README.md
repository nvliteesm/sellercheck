# SellerCheck 

A free, browser-only pre-flight check for Singapore data sellers. Before you sign up or submit, it shows which files are likely to fail required checks for credentials in code and Singapore personal data (NRIC/FIN, phone numbers, emails, addresses), with the file, line, reason and fix.

**Status:** the rule engine, the Web Worker scanner, file intake (file picker, folder picker, drag and drop) and Cancel are built and tested. The full results view (findings with reason and fix) and copy-report are next.

## Privacy model

Nothing leaves your device.

- Files are read and scanned in your browser, in a Web Worker. There is no backend.
- The page loads no remote scripts or fonts, has no analytics, and stores nothing in the browser.
- The site is served with a Content Security Policy (see [`vercel.json`](vercel.json)) that sets `connect-src 'none'` and `form-action 'none'`, so the browser itself blocks any attempt to send data.
- Values are masked inside the worker before they reach the page.

You can check this yourself in the browser's developer tools: the Network tab shows no requests beyond the page's own files.

## Not legal advice

Results are advice only. A clean result ("No issues found in scanned files") is not permission to sell data and is not legal advice. It covers only the files that were scanned and the patterns listed. DataVendor's own required checks decide whether a listing is accepted.

## Run locally

Requires Node.js 20.19 or later.

```sh
npm ci            # install pinned dependencies
npm run dev       # start the dev server
npm test          # run unit and component tests
npm run typecheck # strict TypeScript check
npm run build     # typecheck and build to dist/
npm run preview   # serve dist/ with the same security headers as production
```

## Project layout

```
src/
  App.tsx, main.tsx
  components/   UI components
  lib/          file reading and report helpers
  worker/       scanner worker and its typed message protocol
  rules/        Singapore rule pack (rules as data)
tests/          unit and component tests
  fixtures/     dummy files with invented data and fake keys only
vercel.json     CSP and security headers
```

## Test fixtures

`tests/fixtures/` holds four dummy files with invented people and fake keys. None of the keys are real. See [`tests/fixtures/README.md`](tests/fixtures/README.md) for the expected results.
