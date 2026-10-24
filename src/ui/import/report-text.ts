/** Turns the structured import report from core into Indonesian sentences. */
import type { DependencyKind, ImportReport } from '../../core/gan/report.ts'
import type { Project } from '../../core/model.ts'
import { formatWorkingDays, MONTHS } from '../format.ts'

export type ReportLine = { readonly text: string; readonly detail?: string }

export type ReportText = {
  readonly counts: { readonly imported: number; readonly changed: number; readonly skipped: number }
  readonly imported: readonly string[]
  readonly changed: readonly ReportLine[]
  readonly skipped: readonly ReportLine[]
}

const KIND_LABEL: Readonly<Record<DependencyKind, string>> = {
  'start-to-start': 'start-to-start',
  'finish-to-finish': 'finish-to-finish',
  'start-to-finish': 'start-to-finish',
  unknown: 'berjenis tidak dikenal',
}

function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

function only<C extends string, T extends { code: string }>(
  items: readonly T[],
  code: C,
): Extract<T, { code: C }>[] {
  return items.filter((item): item is Extract<T, { code: C }> => item.code === code)
}

/** Adds a line only when there is something to say. */
function line(lines: ReportLine[], count: number, text: string, detail?: string): void {
  if (count === 0) return
  lines.push(detail === undefined || detail === '' ? { text } : { text, detail })
}

export function describeReport(report: ImportReport, project: Project): ReportText {
  const names = new Map(project.tasks.map((task) => [task.id, task.name]))
  const nameOf = (id: string): string => names.get(id) ?? `#${id}`
  const pair = ({ from, to }: { from: string; to: string }): string =>
    `${nameOf(from)} → ${nameOf(to)}`
  const list = (ids: readonly string[]): string => ids.map(nameOf).join(' · ')

  const parentIds = new Set(project.tasks.map((task) => task.parentId))
  const summaries = project.tasks.filter((task) => parentIds.has(task.id)).length
  const milestones = project.tasks.filter((task) => task.isMilestone).length
  const withNotes = project.tasks.filter((task) => task.notes !== undefined).length
  const { imported } = report

  const parts = [
    summaries > 0 ? `${String(summaries)} tugas induk` : '',
    milestones > 0 ? `${String(milestones)} milestone` : '',
  ]
    .filter(Boolean)
    .join(' dan ')
  const importedLines = [
    `${String(imported.tasks)} tugas${parts ? `, termasuk ${parts}` : ''}`,
    `${String(imported.dependencies)} dependensi`,
    ...(imported.resources > 0
      ? [`${String(imported.resources)} resource dan ${String(imported.assignments)} penugasan`]
      : []),
    `Kalender kerja: ${formatWorkingDays(project.calendar.workingDays)}`,
    ...(imported.holidays > 0 ? [`${String(imported.holidays)} hari libur`] : []),
    ...(withNotes > 0
      ? [`Catatan ${String(withNotes)} tugas (teks polos) masuk ke catatan tugas`]
      : []),
  ]

  const changed: ReportLine[] = []
  const { changed: changes } = report
  for (const [kind, items] of groupBy(
    only(changes, 'dependency-type-converted'),
    (item) => item.original,
  )) {
    line(
      changed,
      items.length,
      `${String(items.length)} dependensi ${KIND_LABEL[kind]} menjadi finish-to-start. Jadwal bisa bergeser.`,
      items.map(pair).join(' · '),
    )
  }
  const summaryProgress = only(changes, 'summary-progress-recalculated')
  line(
    changed,
    summaryProgress.length,
    `Persen selesai pada ${String(summaryProgress.length)} tugas induk dihitung ulang dari anak-anaknya`,
    list(summaryProgress.map((item) => item.taskId)),
  )
  const milestoneDurations = only(changes, 'milestone-duration-reset')
  line(
    changed,
    milestoneDurations.length,
    `Durasi ${String(milestoneDurations.length)} milestone dijadikan 0 hari`,
    list(milestoneDurations.map((item) => item.taskId)),
  )
  const zeroDurations = only(changes, 'zero-duration-raised')
  line(
    changed,
    zeroDurations.length,
    `${String(zeroDurations.length)} tugas berdurasi 0 dijadikan 1 hari kerja`,
    list(zeroDurations.map((item) => item.taskId)),
  )
  const progress = only(changes, 'progress-adjusted')
  line(
    changed,
    progress.length,
    `Persen selesai ${String(progress.length)} tugas dibulatkan ke 0–100`,
    list(progress.map((item) => item.taskId)),
  )
  const lags = only(changes, 'lag-reset')
  line(
    changed,
    lags.length,
    `Jeda ${String(lags.length)} dependensi tidak terbaca dan dijadikan 0`,
    lags.map(pair).join(' · '),
  )
  line(
    changed,
    only(changes, 'default-work-week').length,
    'Minggu kerja tidak terbaca, jadi dipakai Senin sampai Jumat',
  )

  const skipped: ReportLine[] = []
  const { skipped: skips } = report
  const baselines = only(skips, 'baseline')
  line(
    skipped,
    baselines.length,
    baselines.length === 1
      ? '1 baseline tersimpan'
      : `${String(baselines.length)} baseline tersimpan`,
    baselines.map((item) => `“${item.name}”`).join(' · '),
  )
  for (const property of only(skips, 'custom-property')) {
    skipped.push({ text: `Kolom kustom “${property.name}”` })
  }
  const recurring = only(skips, 'recurring-holiday')
  line(
    skipped,
    recurring.length,
    `${String(recurring.length)} hari libur berulang tiap tahun`,
    recurring
      .map((item) => {
        const month = MONTHS[Number(item.month) - 1] ?? item.month
        return item.name ? `${item.name} (${item.day} ${month})` : `${item.day} ${month}`
      })
      .join(' · '),
  )
  const badHolidays = only(skips, 'invalid-holiday')
  line(
    skipped,
    badHolidays.length,
    `${String(badHolidays.length)} hari libur bertanggal tidak valid`,
  )
  const exceptions = only(skips, 'unsupported-calendar-day')
  line(
    skipped,
    exceptions.length,
    `${String(exceptions.length)} pengecualian kalender selain hari libur`,
  )
  const tasks = only(skips, 'invalid-task')
  line(
    skipped,
    tasks.length,
    `${String(tasks.length)} tugas tidak terbaca`,
    tasks.map((item) => `#${item.taskId}`).join(' · '),
  )
  const links = only(skips, 'invalid-link')
  line(
    skipped,
    links.length,
    `${String(links.length)} tautan tugas yang tidak valid`,
    list(links.map((item) => item.taskId)),
  )
  const brokenDependencies = [
    ...only(skips, 'dangling-dependency'),
    ...only(skips, 'duplicate-dependency'),
    ...only(skips, 'self-dependency'),
  ]
  line(
    skipped,
    brokenDependencies.length,
    `${String(brokenDependencies.length)} dependensi yang rusak atau ganda`,
  )
  const assignments = only(skips, 'dangling-assignment')
  line(
    skipped,
    assignments.length,
    `${String(assignments.length)} penugasan ke tugas atau resource yang tidak ada`,
  )

  return {
    counts: { imported: imported.tasks, changed: changes.length, skipped: skips.length },
    imported: importedLines,
    changed,
    skipped,
  }
}
