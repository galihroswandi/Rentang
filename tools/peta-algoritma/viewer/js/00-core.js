// Core of the viewer: data, interface text, small DOM helpers, preferences, code links and
// the hash router. Every viewer file is joined into one script in name order.

export const DATA = JSON.parse(document.getElementById('peta-data').textContent)
export const LANG = DATA.meta.language === 'en' ? 'en' : 'id'

const STRINGS = {
  id: {
    skip: 'Lompat ke isi',
    home: 'Mulai',
    map: 'Peta arsitektur',
    flows: 'Alur',
    problems: 'Ada masalah?',
    diagrams: 'Model & status',
    glossary: 'Istilah',
    files: 'Indeks berkas',
    uml: 'Cara membaca UML',
    modules: 'Modul',
    search: 'Cari',
    searchHint: 'Cari modul, fungsi, berkas, alur, gejala…',
    searchEmpty: 'Tidak ada yang cocok. Coba kata lain, mis. nama fungsi atau gejala.',
    searchKinds: {
      page: 'Halaman',
      module: 'Modul',
      algorithm: 'Algoritma',
      symbol: 'Kode',
      file: 'Berkas',
      flow: 'Alur',
      symptom: 'Gejala',
      term: 'Istilah',
      diagram: 'Diagram',
    },
    menu: 'Menu',
    close: 'Tutup',
    theme: 'Ganti tema',
    openIn: 'Buka kode di',
    editorNames: { vscode: 'VS Code', cursor: 'Cursor', idea: 'JetBrains', github: 'GitHub' },
    settings: 'Pengaturan',
    layer: 'Lapisan',
    group: 'Grup',
    stats: (s) =>
      `${s.modules} modul · ${s.algorithms} algoritma · ${s.flows} alur · ${s.diagrams} diagram`,
    coverage: 'Cakupan berkas',
    explainedExports: 'Fungsi ekspor terjelaskan',
    generated: (date, commit) => `Dibuat ${date}${commit ? ` dari commit ${commit}` : ''}`,
    welcome: 'Selamat datang',
    architecture: 'Gambaran arsitektur',
    architectureLead:
      'Diagram paket UML: setiap paket adalah satu lapisan. Panah putus-putus «use» berarti boleh memakai; arahnya tidak pernah berbalik.',
    principles: 'Aturan emas',
    pipeline: 'Jalur data utama',
    pipelineLead: 'Urutan data dari model sampai tergambar di layar. Klik untuk membuka modulnya.',
    readingOrder: 'Rute belajar',
    readingLead: 'Baca berurutan. Setiap modul punya diagram aktivitas untuk algoritmanya.',
    startReading: 'Mulai dari langkah 1',
    umlKinds: 'Diagram yang tersedia',
    umlKindsLead: 'Semua memakai notasi UML standar. Lupa artinya? Buka "Cara membaca UML".',
    kindUseCase: ['Diagram use case', 'Apa yang bisa dilakukan pengguna.', 'flows'],
    kindSequence: ['Diagram urutan', 'Bagaimana satu aksi mengalir lintas lapisan.', 'flows'],
    kindComponent: ['Diagram komponen', 'Modul, lapisan, dan siapa memakai siapa.', 'map'],
    kindActivity: ['Diagram aktivitas', 'Langkah demi langkah tiap algoritma.', 'map'],
    kindClass: ['Diagram kelas', 'Bentuk data yang disimpan dan yang dihitung.', 'diagrams'],
    kindState: ['Diagram status', 'Bagian aplikasi yang berganti status.', 'diagrams'],
    problemsLead: 'Pilih gejala yang paling mirip. Tersangka diurutkan dari yang paling mungkin.',
    seeAll: 'Lihat semua',
    howTo: 'Cara memakai peta ini',
    howToItems: [
      ['/', 'atau Ctrl K untuk mencari apa saja'],
      ['Klik kode', 'membuka berkas tepat di barisnya'],
      ['Arahkan kursor', 'ke komponen di peta untuk melihat relasinya'],
      ['Esc', 'menutup pencarian atau menu'],
    ],
    mapLead:
      'Diagram komponen UML. Paket = lapisan, kotak = modul. Arahkan kursor (atau fokus) ke modul untuk melihat dependensinya; klik untuk membaca algoritmanya.',
    highlightFlow: 'Sorot alur',
    noFlow: 'Tanpa alur',
    filterLayers: 'Tampilkan lapisan',
    uses: 'memakai',
    usedBy: 'dipakai oleh',
    flowOrder: 'urutan alur',
    typeOnly: 'hanya tipe',
    mayUse: (to) => `«use» boleh memakai ${to}`,
    algorithms: 'Algoritma',
    algorithmCount: (n) => `${n} algoritma`,
    moduleCount: (n) => `${n} modul`,
    lines: (n) => `${n} baris`,
    mainFile: 'Berkas utama',
    otherFiles: 'Berkas lain',
    relations: 'Relasi',
    relationsLead:
      'Dihitung otomatis dari impor kode. Kiri: modul yang memakai modul ini. Kanan: yang dipakainya.',
    externals: 'Pustaka luar',
    none: 'Tidak ada',
    why: 'Peran',
    rules: 'Aturan yang dijaga',
    pitfalls: 'Jebakan',
    input: 'Masukan',
    output: 'Keluaran',
    howItWorks: 'Cara kerja (diagram aktivitas)',
    textVersion: 'Versi teks langkah',
    examples: 'Contoh',
    given: 'Masukan',
    result: 'Hasil',
    note: 'Catatan',
    complexity: 'Kompleksitas',
    code: 'Kode',
    viewCode: 'Lihat kode',
    truncated: 'dipotong, buka berkasnya untuk selengkapnya',
    tests: 'Test',
    copy: 'Salin',
    copied: 'Tersalin',
    copyPath: 'Salin path',
    exportsTitle: 'Isi berkas (otomatis dari kode)',
    exportsLead:
      'Semua yang diekspor modul ini, dengan komentar dokumentasinya. Tanda ✓ = dijelaskan di algoritma di atas.',
    explained: 'dijelaskan',
    notExplained: 'belum dijelaskan',
    inFlows: 'Muncul di alur',
    inSymptoms: 'Periksa modul ini bila…',
    onThisPage: 'Di halaman ini',
    prev: 'Sebelumnya',
    next: 'Berikutnya',
    flowsLead:
      'Setiap alur adalah satu use case. Diagram use case menunjukkan apa yang bisa dilakukan; klik untuk melihat diagram urutannya.',
    otherFlows: 'Lainnya',
    steps: (n) => `${n} pesan`,
    trigger: 'Pemicu',
    flowResult: 'Hasil',
    participants: 'Peserta',
    stepList: 'Langkah',
    stepListLead: 'Nomor sama dengan nomor pesan di diagram. Arahkan kursor untuk menyorot.',
    involved: 'Modul yang terlibat',
    reply: 'balasan',
    actor: 'aktor',
    problemsTitle: 'Ada masalah? Mulai dari gejalanya',
    filterProblems: 'Saring gejala…',
    all: 'Semua',
    suspects: 'Tersangka, urut dari yang paling mungkin',
    verify: 'Cara memastikan',
    tip: 'Saran',
    noProblems: 'Tidak ada gejala yang cocok.',
    glossaryLead: 'Istilah yang dipakai di kode dan di peta ini.',
    seeModules: 'Lihat',
    filesLead:
      'Setiap berkas dalam cakupan harus masuk ke satu modul atau diabaikan dengan alasan. Pemeriksaan peta gagal bila ada yang terlewat.',
    filterFiles: 'Saring berkas…',
    ignored: 'diabaikan',
    file: 'Berkas',
    module: 'Modul',
    diagramsLead:
      'Diagram kelas untuk bentuk data, diagram status untuk bagian yang berganti status.',
    usedIn: 'Dipakai di',
    legendTitle: 'Cara membaca UML di peta ini',
    legendLead:
      'Ringkasan notasi UML yang dipakai. Cukup ini yang perlu diingat untuk membaca semua diagram di sini.',
    yes: 'ya',
    no: 'tidak',
    next_: 'berikutnya',
    done: 'selesai',
    notFound: 'Halaman tidak ditemukan.',
    backHome: 'Kembali ke Mulai',
    diagramLabel: (kind, name) => `${kind}: ${name}`,
    readTime: (n) => `${n} langkah`,
    openModule: 'Buka modul',
    openFlow: 'Buka diagram urutannya',
    umlDiagrams: 'diagram UML',
    legendLink: 'Cara membaca',
    fitWidth: 'Muat ke layar',
    actualSize: 'Ukuran asli',
  },
  en: {
    skip: 'Skip to content',
    home: 'Start',
    map: 'Architecture',
    flows: 'Flows',
    problems: 'Something wrong?',
    diagrams: 'Model & state',
    glossary: 'Glossary',
    files: 'File index',
    uml: 'Reading UML',
    modules: 'Modules',
    search: 'Search',
    searchHint: 'Search modules, functions, files, flows, symptoms…',
    searchEmpty: 'Nothing matches. Try a function name or a symptom.',
    searchKinds: {
      page: 'Page',
      module: 'Module',
      algorithm: 'Algorithm',
      symbol: 'Code',
      file: 'File',
      flow: 'Flow',
      symptom: 'Symptom',
      term: 'Term',
      diagram: 'Diagram',
    },
    menu: 'Menu',
    close: 'Close',
    theme: 'Switch theme',
    openIn: 'Open code in',
    editorNames: { vscode: 'VS Code', cursor: 'Cursor', idea: 'JetBrains', github: 'GitHub' },
    settings: 'Settings',
    layer: 'Layer',
    group: 'Group',
    stats: (s) =>
      `${s.modules} modules · ${s.algorithms} algorithms · ${s.flows} flows · ${s.diagrams} diagrams`,
    coverage: 'File coverage',
    explainedExports: 'Exported functions explained',
    generated: (date, commit) => `Built ${date}${commit ? ` from commit ${commit}` : ''}`,
    welcome: 'Welcome',
    architecture: 'Architecture at a glance',
    architectureLead:
      'UML package diagram: each package is a layer. Dashed «use» arrows show what may be used; they never point back up.',
    principles: 'Golden rules',
    pipeline: 'Main data path',
    pipelineLead: 'How data travels from the model to the screen. Click to open a module.',
    readingOrder: 'Learning route',
    readingLead: 'Read in order. Every module has activity diagrams for its algorithms.',
    startReading: 'Start with step 1',
    umlKinds: 'Diagrams in this map',
    umlKindsLead: 'All use standard UML notation. Forgot a symbol? Open "Reading UML".',
    kindUseCase: ['Use case diagram', 'What a user can do.', 'flows'],
    kindSequence: ['Sequence diagram', 'How one action travels through the layers.', 'flows'],
    kindComponent: ['Component diagram', 'Modules, layers and who uses whom.', 'map'],
    kindActivity: ['Activity diagram', 'Each algorithm, step by step.', 'map'],
    kindClass: ['Class diagram', 'The shape of stored and computed data.', 'diagrams'],
    kindState: ['State diagram', 'Parts of the app that change state.', 'diagrams'],
    problemsLead: 'Pick the closest symptom. Suspects are ordered from most to least likely.',
    seeAll: 'See all',
    howTo: 'Using this map',
    howToItems: [
      ['/', 'or Ctrl K to search anything'],
      ['Click code', 'opens the file at that line'],
      ['Hover', 'a component on the map to see its relations'],
      ['Esc', 'closes search or the menu'],
    ],
    mapLead:
      'UML component diagram. Packages are layers, boxes are modules. Hover (or focus) a module to see its dependencies; click to read its algorithms.',
    highlightFlow: 'Highlight flow',
    noFlow: 'No flow',
    filterLayers: 'Show layers',
    uses: 'uses',
    usedBy: 'used by',
    flowOrder: 'flow order',
    typeOnly: 'types only',
    mayUse: (to) => `«use» may use ${to}`,
    algorithms: 'Algorithms',
    algorithmCount: (n) => `${n} algorithms`,
    moduleCount: (n) => `${n} modules`,
    lines: (n) => `${n} lines`,
    mainFile: 'Main file',
    otherFiles: 'Other files',
    relations: 'Relations',
    relationsLead:
      'Derived from the code’s imports. Left: modules using this one. Right: what it uses.',
    externals: 'Packages',
    none: 'None',
    why: 'Role',
    rules: 'Rules it keeps',
    pitfalls: 'Pitfalls',
    input: 'Input',
    output: 'Output',
    howItWorks: 'How it works (activity diagram)',
    textVersion: 'Steps as text',
    examples: 'Examples',
    given: 'Given',
    result: 'Result',
    note: 'Note',
    complexity: 'Complexity',
    code: 'Code',
    viewCode: 'View code',
    truncated: 'cut short, open the file for the rest',
    tests: 'Tests',
    copy: 'Copy',
    copied: 'Copied',
    copyPath: 'Copy path',
    exportsTitle: 'File contents (from the code)',
    exportsLead:
      'Everything this module exports, with its doc comment. ✓ = explained by an algorithm above.',
    explained: 'explained',
    notExplained: 'not explained yet',
    inFlows: 'Appears in flows',
    inSymptoms: 'Check this module when…',
    onThisPage: 'On this page',
    prev: 'Previous',
    next: 'Next',
    flowsLead:
      'Each flow is a use case. The use case diagram shows what can be done; click one to see its sequence diagram.',
    otherFlows: 'Other',
    steps: (n) => `${n} messages`,
    trigger: 'Trigger',
    flowResult: 'Result',
    participants: 'Participants',
    stepList: 'Steps',
    stepListLead: 'Numbers match the message numbers in the diagram. Hover to highlight.',
    involved: 'Modules involved',
    reply: 'reply',
    actor: 'actor',
    problemsTitle: 'Something wrong? Start from the symptom',
    filterProblems: 'Filter symptoms…',
    all: 'All',
    suspects: 'Suspects, most likely first',
    verify: 'How to confirm',
    tip: 'Tip',
    noProblems: 'No symptom matches.',
    glossaryLead: 'Terms used in the code and on this map.',
    seeModules: 'See',
    filesLead:
      'Every file in coverage belongs to a module or is ignored with a reason. The map check fails when one is missed.',
    filterFiles: 'Filter files…',
    ignored: 'ignored',
    file: 'File',
    module: 'Module',
    diagramsLead: 'Class diagrams for data shapes, state diagrams for parts that change state.',
    usedIn: 'Used in',
    legendTitle: 'Reading the UML on this map',
    legendLead:
      'The UML notation used here. This is all you need to read every diagram on the map.',
    yes: 'yes',
    no: 'no',
    next_: 'next',
    done: 'done',
    notFound: 'Page not found.',
    backHome: 'Back to Start',
    diagramLabel: (kind, name) => `${kind}: ${name}`,
    readTime: (n) => `${n} steps`,
    openModule: 'Open module',
    openFlow: 'Open its sequence diagram',
    umlDiagrams: 'UML diagrams',
    legendLink: 'How to read',
    fitWidth: 'Fit to screen',
    actualSize: 'Actual size',
  },
}

