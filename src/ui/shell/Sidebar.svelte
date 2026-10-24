<script lang="ts">
  import { AREA_LABELS, AREA_ORDER } from '../labels.ts'
  import { useApp } from './context.ts'
  import Logo from './Logo.svelte'
  import ThemeSwitch from './ThemeSwitch.svelte'

  const { store, app } = useApp()

  const groups = $derived(
    AREA_ORDER.map((area) => ({
      area,
      projects: $app.projects.filter((project) => project.area === area),
    })).filter((group) => group.projects.length > 0),
  )
  const activeId = $derived($app.screen.kind === 'project' ? $app.current?.project.id : undefined)
</script>

<aside
  aria-label="Navigasi utama"
  class="flex w-58 flex-none flex-col gap-5 border-r border-line bg-sidebar px-3 py-4"
>
  <div class="flex items-center gap-2.5 px-1.5">
    <Logo />
    <span class="text-[17px] font-semibold">Rentang</span>
  </div>

  <nav aria-labelledby="projects-label" class="flex flex-col gap-0.5">
    <div class="flex items-center pb-1 pl-2.5">
      <h2 id="projects-label" class="flex-1 text-xs font-semibold text-text-2">Proyek</h2>
      <button
        type="button"
        aria-label="Buka atau impor proyek"
        onclick={() => {
          store.getState().showStart()
        }}
        class="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-bg"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
          class="stroke-text-2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
    {#each groups as group (group.area)}
      <h3 class="px-2.5 pt-2.5 pb-1 text-xs text-text-3">{AREA_LABELS[group.area]}</h3>
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        {#each group.projects as project (project.id)}
          <li>
            <button
              type="button"
              aria-current={project.id === activeId ? 'page' : undefined}
              onclick={() => {
                void store.getState().openProject(project.id)
              }}
              class={[
                'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left',
                project.id === activeId ? 'bg-selected font-semibold' : 'hover:bg-bg',
              ]}
            >
              <span class="min-w-0 flex-1 truncate">{project.name}</span>
              {#if project.lateCount > 0}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  role="img"
                  aria-label={`${String(project.lateCount)} tugas terlambat`}
                  class="flex-none"
                >
                  <path d="M7 1.2L13.2 12.6H0.8z" class="fill-late" />
                </svg>
              {/if}
              <span class="font-mono text-xs font-normal text-text-2">{project.progress}%</span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  </nav>

  <div class="flex-1"></div>
  <ThemeSwitch />
</aside>
