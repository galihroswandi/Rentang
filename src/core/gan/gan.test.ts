import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeCriticalPath } from '../critical-path.ts'
import { schedule } from '../schedule.ts'
import { coffeeShopProject } from '../test-utils/coffee-shop.ts'
import { importGan, type GanImport, type GanImportError } from './map.ts'
import { parseGan } from './parse.ts'

const fixture = readFileSync(
  new URL('../../../fixtures/kedai-kopi-demo.gan', import.meta.url),
  'utf8',
)

const options = { projectId: 'p1' }

function imported(xml: string): GanImport {
  const result = importGan(xml, options)
  if (!result.ok) throw new Error(`Import failed: ${JSON.stringify(result.error)}`)
  return result.value
}

function failure(xml: string): GanImportError {
  const result = importGan(xml, options)
  if (result.ok) throw new Error('Expected the import to fail')
  return result.error
}

/** A minimal .gan document; pass inner XML for the parts a test cares about. */
function gan({
  tasks = '',
  calendars = '<calendars><day-types><default-week sun="1" mon="0" tue="0" wed="0" thu="0" fri="0" sat="1"/></day-types></calendars>',
  rest = '',
}: {
  tasks?: string
  calendars?: string
  rest?: string
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?><project name="Uji">${calendars}<tasks>${tasks}</tasks>${rest}</project>`
}

function t(id: string, attributes = '', children = ''): string {
  const merged = new Map([
    ['id', id],
    ['name', `Tugas ${id}`],
    ['meeting', 'false'],
    ['start', '2026-11-02'],
    ['duration', '1'],
  ])
  for (const [, key, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {
    if (key !== undefined && value !== undefined) merged.set(key, value)
  }
  const text = [...merged].map(([key, value]) => `${key}="${value}"`).join(' ')
  return `<task ${text}>${children}</task>`
}

describe('importGan with the demo fixture', () => {
  const { project, report } = imported(fixture)

  it('reports what was imported, changed and skipped', () => {
    expect(report).toEqual({
      imported: { tasks: 14, dependencies: 11, resources: 1, assignments: 1, holidays: 0 },
      changed: [
        { code: 'summary-progress-recalculated', taskId: '1', original: 64 },
        { code: 'dependency-type-converted', from: '6', to: '14', original: 'start-to-start' },
      ],
      skipped: [
        { code: 'recurring-holiday', month: '1', day: '1', name: 'Tahun Baru' },
        { code: 'custom-property', name: 'Anggaran' },
        { code: 'baseline', name: 'Rencana awal' },
      ],
    })
  })

  it('maps tasks, hierarchy, notes, links and assignments', () => {
    const byId = new Map(project.tasks.map((task) => [task.id, task]))
    expect(project.name).toBe('Peluncuran Kedai Kopi')
    expect(project.area).toBe('work')
    expect(project.calendar).toEqual({ workingDays: [1, 2, 3, 4, 5], holidays: [] })
    expect(byId.get('2')).toMatchObject({ parentId: '1', progress: 100, order: 0, duration: 3 })
    expect(byId.get('2')?.notes).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Bandingkan tiga lokasi.' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Catat lalu lintas pejalan kaki pagi dan sore.' }],
        },
      ],
    })
    expect(byId.get('4')?.link).toBe('https://example.com/kontrak-sewa')
    expect(byId.get('13')).toMatchObject({ isMilestone: true, duration: 0 })
    expect(byId.get('14')).toMatchObject({ name: 'Cetak menu & papan harga', order: 4 })
    expect(project.roles).toEqual([{ id: 'custom-1', name: 'Barista' }])
    expect(project.resources).toEqual([{ id: '0', name: 'Rina (fiktif)', roleId: 'custom-1' }])
    expect(project.assignments).toEqual([{ id: '10:0', taskId: '10', resourceId: '0' }])
  })

  it('schedules exactly like the golden project', () => {
    const fromFixture = schedule(project)
    const golden = schedule(coffeeShopProject())
    if (!fromFixture.ok || !golden.ok) throw new Error('Unexpected cycle')
    for (const [id, dates] of golden.value.tasks) {
      expect(fromFixture.value.tasks.get(id)).toEqual(dates)
    }
    expect(fromFixture.value.tasks.get('14')).toMatchObject({
      start: '2026-11-23',
      end: '2026-11-24',
    })

    const critical = analyzeCriticalPath(project)
    expect(
      critical.ok && [...critical.value.critical].sort((a, b) => Number(a) - Number(b)),
    ).toEqual(['2', '3', '6', '7', '8', '11', '12', '13'])
  })
})

describe('parseGan errors', () => {
  it('reports malformed XML with its line', () => {
    const error = failure('<project>\n<tasks>\n</project>')
    expect(error).toMatchObject({ type: 'malformed-xml', line: 3 })
  })

  it('refuses XML that is not a GanttProject file', () => {
    expect(failure('<spreadsheet/>')).toEqual({ type: 'not-a-gan-file' })
  })

  it('reports a structure it cannot read', () => {
    const error = failure('<project><tasks><task name="tanpa id"/></tasks></project>')
    expect(error.type).toBe('invalid-structure')
    expect(error.type === 'invalid-structure' && error.issues.length).toBeGreaterThan(0)
  })

  it('reports a project the model rejects', () => {
    const error = failure(gan({ tasks: t('1', 'meeting="true" duration="0"', t('2')) }))
    expect(error.type).toBe('invalid-project')
    expect(error.type === 'invalid-project' && error.issues.join()).toContain(
      'A milestone cannot have subtasks',
    )
  })

  it('accepts empty optional sections', () => {
    const result = parseGan(
      '<project name="Kosong"><calendars/><tasks/><resources/><allocations/><previous/></project>',
    )
    expect(result.ok && result.value.tasks.task).toEqual([])
  })
})

describe('calendar', () => {
  it('reads the default week', () => {
    const week =
      '<calendars><day-types><default-week sun="0" mon="0" tue="0" wed="0" thu="0" fri="1" sat="1"/></day-types></calendars>'
    expect(imported(gan({ calendars: week })).project.calendar.workingDays).toEqual([0, 1, 2, 3, 4])
  })

  it.each([
    ['no calendar', ''],
    [
      'no working day',
      '<calendars><day-types><default-week sun="1" mon="1" tue="1" wed="1" thu="1" fri="1" sat="1"/></day-types></calendars>',
    ],
  ])('falls back to Monday to Friday with %s', (_, calendars) => {
    const { project, report } = imported(gan({ calendars }))
    expect(project.calendar.workingDays).toEqual([1, 2, 3, 4, 5])
    expect(report.changed).toEqual([{ code: 'default-work-week' }])
  })

  it('imports dated holidays and skips the rest', () => {
    const calendars = `<calendars>
      <day-types><default-week sun="1" mon="0" tue="0" wed="0" thu="0" fri="0" sat="1"/></day-types>
      <date year="2026" month="11" date="18" type="HOLIDAY">Libur fiktif</date>
      <date year="2026" month="12" date="1"/>
      <date year="2026" month="2" date="30" type="HOLIDAY"/>
      <date year="2026" month="11" date="7" type="WORKING_DAY"/>
    </calendars>`
    const { project, report } = imported(gan({ calendars }))
    expect(project.calendar.holidays).toEqual([
      { date: '2026-11-18', name: 'Libur fiktif' },
      { date: '2026-12-01' },
    ])
    expect(report.imported.holidays).toBe(2)
    expect(report.skipped).toEqual([
      { code: 'invalid-holiday', year: '2026', month: '2', day: '30' },
      { code: 'unsupported-calendar-day', type: 'WORKING_DAY' },
    ])
  })
})

describe('tasks', () => {
  it('skips unreadable tasks with their subtasks', () => {
    const tasks = [
      t('1'),
      t('1'),
      t('2', 'start="2026-02-30"', t('3') + t('4', '', t('5'))),
      t('6', 'duration="lama"'),
    ].join('')
    const { project, report } = imported(gan({ tasks }))
    expect(project.tasks.map((task) => task.id)).toEqual(['1'])
    expect(report.skipped).toEqual([
      { code: 'invalid-task', taskId: '1', reason: 'duplicate-id' },
      { code: 'invalid-task', taskId: '2', reason: 'invalid-start' },
      { code: 'invalid-task', taskId: '3', reason: 'parent-skipped' },
      { code: 'invalid-task', taskId: '4', reason: 'parent-skipped' },
      { code: 'invalid-task', taskId: '5', reason: 'parent-skipped' },
      { code: 'invalid-task', taskId: '6', reason: 'invalid-duration' },
    ])
  })

  it('normalises durations and progress, and reports it', () => {
    const tasks = [
      t('1', 'meeting="true" duration="1"'),
      t('2', 'duration="0"'),
      t('3', 'complete="33.6"'),
      t('4', 'complete="150"'),
      t('5', 'complete="banyak"'),
      t('6', 'complete="40"'),
    ].join('')
    const { project, report } = imported(gan({ tasks }))
    expect(project.tasks.map(({ duration, progress }) => [duration, progress])).toEqual([
      [0, 0],
      [1, 0],
      [1, 34],
      [1, 100],
      [1, 0],
      [1, 40],
    ])
    expect(report.changed).toEqual([
      { code: 'milestone-duration-reset', taskId: '1', originalDuration: 1 },
      { code: 'zero-duration-raised', taskId: '2' },
      { code: 'progress-adjusted', taskId: '3', original: '33.6' },
      { code: 'progress-adjusted', taskId: '4', original: '150' },
      { code: 'progress-adjusted', taskId: '5', original: 'banyak' },
    ])
  })

  it('keeps only valid links', () => {
    const tasks = [
      t('1', 'webLink="bukan tautan"'),
      t('2', 'webLink="%E0%A4%A"'),
      t('3', 'webLink=""'),
      t('4', 'webLink="https://example.com/a"'),
    ].join('')
    const { project, report } = imported(gan({ tasks }))
    expect(project.tasks.map((task) => task.link)).toEqual([
      undefined,
      undefined,
      undefined,
      'https://example.com/a',
    ])
    expect(report.skipped).toEqual([
      { code: 'invalid-link', taskId: '1' },
      { code: 'invalid-link', taskId: '2' },
    ])
  })

  it('turns notes into paragraphs and ignores empty notes', () => {
    const tasks =
      t('1', '', '<notes><![CDATA[Baris satu\n\nBaris tiga]]></notes>') +
      t('2', '', '<notes></notes>')
    const { project } = imported(gan({ tasks }))
    expect(project.tasks[0]?.notes).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Baris satu' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Baris tiga' }] },
      ],
    })
    expect(project.tasks[1]).not.toHaveProperty('notes')
  })

  it('uses the area from the options', () => {
    const result = importGan(gan({ tasks: t('1') }), { projectId: 'p2', area: 'career' })
    expect(result.ok && result.value.project).toMatchObject({
      id: 'p2',
      area: 'career',
      name: 'Uji',
    })
  })
})

describe('dependencies', () => {
  it('converts other types to finish-to-start and keeps lag', () => {
    const depends = [
      '<depend id="2" type="3" difference="0"/>',
      '<depend id="3" type="4" difference="-2"/>',
      '<depend id="4" type="9" difference="1"/>',
      '<depend id="5"/>',
    ].join('')
    const tasks = t('1', '', depends) + t('2') + t('3') + t('4') + t('5')
    const { project, report } = imported(gan({ tasks }))
    expect(project.dependencies.map(({ to, lag, type }) => [to, lag, type])).toEqual([
      ['2', 0, 'finish-to-start'],
      ['3', -2, 'finish-to-start'],
      ['4', 1, 'finish-to-start'],
      ['5', 0, 'finish-to-start'],
    ])
    expect(report.changed).toEqual([
      { code: 'dependency-type-converted', from: '1', to: '2', original: 'finish-to-finish' },
      { code: 'dependency-type-converted', from: '1', to: '3', original: 'start-to-finish' },
      { code: 'dependency-type-converted', from: '1', to: '4', original: 'unknown' },
    ])
  })

  it('skips self, dangling and duplicate dependencies, and resets bad lag', () => {
    const depends = [
      '<depend id="1" type="2"/>',
      '<depend id="99" type="2"/>',
      '<depend id="2" type="2" difference="dua"/>',
      '<depend id="2" type="2"/>',
    ].join('')
    const tasks =
      t('1', '', depends) + t('2', '', t('3', '', '<depend id="1" type="2" difference="1.5"/>'))
    const { project, report } = imported(gan({ tasks }))
    expect(project.dependencies).toEqual([
      { id: '1->2', from: '1', to: '2', type: 'finish-to-start', lag: 0 },
      { id: '3->1', from: '3', to: '1', type: 'finish-to-start', lag: 0 },
    ])
    expect(report.changed).toEqual([
      { code: 'lag-reset', from: '1', to: '2', original: 'dua' },
      { code: 'lag-reset', from: '3', to: '1', original: '1.5' },
    ])
    expect(report.skipped).toEqual([
      { code: 'self-dependency', taskId: '1' },
      { code: 'dangling-dependency', from: '1', to: '99' },
      { code: 'duplicate-dependency', from: '1', to: '2' },
    ])
  })
})

describe('task types and roles', () => {
  it('turns a known [TAG] prefix into the task type', () => {
    const tasks =
      t('1', 'name="[imp] Login"') + t('2', 'name="[XYZ] Lain"') + t('3', 'name="[BUG]"')
    const { project } = imported(gan({ tasks }))
    expect(project.tasks.map(({ name, type }) => [name, type])).toEqual([
      ['Login', 'IMP'],
      ['[XYZ] Lain', undefined],
      ['', 'BUG'],
    ])
  })

  it('maps built-in roles that are in use and every custom role', () => {
    const rest = `<roles roleset-name="Default"/><roles><role id="1" name="Barista"/><role id="2" name="Kasir"/></roles>
      <resources>
        <resource id="a" name="A" function="Default:4"/>
        <resource id="b" name="B" function="Default:0"/>
        <resource id="c" name="C" function="2"/>
        <resource id="d" name="D" function="9"/>
        <resource id="e" name="E"/>
      </resources>`
    const { project } = imported(gan({ tasks: t('1'), rest }))
    expect(project.roles).toEqual([
      { id: 'custom-1', name: 'Barista' },
      { id: 'custom-2', name: 'Kasir' },
      { id: 'default-4', name: 'Penguji' },
    ])
    expect(project.resources.map((resource) => resource.roleId)).toEqual([
      'default-4',
      undefined,
      'custom-2',
      undefined,
      undefined,
    ])
  })
})

describe('resources', () => {
  it('skips assignments to unknown tasks or resources', () => {
    const rest = `<resources><resource id="r" name="Kurir fiktif"/></resources>
      <allocations>
        <allocation task-id="1" resource-id="r"/>
        <allocation task-id="9" resource-id="r"/>
        <allocation task-id="1" resource-id="x"/>
      </allocations>`
    const { project, report } = imported(gan({ tasks: t('1'), rest }))
    expect(project.assignments).toEqual([{ id: '1:r', taskId: '1', resourceId: 'r' }])
    expect(report.skipped).toEqual([
      { code: 'dangling-assignment', taskId: '9', resourceId: 'r' },
      { code: 'dangling-assignment', taskId: '1', resourceId: 'x' },
    ])
  })
})