/** Interface text; a function entry is called with the arguments. */
export function T(key, ...args) {
  const value = STRINGS[LANG][key] ?? STRINGS.id[key] ?? key
  return typeof value === 'function' ? value(...args) : value
}

// ---- Indexes -------------------------------------------------------------------------
const byId = (list) => new Map(list.map((item) => [item.id, item]))
export const layerById = byId(DATA.layers)
export const groupById = byId(DATA.groups)
export const moduleById = byId(DATA.modules)
export const flowById = byId(DATA.flows)
export const diagramById = byId(DATA.diagrams)
export const categoryById = byId(DATA.categories)
export const SYMBOLS = DATA.symbols

export const layerOfModule = (module) => layerById.get(module.layer)
export const layerColor = (layerId) => layerById.get(layerId)?.color ?? 'var(--accent)'
export const basename = (path) => path.split('/').pop()

// ---- DOM helpers -----------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg'

function applyAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue
    if (key === 'class')
      el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value)
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value))
        if (v !== undefined && v !== null) el.style.setProperty(prop, v)
    } else if (key.startsWith('on') && typeof value === 'function')
      el.addEventListener(key.slice(2), value)
    else el.setAttribute(key, value === true ? '' : String(value))
  }
}

function appendKids(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === '') continue
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  }
}

