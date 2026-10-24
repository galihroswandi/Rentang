// Writes a project as GanttProject XML so tests can feed large fictional .gan files to the
// importer. Test-only: Rentang itself never writes .gan files.
import type { Project, Task } from '../model.ts'

const escape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export function toGan(project: Project): string {
  const childrenOf = new Map<string | undefined, Task[]>()
  for (const task of project.tasks) {
    const siblings = childrenOf.get(task.parentId)
    if (siblings) siblings.push(task)
    else childrenOf.set(task.parentId, [task])
  }
  const depends = (id: string): string =>
    project.dependencies
      .filter((dependency) => dependency.from === id)
      .map(
        (dependency) =>
          `<depend id="${dependency.to}" type="2" difference="${String(dependency.lag)}" hardness="Strong"/>`,
      )
      .join('')
  const write = (parentId: string | undefined): string =>
    (childrenOf.get(parentId) ?? [])
      .sort((a, b) => a.order - b.order)
      .map(
        (task) =>
          `<task id="${task.id}" name="${escape(task.name)}" meeting="${String(task.isMilestone)}" start="${task.start}" duration="${String(task.duration)}" complete="${String(task.progress)}">` +
          depends(task.id) +
          write(task.id) +
          '</task>',
      )
      .join('')
  const week = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    .map((key, day) => `${key}="${project.calendar.workingDays.includes(day) ? '0' : '1'}"`)
    .join(' ')
  const holidays = project.calendar.holidays
    .map((holiday) => {
      const [year, month, day] = holiday.date.split('-').map(Number)
      return `<date year="${String(year)}" month="${String(month)}" date="${String(day)}" type="HOLIDAY"/>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><project name="${escape(project.name)}" version="3.3"><calendars><day-types><default-week ${week}/></day-types>${holidays}</calendars><tasks>${write(undefined)}</tasks></project>`
}
