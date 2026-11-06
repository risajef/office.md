import { describe, expect, it } from 'vitest'
import { createHtmlPreviewFragment, materializeHtmlContent } from '../../src/plugins/html-content-plugin'

describe('embedded document HTML', () => {
  it('removes browser-recognized JavaScript URLs, including inside includes', () => {
    const source = '<a href="&#1;javascript:window.probe=1">Probe</a>'
    expect(createHtmlPreviewFragment(source).querySelector('a')?.hasAttribute('href')).toBe(false)
    const root = document.createElement('div')
    const include = document.createElement('span')
    include.dataset.type = 'html'
    include.dataset.value = source
    root.append(include)
    materializeHtmlContent(root)
    expect(root.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(root.textContent).toBe('Probe')
  })

  it('preserves document markup while removing active content and comments', () => {
    const fragment = createHtmlPreviewFragment('<section onclick="probe()"><h2>Notes</h2><a href="https://example.test/">Link</a><table><tr><td>Cell</td></tr></table><svg onload="probe()"><circle r="2" /></svg><script>probe()</script><iframe src="https://example.test/"></iframe><!-- hidden --></section>')
    expect(fragment.querySelector('h2')?.textContent).toBe('Notes')
    expect(fragment.querySelector('td')?.textContent).toBe('Cell')
    expect(fragment.querySelector('a')?.getAttribute('href')).toBe('https://example.test/')
    expect(fragment.querySelector('circle')).not.toBeNull()
    expect(fragment.querySelector('[onclick], [onload], script, iframe')).toBeNull()
    const root = document.createElement('div')
    root.append(fragment)
    expect(root.innerHTML).not.toContain('<!--')
  })
})
