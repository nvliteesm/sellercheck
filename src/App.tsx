export const APP_TITLE = 'SellerCheck SG'
export const UNOFFICIAL_LABEL = 'Unofficial, not affiliated with HUD or DataVendor'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{APP_TITLE}</h1>
          <p className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
            {UNOFFICIAL_LABEL}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="max-w-prose text-base leading-relaxed text-slate-700">
          A free check that runs entirely in your browser and shows which files are likely to fail
          required checks for credentials and Singapore personal data. Nothing is uploaded.
        </p>
        <p className="mt-6 max-w-prose text-sm text-slate-600">
          Scanning is not built yet. This page is the project scaffold.
        </p>
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-10 text-sm text-slate-600">
        <p>
          Advice only. A clean result is not permission to sell data and is not legal advice.
        </p>
      </footer>
    </div>
  )
}
