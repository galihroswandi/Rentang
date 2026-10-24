<script lang="ts">
  import { applyTheme, readTheme, type ThemeChoice } from './theme.ts'

  const choices: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: 'Sistem' },
    { value: 'light', label: 'Terang' },
    { value: 'dark', label: 'Gelap' },
  ]
  let current = $state(readTheme())

  function choose(value: ThemeChoice): void {
    current = value
    applyTheme(value)
  }
</script>

<div class="flex flex-col gap-1 px-2">
  <span id="theme-label" class="text-xs font-semibold text-text-2">Tema</span>
  <div
    role="group"
    aria-labelledby="theme-label"
    class="flex gap-0.5 rounded-lg border border-line bg-bg p-0.5"
  >
    {#each choices as choice (choice.value)}
      <button
        type="button"
        aria-pressed={current === choice.value}
        onclick={() => {
          choose(choice.value)
        }}
        class={[
          'h-10 flex-1 cursor-pointer rounded-md px-2 text-sm',
          current === choice.value
            ? 'border border-line bg-surface font-semibold text-text'
            : 'border border-transparent text-text-2',
        ]}
      >
        {choice.label}
      </button>
    {/each}
  </div>
</div>
