import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { launch } from 'chrome-launcher'
import lighthouse, { desktopConfig } from 'lighthouse'
import { lighthouseConfig as config } from './config.mjs'

const isWindows = process.platform === 'win32'
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? `http://127.0.0.1:${config.port}`
const useExistingServer = Boolean(process.env.LIGHTHOUSE_BASE_URL)

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: isWindows })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} falhou (${code})`))))
  })
}

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

async function startPreview() {
  if (!existsSync('dist/index.html')) await run('npm', ['run', 'build'])
  const child = spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(config.port), '--strictPort'],
    { stdio: 'ignore', shell: isWindows, detached: !isWindows },
  )
  await waitForServer(baseUrl)
  return child
}

function stopPreview(child) {
  if (!child) return
  if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid)
}

async function measure(url, profile) {
  const chrome = await launch({
    chromeFlags: ['--headless=new', ...(process.env.CI ? ['--no-sandbox'] : [])],
  })
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: config.categories },
      profile === 'desktop' ? desktopConfig : undefined,
    )
    const [json, html] = result.report
    return { lhr: result.lhr, json, html }
  } finally {
    await chrome.kill()
  }
}

await mkdir(config.outputDir, { recursive: true })
const server = useExistingServer ? null : await startPreview()
const runs = []
let environment = null

try {
  for (const page of config.pages) {
    for (const profile of config.profiles) {
      for (let iteration = 1; iteration <= config.runsPerTarget; iteration += 1) {
        const stem = `${page.name}-${profile}-${iteration}`
        const { lhr, json, html } = await measure(`${baseUrl}${page.path}`, profile)
        await writeFile(join(config.outputDir, `${stem}.json`), json)
        await writeFile(join(config.outputDir, `${stem}.html`), html)

        environment ??= {
          lighthouse: lhr.lighthouseVersion,
          userAgent: lhr.environment.hostUserAgent,
          throttlingMethod: lhr.configSettings.throttlingMethod,
        }
        const scores = Object.fromEntries(
          config.categories.map((category) => [category, Math.round((lhr.categories[category]?.score ?? 0) * 100)]),
        )
        const metrics = {
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
        }
        runs.push({ page: page.name, profile, iteration, scores, metrics })
        console.log(stem, scores)
      }
    }
  }
} finally {
  stopPreview(server)
}

const medians = []
for (const page of config.pages) {
  for (const profile of config.profiles) {
    const subset = runs.filter((entry) => entry.page === page.name && entry.profile === profile)
    const scores = Object.fromEntries(config.categories.map((c) => [c, median(subset.map((r) => r.scores[c]))]))
    const metrics = {
      lcp: median(subset.map((r) => r.metrics.lcp)),
      cls: median(subset.map((r) => r.metrics.cls)),
      tbt: median(subset.map((r) => r.metrics.tbt)),
    }
    const meetsTargets = config.categories.every((c) => scores[c] >= config.thresholds[c])
    medians.push({ page: page.name, profile, scores, metrics, meetsTargets })
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  runsPerTarget: config.runsPerTarget,
  thresholds: config.thresholds,
  tools: { ...environment, node: process.version },
  host: { platform: process.platform, release: os.release(), cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model },
  runs,
  medians,
}
await writeFile(join(config.outputDir, 'summary.json'), JSON.stringify(summary, null, 2))

const rows = medians.map(
  (m) =>
    `| ${m.page} | ${m.profile} | ${m.scores.performance} | ${m.scores.accessibility} | ${m.scores['best-practices']} | ${m.scores.seo} | ${Math.round(m.metrics.lcp)} | ${m.metrics.cls.toFixed(3)} | ${Math.round(m.metrics.tbt)} | ${m.meetsTargets ? 'sim' : 'não'} |`,
)
const markdown = [
  '# Resultados Lighthouse (mediana de 3 medições)',
  '',
  `Gerado em ${summary.generatedAt} · Lighthouse ${environment.lighthouse} · Node ${process.version} · ${os.type()} ${os.release()}`,
  `User agent: ${environment.userAgent}`,
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) | Atinge metas |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  `Metas: ${Object.entries(config.thresholds).map(([k, v]) => `${k} ≥ ${v}`).join(' · ')}`,
].join('\n')
await writeFile(join(config.outputDir, 'summary.md'), markdown)
console.log(`\n${markdown}`)
