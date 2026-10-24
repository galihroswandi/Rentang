// Deterministic generator for large fictional projects (performance tests). Never committed as a file.
import { addDays, toIsoDate } from '../dates.ts'
import type { Dependency, Project, Task } from '../model.ts'

/** mulberry32: a tiny seeded PRNG, so the same seed always yields the same project. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `taskCount` tasks in groups of ten: one summary task and nine subtasks. Subtasks chain
 * within a group, the first subtask depends on the previous group, and some extra links
 * cross groups. Every dependency points forward, so the graph has no cycles.
 */
export function generateProject(taskCount = 200, seed = 42): Project {
  const random = createRandom(seed)
  const pick = (max: number): number => Math.floor(random() * max)
  const projectStart = toIsoDate('2026-01-05')
  const tasks: Task[] = []
  const dependencies: Dependency[] = []
  const leaves: string[] = []
  let parentId = ''

  const link = (from: string, to: string): void => {
    if (dependencies.some((dependency) => dependency.from === from && dependency.to === to)) return
    dependencies.push({ id: `${from}-${to}`, from, to, type: 'finish-to-start', lag: pick(3) })
  }

  for (let index = 0; index < taskCount; index++) {
    const id = `t${String(index + 1)}`
    const isSummary = index % 10 === 0
    const isMilestone = !isSummary && index % 10 === 9
    tasks.push({
      id,
      name: isSummary ? `Fase ${String(index / 10 + 1)}` : `Tugas ${String(index + 1)}`,
      start: addDays(projectStart, index * 2 + pick(5)),
      duration: isMilestone ? 0 : 1 + pick(10),
      progress: pick(5) * 25,
      isMilestone,
      order: index % 10,
      ...(isSummary ? {} : { parentId }),
    })
    if (isSummary) {
      parentId = id
      continue
    }
    const previous = leaves.at(-1)
    if (previous !== undefined) link(previous, id)
    if (leaves.length > 10 && random() < 0.3) {
      link(leaves[pick(leaves.length - 10)] ?? previous ?? id, id)
    }
    leaves.push(id)
  }

  return {
    id: `generated-${String(seed)}`,
    name: 'Proyek Uji Besar',
    area: 'work',
    calendar: {
      workingDays: [1, 2, 3, 4, 5],
      holidays: ['2026-03-20', '2026-05-01', '2026-08-17'].map((date) => ({
        date: toIsoDate(date),
      })),
    },
    tasks,
    dependencies,
    roles: [],
    resources: [],
    assignments: [],
    documents: [],
  }
}
