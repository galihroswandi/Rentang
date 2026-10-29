/** Which tasks a task can wait for, and who already does. */
import { buildLeafGraph } from '../../core/graph.ts'
import type { Project } from '../../core/model.ts'
import { subtreeOf } from '../../app/edits/project-edits.ts'

export type PredecessorOption = { readonly id: string; readonly label: string }

/**
 * Every task `taskId` may wait for, in tree order, indented by depth. A task that would make
 * a loop (it already waits for `taskId`, directly or not) and `taskId`'s own subtree are left
 * out. For a task that does not exist yet, pass null.
 */
export function predecessorOptions(project: Project, taskId: string | null): PredecessorOption[] {
  const own = taskId === null ? new Set<string>() : subtreeOf(project, taskId)
  const out: PredecessorOption[] = []
  const walk = (parentId: string | undefined, depth: number): void => {
    const children = project.tasks
      .filter((task) => task.parentId === parentId)
      .sort((a, b) => a.order - b.order)
    for (const task of children) {
      if (own.has(task.id)) continue
      if (taskId === null || !makesLoop(project, task.id, taskId)) {
        out.push({ id: task.id, label: `${'— '.repeat(depth)}${task.name}` })
      }
      walk(task.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return out
}

function makesLoop(project: Project, from: string, to: string): boolean {
  const dependencies = [
    ...project.dependencies.filter((dependency) => dependency.to !== to),
    { id: '_probe', from, to, type: 'finish-to-start' as const, lag: 0 },
  ]
  return !buildLeafGraph({ tasks: project.tasks, dependencies }).ok
}

/** Ids of the tasks `taskId` waits for now. */
export function predecessorIds(project: Project, taskId: string): string[] {
  return project.dependencies
    .filter((dependency) => dependency.to === taskId)
    .map((dependency) => dependency.from)
}