/** h('a', { href, class }, 'text', child) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag)
  applyAttrs(el, attrs)
  appendKids(el, kids)
  return el
}

export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag)
  applyAttrs(el, attrs)
  appendKids(el, kids)
  return el
}

const ICONS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.5 16.5 21 21',
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10',
  map: 'M12 3 21 8l-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  flow: 'M6 3v18M18 3v18M6 8h10M14 6l2 2-2 2M18 15H8M10 13l-2 2 2 2',
  alert: 'M12 3.5 2.5 20h19zM12 10v4.5M12 17.5v.01',
  diagram: 'M3.5 4h7v6h-7zM13.5 14h7v6h-7zM7 10v4h6.5M17 14v-4h-6.5',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5V5.5M8 7h8',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5M12 16.8v.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  code: 'M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  menu: 'M4 6.5h16M4 12h16M4 17.5h16',
  x: 'M6 6l12 12M18 6 6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  component: 'M8 4h12v16H8zM5 7.5h6v3H5zM5 13.5h6v3H5z',
  check: 'M5 12.5 10 17l9-10',
  user: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0',
  sliders: 'M4 7h9M17 7h3M15 5v4M4 12h3M11 12h9M9 10v4M4 17h11M19 17h1M17 15v4',
  layers: 'M3 6h18M3 12h18M3 18h18',
}

export function icon(name, size = 18) {
  return s(
    'svg',
    { class: 'icon', width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    s('path', { d: ICONS[name] ?? '' }),
  )
}

// ---- Preferences ------------------------------------------------------------------------
export const prefs = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(`peta.${key}`)
      return value === null ? fallback : value
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`peta.${key}`, value)
    } catch {
      // Private windows may refuse storage; the choice then lasts for this visit.
    }
  },
}

// ---- Code links ---------------------------------------------------------------------------
export const CAN_EDITOR = Boolean(DATA.meta.root) && DATA.meta.editor !== 'none'
export const CAN_GITHUB = Boolean(DATA.meta.repository)

export function codeTarget() {
  const saved = prefs.get('target', null)
  if (saved === 'github' && CAN_GITHUB) return 'github'
  if (saved && saved !== 'github' && CAN_EDITOR) return saved
  return CAN_EDITOR ? DATA.meta.editor : CAN_GITHUB ? 'github' : 'none'
}

function githubUrl(file, line) {
  const repo = DATA.meta.repository
  return repo ? `${repo.url}/blob/${repo.branch}/${file}${line ? `#L${line}` : ''}` : null
}

export function codeUrl(file, line = 1, target = codeTarget()) {
  const absolute = `${DATA.meta.root}/${file}`
  switch (target) {
    case 'vscode':
      return `vscode://file/${absolute}:${line}:1`
    case 'cursor':
      return `cursor://file/${absolute}:${line}:1`
    case 'idea':
      return `idea://open?file=${encodeURIComponent(absolute)}&line=${line}`
    case 'github':
      return githubUrl(file, line)
    default:
      return null
  }
}

/** A link that opens `file` at `line` in the chosen editor or on GitHub. */
export function codeLink(file, line, label, extraClass = '') {
  const url = codeUrl(file, line)
  const text = label ?? `${basename(file)}${line ? `:${line}` : ''}`
  if (!url) return h('code', { class: ['code-ref', 'is-static', extraClass], title: file }, text)
  const github = url.startsWith('http')
  return h(
    'a',
    {
      class: ['code-ref', extraClass],
      href: url,
      title: `${file}${line ? `:${line}` : ''}`,
      ...(github ? { target: '_blank', rel: 'noreferrer' } : {}),
    },
    icon('code', 14),
    h('span', {}, text),
  )
}

