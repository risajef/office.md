import { describe, expect, it } from 'vitest'
import { isTrustedRenderer, externalWebUrl } from '../../electron/renderer-policy'

describe('Electron capability authorization', () => {
  it('accepts only the expected main frame document', () => {
    const frame = { url: 'file:///app/dist/index.html#share=copy' }
    const sender = { id: 1, mainFrame: frame }
    expect(isTrustedRenderer({ sender, senderFrame: frame }, sender, 'file:///app/dist/index.html')).toBe(true)
    expect(isTrustedRenderer({ sender, senderFrame: { url: frame.url } }, sender, 'file:///app/dist/index.html')).toBe(false)
    expect(isTrustedRenderer({ sender: { ...sender, id: 2 }, senderFrame: frame }, sender, 'file:///app/dist/index.html')).toBe(false)
    frame.url = 'https://attacker.test/'
    expect(isTrustedRenderer({ sender, senderFrame: frame }, sender, 'file:///app/dist/index.html')).toBe(false)
  })
  it('permits only HTTP(S) links in the system browser', () => {
    expect(externalWebUrl('https://example.test/doc')).toBe('https://example.test/doc')
    for (const value of ['file:///etc/passwd', 'javascript:alert(1)', 'mailto:test@example.test', 'app:launch', 'invalid']) {
      expect(externalWebUrl(value)).toBeUndefined()
    }
  })
})
