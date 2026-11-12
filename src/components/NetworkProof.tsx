import { useState } from 'react'
import { secondaryButton, summaryClass } from './ui'

/**
 * Fixed test target. The request carries no file content, only the word "test", and the
 * .invalid domain can never resolve, so even a copy of the page without its security policy
 * cannot reach a server with it.
 */
export const PROOF_URL = 'https://sellercheck-network-test.invalid/'

export type ProofResult = { kind: 'blocked'; detail: string } | { kind: 'unprotected' }

/**
 * Try to send a request and report whether the security policy blocked it. On the deployed site
 * the Content Security Policy (connect-src 'none') blocks it before anything leaves the device.
 * Only a policy violation counts as blocked; any other failure means the policy is missing.
 */
export async function tryToSendData(doFetch: typeof fetch = fetch): Promise<ProofResult> {
  let directive = ''
  const onViolation = (e: SecurityPolicyViolationEvent) => {
    directive = e.effectiveDirective || e.violatedDirective
  }
  document.addEventListener('securitypolicyviolation', onViolation)
  try {
    await doFetch(PROOF_URL, { method: 'POST', body: 'test', mode: 'no-cors', cache: 'no-store' })
  } catch {
    // Expected either way: blocked by the policy, or the .invalid name not resolving.
  }
  try {
    // Let the violation event, which fires asynchronously, arrive.
    await new Promise((r) => setTimeout(r, 50))
    return directive
      ? { kind: 'blocked', detail: `Blocked by the security policy (${directive}).` }
      : { kind: 'unprotected' }
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
    <details className="text-sm">
      <summary className={summaryClass}>Prove nothing leaves this page</summary>
      <div className="mt-2 space-y-2">
        <p className="text-slate-700">This tries to send the word "test" to another website. It should be blocked.</p>
        <button type="button" onClick={run} disabled={result === 'pending'} className={secondaryButton}>
          Try to send data
        </button>
        <p role="status">
          {result === 'pending' && 'Trying…'}
          {result && result !== 'pending' && result.kind === 'blocked' && (
            <span className="font-medium text-emerald-800">{result.detail} Nothing was sent.</span>
          )}
          {result && result !== 'pending' && result.kind === 'unprotected' && (
            <span className="font-medium text-red-800">
              Not blocked. This copy of the page is running without its security policy.
            </span>
          )}
        </p>
      </div>
    </details>
  )
}
