import { chromium } from 'playwright'
import JSZip from 'jszip'
import fs from 'node:fs'

const docx = new JSZip()
docx.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
)
docx.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
)
docx.file(
  'word/document.xml',
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>La romanisation de l'Empire romain</w:t></w:r></w:p><w:p><w:r><w:t>Rome accorde la citoyennete aux elites des cites conquises.</w:t></w:r></w:p><w:p><w:r><w:t>En 212, l'edit de Caracalla generalise la citoyennete.</w:t></w:r></w:p></w:body></w:document>`,
)
fs.writeFileSync('shots/fixture.docx', await docx.generateAsync({ type: 'nodebuffer' }))

const pptx = new JSZip()
pptx.file(
  'ppt/slides/slide1.xml',
  `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Les provinces romaines</a:t></a:r></a:p><a:p><a:r><a:t>Un gouverneur administre chaque province.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
)
fs.writeFileSync('shots/fixture.pptx', await pptx.generateAsync({ type: 'nodebuffer' }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto('http://127.0.0.1:5173/#/new/documents', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const input = page.locator('input[type="file"]').first()
await input.setInputFiles('shots/fixture.docx')
await page.waitForTimeout(2500)
const docxOk = (await page.getByText('fixture.docx').count()) > 0
await input.setInputFiles('shots/fixture.pptx')
await page.waitForTimeout(2500)
const pptxOk = (await page.getByText('fixture.pptx').count()) > 0
const charTexts = await page.getByText(/car\./).allTextContents()
await page.screenshot({ path: 'shots/70-docs.png', fullPage: true })
console.log(JSON.stringify({ errors, docxOk, pptxOk, charTexts }))
await browser.close()
