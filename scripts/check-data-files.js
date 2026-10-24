// Fails when a .gan or .rentang file is tracked outside fixtures/.
// Real project files must never reach the repo (see CLAUDE.md, rule 1).
import { execFileSync } from 'node:child_process'

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const offending = tracked.filter(
  (path) => /\.(gan|rentang)$/i.test(path) && !path.startsWith('fixtures/'),
)

if (offending.length > 0) {
  console.error('Berkas proyek di luar fixtures/ tidak boleh masuk repo:')
  for (const path of offending) console.error(`  ${path}`)
  process.exit(1)
}

console.log('OK: tidak ada berkas .gan atau .rentang di luar fixtures/.')
