// Executa o Lighthouse CI (3 medições por página e perfil) e gera RESULTS.md com as medianas.
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const profiles = ['mobile', 'desktop']
for (const p of profiles) {
  rmSync(`lighthouse/reports/${p}`, { recursive: true, force: true })
  execSync(`npx lhci collect --config=lighthouse/lighthouserc.${p}.json && npx lhci upload --config=lighthouse/lighthouserc.${p}.json`, {
    stdio: 'inherit',
    env: { ...process.env },
  })
  rmSync('.lighthouseci', { recursive: true, force: true })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const lhciVersion = execSync('npx lhci --version').toString().trim()
let md = `# Resultados Lighthouse\n\nGerado em ${new Date().toISOString()} · LHCI ${lhciVersion} · Node ${process.version} · ${process.platform}\n\n`
md += 'Build otimizado (`vite build` + `vite preview`), cenário padrão dos mocks (MSW ativo), 3 medições por página/perfil — valores = mediana.\n\n'
md += '| Perfil | Página | Lighthouse | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |\n|---|---|---|---|---|---|---|---|---|---|\n'
for (const p of profiles) {
  const dir = `lighthouse/reports/${p}`
  if (!existsSync(dir)) continue
  const runs = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  const byPage = {}
  for (const f of runs) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    const page = new URL(r.finalDisplayedUrl ?? r.finalUrl).pathname
    ;(byPage[page] ??= []).push(r)
  }
  for (const [page, rs] of Object.entries(byPage)) {
    const cat = (k) => Math.round(median(rs.map((r) => r.categories[k].score * 100)))
    const aud = (k) => median(rs.map((r) => r.audits[k].numericValue))
    md += `| ${p} | \`${page}\` | ${rs[0].lighthouseVersion} | ${cat('performance')} | ${cat('accessibility')} | ${cat('best-practices')} | ${cat('seo')} | ${Math.round(aud('largest-contentful-paint'))} | ${aud('cumulative-layout-shift').toFixed(3)} | ${Math.round(aud('total-blocking-time'))} |\n`
  }
}
writeFileSync('lighthouse/RESULTS.md', md)
console.log(md)
