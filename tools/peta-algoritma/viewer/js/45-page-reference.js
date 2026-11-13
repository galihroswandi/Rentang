// Reference pages: class and state diagrams, glossary, file index, and how to read UML.

import { codeLink, DATA, h, href, icon, LANG, moduleById, moduleChip, T } from './00-core.js'
import { diagramFrame } from './10-uml-common.js'
import { activityDiagram } from './20-uml-activity.js'
import { sequenceDiagram } from './21-uml-sequence.js'
import { graphDiagram } from './22-uml-graph.js'
import { normalise, slug } from './30-shell.js'
import { footer, percent, statChip } from './40-page-home.js'
import { diagramBlock } from './42-page-module.js'

export function pageDiagrams(route) {
  const used = (diagram) =>
    DATA.modules.filter((module) => (module.diagrams ?? []).includes(diagram.id))
  return h(
    'div',
    { class: 'page page-wide' },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'UML · class · state'),
      h('h1', {}, T('diagrams')),
      h('p', { class: 'lead' }, T('diagramsLead')),
    ),
    DATA.diagrams.map((diagram) =>
      h(
        'section',
        { class: ['card', route.id === diagram.id && 'is-target'], id: `diagram-${diagram.id}` },
        diagramBlock(diagram),
        used(diagram).length
          ? h(
              'div',
              { class: 'chips' },
              h('span', { class: 'muted small' }, `${T('usedIn')}:`),
              used(diagram).map((module) => moduleChip(module.id)),
            )
          : null,
      ),
    ),
    footer(),
  )
}

export function pageGlossary() {
  const terms = [...DATA.glossary].sort((a, b) => a.term.localeCompare(b.term, LANG))
  return h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'page-head' },
      h('h1', {}, T('glossary')),
      h('p', { class: 'lead' }, T('glossaryLead')),
    ),
    h(
      'dl',
      { class: 'glossary' },
      terms.map((term) => [
        h('dt', { id: `term-${slug(term.term)}` }, term.term),
        h(
          'dd',
          {},
          h('p', {}, term.definition),
          term.modules?.length
            ? h(
                'div',
                { class: 'chips' },
                h('span', { class: 'muted small' }, `${T('seeModules')}:`),
                term.modules.map((id) => moduleChip(id)),
              )
            : null,
        ),
      ]),
    ),
    footer(),
  )
}

export function pageFiles() {
  const input = h('input', {
    type: 'search',
    class: 'filter-input',
    placeholder: T('filterFiles'),
    'aria-label': T('filterFiles'),
  })
  const body = h('tbody')
  const stats = DATA.stats
  const paint = () => {
    const words = normalise(input.value).split(/\s+/).filter(Boolean)
    body.replaceChildren(
      ...DATA.files
        .filter((file) =>
          words.every((word) =>
            normalise(
              `${file.path} ${file.modules.map((id) => moduleById.get(id)?.name).join(' ')}`,
            ).includes(word),
          ),
        )
        .map((file) =>
          h(
            'tr',
            {},
            h('td', {}, codeLink(file.path, 1, file.path)),
            h('td', { class: 'muted small nowrap' }, String(file.lines)),
            h(
              'td',
              {},
              file.modules.length
                ? file.modules.map((id) => moduleChip(id))
                : h('span', { class: 'tag' }, `${T('ignored')}: ${file.ignored}`),
            ),
          ),
        ),
    )
  }
  input.addEventListener('input', paint)
  paint()
  return h(
    'div',
    { class: 'page page-wide' },
    h(
      'header',
      { class: 'page-head' },
      h('h1', {}, T('files')),
      h('p', { class: 'lead' }, T('filesLead')),
      h(
        'div',
        { class: 'stat-row' },
        statChip(stats.files, T('files')),
        statChip(stats.filesMapped, T('modules')),
        statChip(stats.filesIgnored, T('ignored')),
        statChip(
          `${percent(stats.filesMapped + stats.filesIgnored, stats.files)}%`,
          T('coverage'),
          'is-good',
        ),
      ),
    ),
    h('div', { class: 'filter-bar' }, input),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'file-table' },
        h(
          'thead',
          {},
          h('tr', {}, h('th', {}, T('file')), h('th', {}, '#'), h('th', {}, T('module'))),
        ),
        body,
      ),
    ),
    footer(),
  )
}

