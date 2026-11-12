// "Try a sample" (FR1 demo path). Five made-up files bundled into the app as text, so a first-time
// visitor can see a result without picking files. Nothing is fetched: the text is part of the build.

import type { SkippedFile } from '../worker/protocol'
import type { IntakeFile } from './readFiles'
import appServerLog from '../samples/app-server.log?raw'
import customersDump from '../samples/customers-dump.sql?raw'
import deliveryFee from '../samples/delivery_fee.py?raw'
import ordersExport from '../samples/orders-export.jsonl?raw'
import shopConfig from '../samples/shop-config.yaml?raw'

/** Shown before each file name, so sample results are never mistaken for the user's own files. */
export const SAMPLE_FOLDER = 'sample'

export const SAMPLE_FILES: readonly { readonly path: string; readonly text: string }[] = [
  { path: `${SAMPLE_FOLDER}/orders-export.jsonl`, text: ordersExport },
  { path: `${SAMPLE_FOLDER}/app-server.log`, text: appServerLog },
  { path: `${SAMPLE_FOLDER}/shop-config.yaml`, text: shopConfig },
  { path: `${SAMPLE_FOLDER}/customers-dump.sql`, text: customersDump },
  { path: `${SAMPLE_FOLDER}/delivery_fee.py`, text: deliveryFee },
]

/** The sample files in the same shape as picked files, so they go through the normal intake. */
export function sampleSource(): { entries: IntakeFile[]; skipped: SkippedFile[] } {
  const encoder = new TextEncoder()
  const entries = SAMPLE_FILES.map(({ path, text }) => {
    const bytes = encoder.encode(text)
    return { path, size: bytes.byteLength, read: async () => bytes.slice().buffer }
  })
  return { entries, skipped: [] }
}
