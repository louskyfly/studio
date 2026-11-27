declare module 'mammoth/mammoth.browser.js' {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>
  const mammoth: { extractRawText: typeof extractRawText }
  export default mammoth
}

declare module 'world-atlas/countries-110m.json' {
  const topology: unknown
  export default topology
}
