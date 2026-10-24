<script lang="ts">
  import type { TaskStatus } from '../../core/summary.ts'
  import { STATUS_LABELS } from '../labels.ts'

  let { status }: { status: TaskStatus } = $props()
</script>

<svg
  width="14"
  height="14"
  viewBox="0 0 14 14"
  role="img"
  aria-label={STATUS_LABELS[status]}
  class="flex-none"
>
  {#if status === 'done'}
    <circle cx="7" cy="7" r="6" class="fill-text" />
    <path
      d="M4 7.2l2 2L10 5"
      fill="none"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="stroke-surface"
    />
  {:else if status === 'in-progress'}
    <circle cx="7" cy="7" r="5.5" fill="none" stroke-width="1.5" class="stroke-accent-text" />
    <path d="M7 1.5a5.5 5.5 0 0 1 0 11z" class="fill-accent-text" />
  {:else if status === 'late'}
    <path d="M7 1.2L13.2 12.6H0.8z" class="fill-late" />
    <path
      d="M7 5.4v3.2M7 10.4v.2"
      fill="none"
      stroke-width="1.5"
      stroke-linecap="round"
      class="stroke-surface"
    />
  {:else}
    <circle cx="7" cy="7" r="5.5" fill="none" stroke-width="1.5" class="stroke-text-3" />
  {/if}
</svg>
