import { useState } from 'react'

/** Fixed test target. The request carries no file content: only the word "test". */
export const PROOF_URL = 'https://example.com/sellercheck-network-test'

export type ProofResult = { kind: 'blocked'; detail: string } | { kind: 'sent' }

/**
 * Try to send a request and report whether the browser blocked it. On the deployed site the
 * Content Security Policy (connect-src 'none') blocks it before anything leaves the device.
 */
export async function tryToSendData(doFetch: typeof fetch = fetch): Promise<ProofResult> {
  let directive = ''
  const onViolation = (e: SecurityPolicyViolationEvent) => {
    directive = e.effectiveDirective || e.violatedDirective
  }
  document.addEventListener('securitypolicyviolation', onViolation)
  try {
    await doFetch(PROOF_URL, { method: 'POST', body: 'test', mode: 'no-cors', cache: 'no-store' })
    return { kind: 'sent' }
  } catch {
    // Let the violation event, which fires asynchronously, arrive.
    await new Promise((r) => setTimeout(r, 50))
    return {
      kind: 'blocked',
      detail: directive ? `Blocked by the security policy (${directive}).` : 'Blocked by the browser.',
    }
  } finally {
    document.removeEventListener('securitypolicyviolation', onViolation)
  }
}

export function NetworkProof({ send = tryToSendData }: { send?: () => Promise<ProofResult> }) {
  const [result, setResult] = useState<ProofResult | 'pending'>()

  const run = async () => {
    setResult('pending')
    setResult(await send())
  }

  return (
    <section aria-labelledby="proof-heading" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 id="proof-heading" className="font-medium">
        Check that nothing can leave this page
      </h2>
      <p className="mt-1 text-slate-700">
        This button tries to send the word "test" to another website. The page's security policy should stop it.
        You can also watch the Network tab in your browser's developer tools.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={result === 'pending'}
        className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        Try to send data
      </button>
      <p role="status" className="mt-2">
        {result === 'pending' && 'Trying…'}
        {result && result !== 'pending' && result.kind === 'blocked' && (
          <span className="font-medium text-emerald-800">{result.detail} Nothing was sent.</span>
        )}
        {result && result !== 'pending' && result.kind === 'sent' && (
          <span className="font-medium text-red-800">
            The request was not blocked. This copy of the page is running without its security policy.
          </span>
        )}
      </p>
    </section>
  )
}
