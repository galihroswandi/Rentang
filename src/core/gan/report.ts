/**
 * What a .gan import kept, changed and skipped. Entries are structured codes so that the
 * UI can phrase them; core holds no user-facing text.
 */
import type { TaskId } from '../model.ts'

export type DependencyKind = 'start-to-start' | 'finish-to-finish' | 'start-to-finish' | 'unknown'

export type ImportChange =
  /** Rentang only supports finish-to-start; the dependency was converted. */
  | {
      readonly code: 'dependency-type-converted'
      readonly from: TaskId
      readonly to: TaskId
      readonly original: DependencyKind
    }
  | {
      readonly code: 'milestone-duration-reset'
      readonly taskId: TaskId
      readonly originalDuration: number
    }
  | { readonly code: 'zero-duration-raised'; readonly taskId: TaskId }
  | { readonly code: 'progress-adjusted'; readonly taskId: TaskId; readonly original: string }
  | {
      readonly code: 'lag-reset'
      readonly from: TaskId
      readonly to: TaskId
      readonly original: string
    }
  | { readonly code: 'default-work-week' }

export type ImportSkip =
  | { readonly code: 'baseline'; readonly name: string }
  | { readonly code: 'custom-property'; readonly name: string }
  | {
      readonly code: 'recurring-holiday'
      readonly month: string
      readonly day: string
      readonly name: string
    }
  | {
      readonly code: 'invalid-holiday'
      readonly year: string
      readonly month: string
      readonly day: string
    }
  | { readonly code: 'unsupported-calendar-day'; readonly type: string }
  | {
      readonly code: 'invalid-task'
      readonly taskId: TaskId
      readonly reason: 'invalid-start' | 'invalid-duration' | 'duplicate-id' | 'parent-skipped'
    }
  | { readonly code: 'invalid-link'; readonly taskId: TaskId }
  | { readonly code: 'dangling-dependency'; readonly from: TaskId; readonly to: TaskId }
  | { readonly code: 'duplicate-dependency'; readonly from: TaskId; readonly to: TaskId }
  | { readonly code: 'self-dependency'; readonly taskId: TaskId }
  | { readonly code: 'dangling-assignment'; readonly taskId: string; readonly resourceId: string }

export type ImportReport = {
  readonly imported: {
    readonly tasks: number
    readonly dependencies: number
    readonly resources: number
    readonly assignments: number
    readonly holidays: number
  }
  readonly changed: readonly ImportChange[]
  readonly skipped: readonly ImportSkip[]
}
