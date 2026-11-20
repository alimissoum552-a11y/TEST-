import { describe, it, expect } from 'vitest'
import { revokeConnector } from './passkeys.js'

// The connector is gated by the Collyo grant, so that one is revoked first; a failure of the
// OAuth revocation is reported, never hidden.
describe('revokeConnector', () => {
  it('revokes both grants and reports success', async () => {
    const calls = []
    const r = await revokeConnector('c1', {
      revokeGrant: async (id) => calls.push(['grant', id]),
      revokeOauth: async (id) => calls.push(['oauth', id]),
    })
    expect(r).toEqual({ grantRevoked: true, oauthRevoked: true })
    expect(calls).toEqual([['grant', 'c1'], ['oauth', 'c1']])
  })

  it('reports a partial failure when the OAuth revocation fails', async () => {
    const r = await revokeConnector('c1', {
      revokeGrant: async () => {},
      revokeOauth: async () => { throw new Error('oauth down') },
    })
    expect(r.grantRevoked).toBe(true)
    expect(r.oauthRevoked).toBe(false)
    expect(r.error.message).toBe('oauth down')
  })

  it('does not revoke OAuth when the Collyo grant could not be revoked', async () => {
    let oauthCalled = false
    await expect(revokeConnector('c1', {
      revokeGrant: async () => { throw new Error('grant down') },
      revokeOauth: async () => { oauthCalled = true },
    })).rejects.toThrow('grant down')
    expect(oauthCalled).toBe(false)
  })
})
