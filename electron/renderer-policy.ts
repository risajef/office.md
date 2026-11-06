type Frame = { url: string }
type Sender = { id: number; mainFrame: Frame }
const documentUrl = (input: string) => {
  try { const url = new URL(input); url.hash = ''; return url.href } catch { return undefined }
}

export const isTrustedRenderer = (
  event: { sender: Sender; senderFrame: Frame | null },
  expected: Sender | undefined,
  trustedUrl: string,
) => Boolean(expected && event.sender.id === expected.id && event.senderFrame === expected.mainFrame &&
  documentUrl(event.senderFrame.url) === documentUrl(trustedUrl) && documentUrl(trustedUrl))

export const externalWebUrl = (input: string): string | undefined => {
  try {
    const url = new URL(input)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}
