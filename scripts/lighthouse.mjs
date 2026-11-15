import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173'
const outputDir = 'lighthouse/reports'
const pages = [
  { name: 'catalog', path: '/' },
  { name: 'nft-detail', path: '/nfts/nft_2' },
]
const profiles = [
  { name: 'mobile', flags: ['--preset=perf', '--form-factor=mobile', '--screenEmulation.mobile=true', '--screenEmulation.width=390', '--screenEmulation.height=844', '--screenEmulation.deviceScaleFactor=1'] },
  { name: 'desktop', flags: ['--preset=desktop', '--form-factor=desktop'] },
]
const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const runs = []

await mkdir(outputDir, { recursive: true })
for (const page of pages) {
  for (const profile of profiles) {
    for (let iteration = 1; iteration <= 3; iteration += 1) {
      const stem = `${page.name}-${profile.name}-${iteration}`
      const json = join(outputDir, `${stem}.json`)
      const args = [
        '--yes', 'lighthouse', `${baseUrl}${page.path}`,
        '--output=html', '--output=json', `--output-path=${join(outputDir, `${stem}.html`)}`,
        '--chrome-flags=--headless --no-sandbox', '--quiet', ...profile.flags,
      ]
      const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
      if (result.status !== 0) throw new Error(`Lighthouse falhou em ${stem}. Verifique Chrome e conexão.`)
      const report = JSON.parse(await readFile(json, 'utf8'))
      const scores = Object.fromEntries(categories.map((category) => [category, Math.round((report.categories[category]?.score ?? 0) * 100)]))
      runs.push({ page: page.name, profile: profile.name, iteration, scores, metrics: {
        lcp: report.audits['largest-contentful-paint']?.numericValue ?? null,
        cls: report.audits['cumulative-layout-shift']?.numericValue ?? null,
        tbt: report.audits['total-blocking-time']?.numericValue ?? null,
      } })
      console.log(`${stem}:`, scores)
    }
  }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summary = []
for (const page of pages) for (const profile of profiles) {
  const subset = runs.filter((run) => run.page === page.name && run.profile === profile.name)
  summary.push({ page: page.name, profile: profile.name, scores: Object.fromEntries(categories.map((c) => [c, median(subset.map((r) => r.scores[c]))])) })
}
await writeFile(join(outputDir, 'summary.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), runs, medians: summary }, null, 2))
console.table(summary.map((row) => ({ page: row.page, profile: row.profile, ...row.scores })))
