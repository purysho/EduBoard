import { describe, expect, it } from 'vitest'
import {
  describePortalFailure,
  portalFailure,
  portalFailureCode,
  portalFetch
} from '../portalErrors'

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
      /didn.t accept the sync secret/
    )
  })

  it('uses the Portal’s own JSON error message', () => {
    expect(
      describePortalFailure('Could not post', 400, '{"error":"classId and body required"}')
    ).toBe('Could not post (error 400) (classId and body required)')
  })

  it('carries the Portal’s own code and reference', () => {
    expect(
      describePortalFailure(
        'Could not post',
        500,
        '{"error":"Something went wrong on the server.","code":"PT-9900","ref":"A1B2C3"}'
      )
    ).toBe(
      'Could not post (error 500) (Something went wrong on the server. · PT-9900 · ref A1B2C3)'
    )
  })

  it('gives each kind of failure its EB code', async () => {
    expect([401, 403, 413, 502, 503, 504, 400, 500].map(portalFailureCode)).toEqual([
      'EB-1004',
      'EB-1004',
      'EB-1005',
      'EB-1006',
      'EB-1006',
      'EB-1006',
      'EB-1008',
      'EB-1008'
    ])
    const err = await portalFailure('Portal sync failed', new Response('{}', { status: 403 }))
    expect(err.code).toBe('EB-1004')
  })

  it('turns “can’t connect at all” into EB-1003', async () => {
    // Nothing listens on port 9 on this computer.
    await expect(portalFetch('http://127.0.0.1:9/api/sync')).rejects.toMatchObject({
      code: 'EB-1003',
      message: expect.stringMatching(/Couldn’t reach the Portal/)
    })
  })
})