export function symbolLink(key, label) {
  const symbol = SYMBOLS[key]
  if (!symbol) return null
  return codeLink(symbol.file, symbol.line, label ?? symbol.name)
}

export function openCode(file, line) {
  const url = codeUrl(file, line)
  if (!url) return
  if (url.startsWith('http')) window.open(url, '_blank', 'noreferrer')
  else location.href = url
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text)
    const old = button.textContent
    button.textContent = T('copied')
    setTimeout(() => (button.textContent = old), 1200)
  } catch {
    // Clipboard may be blocked; the text is still visible to copy by hand.
  }
}

// ---- Router -----------------------------------------------------------------------------
export function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  return { page: parts[0] || 'home', id: parts[1] ?? null, sub: parts[2] ?? null }
}

export const href = (...parts) => `#/${parts.filter(Boolean).map(encodeURIComponent).join('/')}`
export const moduleHref = (id, algorithm) => href('m', id, algorithm)

export function moduleChip(id, extra = {}) {
  const module = moduleById.get(id)
  if (!module) return null
  return h(
    'a',
    {
      class: ['chip', 'module-chip', extra.class],
      href: moduleHref(id),
      style: { '--layer': layerColor(module.layer) },
    },
    h('span', { class: 'dot', 'aria-hidden': 'true' }),
    module.name,
  )
}

export function layerChip(layerId) {
  const layer = layerById.get(layerId)
  return layer
    ? h(
        'span',
        { class: 'chip layer-chip', style: { '--layer': layer.color ?? 'var(--accent)' } },
        layer.name,
      )
    : null
}

export function formatDate(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(LANG === 'id' ? 'id-ID' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}
