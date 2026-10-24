<script lang="ts">
  import type { TaskType } from '../../core/model.ts'
  import { TYPE_LABELS } from '../labels.ts'

  let { type }: { type: TaskType } = $props()
</script>

<span
  title={TYPE_LABELS[type]}
  class="mono inline-flex h-[18px] w-[34px] flex-none items-center justify-center rounded-sm text-[10.5px] font-semibold tracking-[0.02em]"
  style:background={`var(--chip-${type.toLowerCase()}-bg)`}
  style:color={`var(--chip-${type.toLowerCase()}-text)`}
>
  {type}<span class="sr-only">: {TYPE_LABELS[type]}</span>
</span>