/** How to read the notation, with small diagrams drawn by the same renderers. */
export function pageLegend() {
  const sampleActivity = activityDiagram(
    [
      'Aksi (langkah)',
      {
        if: 'Kondisi terpenuhi?',
        then: [{ stop: 'Berhenti lebih awal' }],
        yes: LANG === 'id' ? 'ya' : 'yes',
        no: LANG === 'id' ? 'tidak' : 'no',
      },
      {
        loop: LANG === 'id' ? 'Masih ada item?' : 'More items?',
        body: [LANG === 'id' ? 'Proses satu item' : 'Process one item'],
      },
    ],
    'activity',
  )
  const sampleSequence = sequenceDiagram({
    name: 'contoh',
    actors: [
      { id: 'user', name: LANG === 'id' ? 'Pengguna' : 'User', type: 'actor' },
      { id: 'a', name: 'Modul A', type: 'system' },
      { id: 'b', name: 'Modul B', type: 'system' },
      { id: 'db', name: 'Basis data', type: 'database' },
    ],
    participants: ['user', 'a', 'b', 'db'],
    messages: [
      { from: 'user', to: 'a', text: 'klik' },
      { from: 'a', to: 'b', text: 'hitung(x)' },
      { from: 'b', to: 'b', text: 'langkah internal' },
      { from: 'b', to: 'a', text: 'hasil', kind: 'return' },
      {
        fragment: 'alt',
        label: 'valid',
        messages: [{ from: 'a', to: 'db', text: 'simpan()', kind: 'async' }],
        else: [
          {
            label: LANG === 'id' ? 'tidak valid' : 'invalid',
            messages: [{ from: 'a', to: 'user', text: 'tampilkan pesan' }],
          },
        ],
      },
    ],
  }).svg
  const sampleClass = graphDiagram({
    type: 'class',
    name: 'contoh',
    nodes: [
      { id: 'p', name: 'Proyek', col: 1, row: 1, attributes: ['nama: string'] },
      { id: 't', name: 'Tugas', col: 2, row: 1, attributes: ['mulai: Tanggal', 'durasi: number'] },
      {
        id: 'j',
        name: 'Jadwal',
        col: 2,
        row: 2,
        stereotype: 'dihitung',
        attributes: ['selesai: Tanggal'],
      },
    ],
    edges: [
      { from: 'p', to: 't', kind: 'composition', fromLabel: '1', toLabel: '0..*', label: 'tasks' },
      { from: 'j', to: 't', kind: 'dependency', label: '«use»' },
    ],
  })
  const sampleState = graphDiagram({
    type: 'state',
    name: 'contoh',
    nodes: [
      { id: 's', kind: 'initial', col: 1, row: 1 },
      { id: 'a', name: 'Diam', col: 2, row: 1 },
      { id: 'b', name: 'Bekerja', col: 3, row: 1, text: ['do / proses'] },
      { id: 'f', kind: 'final', col: 4, row: 1 },
    ],
    edges: [
      { from: 's', to: 'a' },
      { from: 'a', to: 'b', label: 'mulai [siap]' },
      { from: 'b', to: 'a', label: 'gagal / catat' },
      { from: 'b', to: 'f', label: 'selesai' },
    ],
  })
  const id = LANG === 'id'
  const section = (title, svgElement, kind, items) =>
    h(
      'section',
      { class: 'card legend-card' },
      h('h2', {}, title),
      h(
        'div',
        { class: 'legend-layout' },
        diagramFrame(svgElement, { kind, legend: false }),
        h(
          'ul',
          { class: 'bullets' },
          items.map(([term, text]) => h('li', {}, h('strong', {}, term), ' — ', text)),
        ),
      ),
    )
  return h(
    'div',
    { class: 'page page-wide' },
    h(
      'header',
      { class: 'page-head' },
      h('h1', {}, T('legendTitle')),
      h('p', { class: 'lead' }, T('legendLead')),
    ),
    section(
      T('kindActivity')[0],
      sampleActivity,
      'UML · activity',
      id
        ? [
            ['● Titik awal', 'algoritma mulai di sini.'],
            ['Kotak membulat', 'satu aksi; teks mono di bawahnya adalah kode yang bisa diklik.'],
            [
              '◇ Keputusan',
              'pertanyaan di sampingnya; label [ya]/[tidak] di garis adalah penjaga (guard).',
            ],
            ['Panah balik ke ◇', 'perulangan: [berikutnya] masuk ke isi, [selesai] keluar.'],
            ['◉ Titik akhir', 'algoritma selesai (termasuk berhenti lebih awal).'],
          ]
        : [
            ['● Initial node', 'the algorithm starts here.'],
            ['Rounded box', 'one action; the mono text below it is clickable code.'],
            ['◇ Decision', 'the question sits beside it; [yes]/[no] on the lines are guards.'],
            ['Arrow back to ◇', 'a loop: [next] enters the body, [done] leaves.'],
            ['◉ Final node', 'the algorithm ends (also when it stops early).'],
          ],
    ),
    section(
      T('kindSequence')[0],
      sampleSequence,
      'UML · sequence',
      id
        ? [
            [
              'Kotak di atas',
              'peserta (lifeline): modul, aktor, atau basis data. Garis putus-putus ke bawah = waktu berjalan.',
            ],
            ['Panah penuh, ujung tertutup', 'panggilan sinkron: pengirim menunggu.'],
            ['Panah ujung terbuka', 'pesan asinkron: pengirim tidak menunggu.'],
            ['Panah putus-putus', 'balasan (return).'],
            ['Batang tipis di lifeline', 'activation: peserta sedang bekerja.'],
            [
              'Bingkai alt / opt / loop',
              'cabang, langkah opsional, atau perulangan; [penjaga] di pojok kiri atas.',
            ],
          ]
        : [
            [
              'Boxes on top',
              'participants (lifelines): modules, actors or databases. The dashed line down is time.',
            ],
            ['Solid arrow, closed head', 'synchronous call: the sender waits.'],
            ['Open arrowhead', 'asynchronous message: the sender does not wait.'],
            ['Dashed arrow', 'reply (return).'],
            ['Thin bar on a lifeline', 'activation: the participant is working.'],
            [
              'alt / opt / loop frame',
              'branches, optional steps or a loop; [guard] at the top left.',
            ],
          ],
    ),
    section(
      T('kindClass')[0],
      sampleClass,
      'UML · class',
      id
        ? [
            ['Kotak tiga bagian', 'nama kelas, atribut (nama: tipe), operasi.'],
            ['«dihitung»', 'stereotip: data ini tidak disimpan, selalu dihitung.'],
            [
              '◆ Berlian penuh',
              'komposisi: bagian (Tugas) hidup dan mati bersama keseluruhan (Proyek).',
            ],
            ['1, 0..*', 'multiplisitas: satu proyek punya nol sampai banyak tugas.'],
            ['Panah putus-putus', 'dependensi: memakai tanpa memiliki.'],
          ]
        : [
            ['Three-part box', 'class name, attributes (name: type), operations.'],
            ['«computed»', 'stereotype: never stored, always computed.'],
            ['◆ Filled diamond', 'composition: the part lives and dies with the whole.'],
            ['1, 0..*', 'multiplicity: one project has zero or more tasks.'],
            ['Dashed arrow', 'dependency: uses without owning.'],
          ],
    ),
    section(
      T('kindState')[0],
      sampleState,
      'UML · state',
      id
        ? [
            ['● → status', 'status awal.'],
            ['Kotak membulat', 'status; "do / ..." adalah aktivitas selama di status itu.'],
            ['Panah berlabel', 'transisi: peristiwa [penjaga] / aksi.'],
            ['◉', 'status akhir.'],
          ]
        : [
            ['● → state', 'initial state.'],
            ['Rounded box', 'a state; "do / ..." is what happens while in it.'],
            ['Labelled arrow', 'transition: event [guard] / action.'],
            ['◉', 'final state.'],
          ],
    ),
    h(
      'section',
      { class: 'card legend-card' },
      h('h2', {}, `${T('kindComponent')[0]} & ${T('kindUseCase')[0].toLowerCase()}`),
      h(
        'ul',
        { class: 'bullets' },
        (id
          ? [
              [
                'Paket bertab «layer»',
                'satu lapisan arsitektur; paket kecil di dalamnya adalah grup.',
              ],
              [
                'Kotak dengan ikon ⧉',
                'komponen (modul). Panah putus-putus «use» = memakai, dihitung dari impor kode.',
              ],
              ['Aktor (orang lidi)', 'pengguna di luar sistem.'],
              [
                'Elips di dalam kotak sistem',
                'use case: satu hal yang bisa dilakukan pengguna. Klik untuk diagram urutannya.',
              ],
            ]
          : [
              [
                'Tabbed «layer» package',
                'one architecture layer; smaller packages inside are groups.',
              ],
              [
                'Box with ⧉ icon',
                'a component (module). Dashed «use» arrows = uses, derived from imports.',
              ],
              ['Stick figure', 'the user, outside the system.'],
              [
                'Ellipse inside the system box',
                'a use case: one thing the user can do. Click for its sequence diagram.',
              ],
            ]
        ).map(([term, text]) => h('li', {}, h('strong', {}, term), ' — ', text)),
      ),
    ),
    footer(),
  )
}

export function pageNotFound() {
  return h(
    'div',
    { class: 'page' },
    h('h1', {}, T('notFound')),
    h('a', { class: 'btn', href: href() }, icon('back', 16), T('backHome')),
  )
}
