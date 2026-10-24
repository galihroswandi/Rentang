/**
 * Dependency graph between leaf tasks (tasks without subtasks).
 *
 * A summary task spans its subtasks, so a dependency that touches a summary task is
 * rewritten as dependencies between leaves: "summary S finishes before X starts" means
 * every leaf under S finishes before X starts, and "X before summary S" means X finishes
 * before every leaf under S starts. The schedule is identical, and only leaves need dates.
 */
import type { Dependency, Task, TaskId } from './model.ts'
import { err, ok, type Result } from './result.ts'

export type LeafEdge = { readonly from: TaskId; readonly to: TaskId; readonly lag: number }

export type LeafGraph = {
  /** Leaf ids in a topological order: every predecessor comes before its successors. */
  readonly order: readonly TaskId[]
  readonly incoming: ReadonlyMap<TaskId, readonly LeafEdge[]>
  readonly outgoing: ReadonlyMap<TaskId, readonly LeafEdge[]>
  readonly childrenOf: ReadonlyMap<TaskId, readonly TaskId[]>
}

export type CycleError = {
  readonly type: 'dependency-cycle'
  /** Leaf tasks forming the cycle, in dependency order; the last one leads back to the first. */
  readonly taskIds: readonly TaskId[]
}

type GraphInput = { readonly tasks: readonly Task[]; readonly dependencies: readonly Dependency[] }

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function buildLeafGraph({ tasks, dependencies }: GraphInput): Result<LeafGraph, CycleError> {
  const childrenOf = new Map<TaskId, TaskId[]>()
  for (const task of tasks) {
    if (task.parentId !== undefined) push(childrenOf, task.parentId, task.id)
  }

  const leavesCache = new Map<TaskId, readonly TaskId[]>()
  const leavesOf = (id: TaskId): readonly TaskId[] => {
    const cached = leavesCache.get(id)
    if (cached) return cached
    const children = childrenOf.get(id)
    const leaves = children ? children.flatMap(leavesOf) : [id]
    leavesCache.set(id, leaves)
    return leaves
  }

  const leafIds = tasks.filter((task) => !childrenOf.has(task.id)).map((task) => task.id)
  const incoming = new Map<TaskId, LeafEdge[]>(leafIds.map((id) => [id, []]))
  const outgoing = new Map<TaskId, LeafEdge[]>(leafIds.map((id) => [id, []]))
  for (const dependency of dependencies) {
    for (const from of leavesOf(dependency.from)) {
      for (const to of leavesOf(dependency.to)) {
        const edge = { from, to, lag: dependency.lag }
        push(outgoing, from, edge)
        push(incoming, to, edge)
      }
    }
  }

  // Kahn's algorithm; ties keep the input order, so the result is deterministic.
  const remaining = new Map(leafIds.map((id) => [id, incoming.get(id)?.length ?? 0]))
  const queue = leafIds.filter((id) => remaining.get(id) === 0)
  const order: TaskId[] = []
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]
    if (id === undefined) break
    order.push(id)
    for (const edge of outgoing.get(id) ?? []) {
      const left = (remaining.get(edge.to) ?? 0) - 1
      remaining.set(edge.to, left)
      if (left === 0) queue.push(edge.to)
    }
  }

  if (order.length < leafIds.length) {
    const processed = new Set(order)
    const blocked = new Set(leafIds.filter((id) => !processed.has(id)))
    return err({ type: 'dependency-cycle', taskIds: findCycle(blocked, incoming) })
  }
  return ok({ order, incoming, outgoing, childrenOf })
}

/**
 * Every task Kahn's algorithm could not process still waits on a predecessor that was not
 * processed either. Walking those predecessors must therefore revisit a task, and the
 * walk between the two visits is a cycle.
 */
function findCycle(
  blocked: ReadonlySet<TaskId>,
  incoming: ReadonlyMap<TaskId, readonly LeafEdge[]>,
): TaskId[] {
  const path: TaskId[] = []
  const position = new Map<TaskId, number>()
  let current = blocked.values().next().value
  while (current !== undefined && !position.has(current)) {
    position.set(current, path.length)
    path.push(current)
    current = incoming.get(current)?.find((edge) => blocked.has(edge.from))?.from
  }
  const cycle = current === undefined ? path : path.slice(position.get(current))
  return cycle.reverse()
}
