import { describe, expect, it } from 'vitest'
import { describePortalFailure } from '../portalErrors'

// The page a real Portal server returned for an oversized publish.
const EXPRESS_413 = `<!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>PayloadTooLargeError: request entity too large<br> &nbsp; &nbsp;at readStream (/opt/eduboard/portal/node_modules/raw-body/index.js:163:17)<br> &nbsp; &nbsp;at getRawBody</pre> </body> </html>`

describe('describePortalFailure', () => {
  it('turns an HTML error page into one readable line', () => {
    const message = describePortalFailure('Portal sync failed', 413, EXPRESS_413)
    expect(message).toMatch(/too large\. Update the Portal server/)
    expect(message).toContain('(PayloadTooLargeError: request entity too large)')
    expect(message).not.toMatch(/<|node_modules/)
  })

  it('explains a rejected sync secret', () => {
    expect(describePortalFailure('Portal sync failed', 401, '{"error":"Bad sync secret"}')).toMatch(
      /didn't accept the sync secret/
    )
  })

  it('uses the Portal’s own JSON error message', () => {
    expect(
      describePortalFailure('Could not post', 400, '{"error":"classId and body required"}')
    ).toBe('Could not post (error 400) (classId and body required)')
  })
})
