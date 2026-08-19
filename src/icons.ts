export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'bold'
  | 'check'
  | 'chevron-right'
  | 'close'
  | 'code'
  | 'code-block'
  | 'column-after'
  | 'column-before'
  | 'column-delete'
  | 'comment'
  | 'copy'
  | 'diagram'
  | 'download'
  | 'edit'
  | 'exit-fullscreen'
  | 'file-text'
  | 'folder'
  | 'formula'
  | 'fullscreen'
  | 'heading-1'
  | 'heading-2'
  | 'include'
  | 'info'
  | 'italic'
  | 'link'
  | 'list-bulleted'
  | 'list-check'
  | 'list-numbered'
  | 'more'
  | 'paste'
  | 'plus'
  | 'quote'
  | 'redo'
  | 'refresh'
  | 'row-after'
  | 'row-before'
  | 'row-delete'
  | 'save'
  | 'sheet'
  | 'sliders'
  | 'sort-ascending'
  | 'sort-descending'
  | 'strikethrough'
  | 'table'
  | 'undo'
  | 'up'

const paths: Record<IconName, string> = {
  'arrow-left': '<path d="M19 12H5m6-6-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  bold: '<path d="M8 5h5a3.5 3.5 0 0 1 0 7H8zm0 7h6a3.5 3.5 0 0 1 0 7H8z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/>',
  'code-block': '<rect x="3" y="5" width="18" height="14"/><path d="m8 9-3 3 3 3m4 0h5"/>',
  'column-after': '<rect x="4" y="4" width="10" height="16"/><path d="M9 4v16m10-5v6m-3-3h6"/>',
  'column-before': '<rect x="10" y="4" width="10" height="16"/><path d="M15 4v16M5 3v6M2 6h6"/>',
  'column-delete': '<rect x="4" y="4" width="10" height="16"/><path d="M9 4v16m8-5 5 5m0-5-5 5"/>',
  comment: '<path d="M5 5h14v11H9l-4 3z"/><path d="M9 9h6m-6 3h4"/>',
  copy: '<rect x="8" y="8" width="11" height="11"/><path d="M16 8V5H5v11h3"/>',
  diagram: '<rect x="3" y="4" width="6" height="5"/><rect x="15" y="15" width="6" height="5"/><path d="M9 6.5h5a4 4 0 0 1 4 4V15"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
  edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/>',
  'exit-fullscreen': '<path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5"/>',
  'file-text': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  formula: '<path d="M17 5H8l5 7-5 7h9"/>',
  fullscreen: '<path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"/>',
  'heading-1': '<path d="M4 5v14M12 5v14M4 12h8m5-3 2-1v11m-2 0h4"/>',
  'heading-2': '<path d="M3 5v14M11 5v14M3 12h8m5-2a2.5 2.5 0 1 1 5 0c0 3-5 4-5 9h5"/>',
  include: '<path d="M8 12h8m-4-4v8"/><path d="M7 5H4v14h3m10-14h3v14h-3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  italic: '<path d="M10 5h7M7 19h7m1-14L9 19"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
  'list-bulleted': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  'list-check': '<rect x="3" y="4" width="5" height="5"/><path d="m4.5 6.5 1.2 1.2L8.5 4.8M11 6.5h10"/><rect x="3" y="15" width="5" height="5"/><path d="M11 17.5h10"/>',
  'list-numbered': '<path d="M10 6h10m-10 6h10m-10 6h10M4 5h2v3M4 12h2l-2 3h2m-2 3h2v3H4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  paste: '<path d="M9 5h6v3H9z"/><path d="M7 7H5v14h14V7h-2"/><path d="M9 13h6m-3-3v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  quote: '<path d="M5 10h5v5H5zM14 10h5v5h-5zM5 10c0-3 2-5 5-5m4 5c0-3 2-5 5-5"/>',
  redo: '<path d="m16 7 4 4-4 4"/><path d="M20 11h-9a7 7 0 0 0-7 7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 12M4 12l2.4 6a7 7 0 0 0 11.5-2"/>',
  'row-after': '<rect x="4" y="4" width="16" height="10"/><path d="M4 9h16m-5 10h6m-3-3v6"/>',
  'row-before': '<rect x="4" y="10" width="16" height="10"/><path d="M4 15h16M3 5h6M6 2v6"/>',
  'row-delete': '<rect x="4" y="4" width="16" height="10"/><path d="M4 9h16m-5 8 5 5m0-5-5 5"/>',
  save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
  sheet: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  sliders: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  'sort-ascending': '<path d="M8 18V5m-4 4 4-4 4 4M15 8h5m-5 4h4m-4 4h3"/>',
  'sort-descending': '<path d="M8 5v13m-4-4 4 4 4-4M15 8h3m-3 4h4m-4 4h5"/>',
  strikethrough: '<path d="M17 7a5 5 0 0 0-9-1c-1 2 0 4 2 5m2 2c3 1 5 2 4 5-1 2-6 2-9-1M4 12h16"/>',
  table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M9 4v16m6-16v16"/>',
  undo: '<path d="m8 7-4 4 4 4"/><path d="M4 11h9a7 7 0 0 1 7 7"/>',
  up: '<path d="m6 10 6-6 6 6M12 4v16"/>',
}

export const createIcon = (name: IconName) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('ui-icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = paths[name]
  return svg
}

export const setIcon = (element: HTMLElement, name: IconName) => {
  element.replaceChildren(createIcon(name))
  element.dataset.icon = name
}

export const hydrateIcons = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((element) => {
    const name = element.dataset.icon as IconName | undefined
    if (name && name in paths) setIcon(element, name)
  })
}
