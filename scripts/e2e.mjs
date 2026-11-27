import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const out = 'shots'
fs.mkdirSync(out, { recursive: true })
const errors = []
const log = []

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
})

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/01-home.png`, fullPage: true })
log.push('home')

await page.locator('article button.card').first().click()
await page.waitForTimeout(1800)
await page.screenshot({ path: `${out}/02-editor.png` })
log.push('editor')

const thumbs = page.locator('[draggable="true"]')
log.push(`slides:${await thumbs.count()}`)
await thumbs.nth(4).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/03-map.png` })

// sélection d'un élément et poignées
const mapEl = page.locator('[data-element-id]').filter({ has: page.locator('svg') }).last()
if (await mapEl.count()) {
  const box = await mapEl.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}/04-selected.png` })
    log.push('select-ok')
  }
}

// Design
await page.getByRole('button', { name: /Design/ }).first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/05-design.png` })

// Assistant
await page.getByRole('button', { name: /Assistant/ }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/06-assistant.png` })

// Ajout d'un texte
await page.getByRole('button', { name: 'Texte', exact: true }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/07-text-added.png` })
log.push('text-added')

// export PPTX
await page.locator('header').getByRole('button', { name: /Exporter/ }).first().click()
await page.waitForTimeout(400)
const dialog = page.locator('[role="dialog"]')
await dialog.getByRole('button', { name: 'Exporter', exact: true }).click()
await page.getByText('Fichier prêt et vérifié').waitFor({ timeout: 90000 })
await page.screenshot({ path: `${out}/08-export.png` })
const dl1 = page.waitForEvent('download')
await dialog.getByRole('button', { name: /Télécharger/ }).click()
const d1 = await dl1
await d1.saveAs(path.join(out, 'export.pptx'))
log.push('pptx:' + (await d1.path()))

// export PDF
await page.getByText('Fichier prêt et vérifié').waitFor()
await dialog.getByRole('button', { name: /PDF/ }).first().click()
await dialog.getByRole('button', { name: 'Exporter', exact: true }).click()
await page.getByText('Fichier prêt et vérifié').waitFor({ timeout: 90000 })
const dl2 = page.waitForEvent('download')
await dialog.getByRole('button', { name: /Télécharger/ }).click()
const d2 = await dl2
await d2.saveAs(path.join(out, 'export.pdf'))
log.push('pdf')

// fermer la modale
await dialog.getByRole('button', { name: 'Fermer' }).last().click()
await page.waitForTimeout(300)

// mobile / iPad
const ipad = await context.newPage()
await ipad.setViewportSize({ width: 1024, height: 768 })
await ipad.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await ipad.waitForTimeout(1200)
await ipad.screenshot({ path: `${out}/09-ipad-home.png` })
await ipad.locator('article button.card').first().click()
await ipad.waitForTimeout(1500)
await ipad.screenshot({ path: `${out}/10-ipad-editor.png` })
log.push('ipad')

const phone = await context.newPage()
await phone.setViewportSize({ width: 390, height: 844 })
await phone.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await phone.waitForTimeout(1000)
await phone.screenshot({ path: `${out}/11-phone.png`, fullPage: true })
log.push('phone')

fs.writeFileSync(`${out}/e2e.json`, JSON.stringify({ errors, log }, null, 2))
console.log(JSON.stringify({ errors, log }, null, 2))
await browser.close()
