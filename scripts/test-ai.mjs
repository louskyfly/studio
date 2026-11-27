import { chromium } from 'playwright'
import fs from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const out = 'shots'
const errors = []
const results = {}

/* fixture PDF pour tester l'extraction de documents */
const fixture = await PDFDocument.create()
const font = await fixture.embedFont(StandardFonts.Helvetica)
const p1 = fixture.addPage([595, 842])
p1.drawText('La romanisation de l’Empire romain', { x: 60, y: 760, size: 18, font })
p1.drawText('Rome accorde la citoyennete aux elites des cites conquises.', { x: 60, y: 720, size: 11, font })
p1.drawText('En 212, l’edit de Caracalla generalise la citoyennete romaine.', { x: 60, y: 700, size: 11, font })
p1.drawText('Les provinces sont administrees par des gouverneurs.', { x: 60, y: 680, size: 11, font })
fs.writeFileSync(`${out}/fixture.pdf`, await fixture.save())

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE: ${m.text()}`))

const configure = async () => {
  await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /Compatible OpenAI/ }).click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('https://…/v1').fill('http://127.0.0.1:8787/v1')
  await page.getByPlaceholder('sk-…').fill('mock-key')
  const model = page.locator('input[list="studio-models"]')
  await model.fill('mock-studio')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Tester la connexion/ }).click()
  await page.getByText(/Connexion réussie/).waitFor({ timeout: 30000 })
  results.connection = true
}

try {
  await configure()

  // --- génération depuis un sujet ---
  await page.goto('http://127.0.0.1:5173/#/new/topic', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('textarea').first().fill('La romanisation de l’Empire romain, pour une classe de Seconde.')
  await page.getByRole('button', { name: /Générer la présentation/ }).click()
  await page.waitForURL(/\/#\/edit\//, { timeout: 180000 })
  await page.waitForTimeout(2500)
  results.slideCount = await page.locator('[draggable="true"]').count()
  await page.screenshot({ path: `${out}/40-generated.png` })

  results.doc = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('studio')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const docs = await new Promise((res, rej) => {
      const tx = db.transaction('presentations', 'readonly')
      const r = tx.objectStore('presentations').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const latest = docs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
    const types = new Set()
    for (const s of latest.slides) for (const e of s.elements) types.add(e.type)
    return {
      title: latest.title,
      slides: latest.slides.length,
      types: [...types],
      layouts: latest.slides.map((s) => s.layout),
      hasMap: types.has('map'),
      hasTimeline: types.has('timeline'),
      hasChart: types.has('chart'),
      hasTable: types.has('table'),
    }
  })

  // --- assistant sur la diapositive 4 ---
  await page.locator('[draggable="true"]').nth(3).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Assistant/ }).first().click()
  await page.waitForTimeout(400)
  const ta = page.locator('textarea').last()
  await ta.fill('Raccourcis cette diapositive.')
  await page.keyboard.press('Enter')
  await page.getByText(/Modification appliquée|Diapositive raccourcie/).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  results.assistant = true
  results.assistantScope = (await page.getByRole('button', { name: /Diapositive 4/ }).count()) > 0
  await page.screenshot({ path: `${out}/41-assistant.png` })

  // --- export ---
  await page.locator('header').getByRole('button', { name: /Exporter/ }).first().click()
  await page.waitForTimeout(400)
  const dialog = page.locator('[role="dialog"]').last()
  await dialog.getByRole('button', { name: 'Exporter', exact: true }).click()
  await page.getByText('Fichier prêt et vérifié').waitFor({ timeout: 120000 })
  const dl = page.waitForEvent('download')
  await dialog.getByRole('button', { name: /Télécharger/ }).click()
  const d = await dl
  await d.saveAs(`${out}/generated.pptx`)
  results.export = true
  await page.screenshot({ path: `${out}/42-export.png` })
  await dialog.getByRole('button', { name: 'Fermer' }).last().click()

  // --- documents : extraction PDF ---
  await page.goto('http://127.0.0.1:5173/#/new/documents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.locator('input[type="file"]').first().setInputFiles(`${out}/fixture.pdf`)
  await page.waitForTimeout(2500)
  results.pdfExtraction = (await page.getByText('fixture.pdf').count()) > 0
  results.pdfChars = await page.getByText(/car\./).count()
  await page.screenshot({ path: `${out}/43-documents.png` })
} catch (err) {
  errors.push(`TEST: ${err.message}`)
  await page.screenshot({ path: `${out}/99-ai-failure.png` }).catch(() => {})
} finally {
  fs.writeFileSync(`${out}/ai-test.json`, JSON.stringify({ errors, results }, null, 2))
  console.log(JSON.stringify({ errors, results }, null, 2))
  await browser.close()
}
