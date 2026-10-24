<script lang="ts">
  import { tick } from 'svelte'
  import { flip } from 'svelte/animate'
  import {
    addResource,
    assign,
    removeResource,
    unassign,
    updateResource,
  } from '../../app/edits/project-edits.ts'
  import type { ProjectSession } from '../../app/store/app-store.ts'
  import { formatRange } from '../format.ts'
  import Icon from '../icons/Icon.svelte'
  import { fade, fly, prefersReducedMotion, slide } from '../motion.ts'
  import { useApp } from '../shell/context.ts'
  import TypeChip from '../table/TypeChip.svelte'
  import Avatar from './Avatar.svelte'
  import { buildPeople, filterPeople, tasksOf } from './people.ts'
  import RoleDialog from './RoleDialog.svelte'

  let { session, onShowTask }: { session: ProjectSession; onShowTask: (taskId: string) => void } =
    $props()

  const { store } = useApp()

  let query = $state('')
  let selectedId: string | null = $state(null)
  let assigning = $state(false)
  let taskToAssign = $state('')
  let rolesOpen = $state(false)
  let nameInput: HTMLInputElement | undefined = $state()

  const project = $derived(session.project)
  const schedule = $derived(session.analysis.ok ? session.analysis.value.schedule.tasks : null)
  const people = $derived(buildPeople(project))
  const shown = $derived(filterPeople(people, query))
  const current = $derived(people.find((person) => person.id === selectedId) ?? people[0] ?? null)
  const assigned = $derived(current ? tasksOf(project, current.id, schedule) : [])
  const assignable = $derived.by(() => {
    const parents = new Set(project.tasks.map((task) => task.parentId))
    const taken = new Set(assigned.map((item) => item.task.id))
    return project.tasks.filter((task) => !parents.has(task.id) && !taken.has(task.id))
  })
  const flipDuration = prefersReducedMotion() ? 0 : 240

  async function addPerson(): Promise<void> {
    const id = store.getState().createId()
    if (
      store.getState().edit('Orang ditambahkan', addResource(id, 'Orang baru', null)) !== 'applied'
    )
      return
    selectedId = id
    query = ''
    await tick()
    nameInput?.focus()
    nameInput?.select()
  }

  function assignSelected(): void {
    if (!current || taskToAssign === '') return
    store
      .getState()
      .edit('Orang ditugaskan', assign(store.getState().createId(), taskToAssign, current.id))
    taskToAssign = ''
    assigning = false
  }

  function rangeOf(item: (typeof assigned)[number]): string {
    const start = item.dates?.start ?? item.task.start
    return formatRange(start, item.dates?.end ?? start)
  }
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
  <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
    <button type="button" class="btn" onclick={() => void addPerson()}>
      <Icon name="user-plus" />
      <span class="max-sm:sr-only">Orang</span>
    </button>
    <button type="button" class="btn" onclick={() => (rolesOpen = true)}>
      <Icon name="tag" />
      <span class="max-sm:sr-only">Kelola role</span>
    </button>
    <label
      class="press ml-auto flex h-9 w-[260px] max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-text-3 focus-within:border-accent-border focus-within:shadow-[0_0_0_3px_rgb(245_158_11/25%)] max-sm:ml-0 max-sm:w-full"
    >
      <Icon name="search" />
      <span class="sr-only">Cari orang</span>
      <input
        type="search"
        bind:value={query}
        placeholder="Cari nama atau role"
        class="h-full min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-text outline-none"
      />
    </label>
  </div>

  <div class="flex flex-1 flex-wrap">
    <section
      aria-label="Daftar orang"
      class="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-3 px-7 pt-6 pb-8 max-md:px-4 max-md:pt-4"
    >
      {#if people.length === 0}
        <div
          in:fade
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center"
        >
          <span
            class="pop flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text"
            ><Icon name="users" size={22} /></span
          >
          <p class="m-0 text-[15px] font-semibold">Belum ada orang di proyek ini</p>
          <p class="m-0 max-w-[340px] text-[13px] text-text-2">
            Tambahkan orang, beri mereka role, lalu tugaskan ke tugas di Gantt.
          </p>
          <button type="button" class="btn-primary mt-1" onclick={() => void addPerson()}
            ><Icon name="user-plus" /> Tambah orang</button
          >
        </div>
      {:else}
        <div class="@container overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div
            aria-hidden="true"
            class="person-grid hidden h-[42px] items-center gap-4 border-b border-line bg-surface-2 px-5 text-xs font-semibold text-text-2 @xl:grid"
          >
            <span>Nama</span><span>Role</span><span>Tugas</span><span></span>
          </div>
          {#if shown.length === 0}
            <p class="m-0 px-5 py-8 text-center text-[13px] text-text-2">
              Tidak ada orang yang cocok dengan “{query}”.
            </p>
          {/if}
          <ul class="m-0 list-none p-0">
            {#each shown as person, index (person.id)}
              {@const selected = person.id === current?.id}
              <li
                animate:flip={{ duration: flipDuration }}
                in:fly={{ y: 6 }}
                class="stagger border-b border-line last:border-b-0"
                style:--i={index}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onclick={() => {
                    selectedId = person.id
                    assigning = false
                  }}
                  class={[
                    'person-grid group grid min-h-[60px] w-full items-center gap-x-4 gap-y-1 px-5 py-2.5 text-left transition-colors duration-150',
                    selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
                  ]}
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <Avatar initials={person.initials} name={person.name} size={32} />
                    <span
                      class={['truncate text-sm', selected ? 'font-semibold' : 'font-medium']}
                      aria-hidden="true">{person.name}</span
                    >
                  </span>
                  <span class="flex min-w-0">
                    {#if person.roleName}
                      <span
                        class="inline-flex h-6 max-w-full items-center truncate rounded-full border border-line bg-surface-2 px-2.5 text-[12.5px] text-text-2"
                        >{person.roleName}</span
                      >
                    {:else}
                      <span class="text-[12.5px] text-text-3">Tanpa role</span>
                    {/if}
                  </span>
                  <span class="text-[13px] text-text-2">{person.taskCount} tugas</span>
                  <span
                    class="flex text-text-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text"
                    ><Icon name="chevron-right" /></span
                  >
                </button>
              </li>
            {/each}
          </ul>
        </div>
        <p class="m-0 pl-1 text-[13px] text-text-3">
          {people.length} orang · {project.roles.length} role di proyek ini
        </p>
      {/if}
    </section>

    {#if current}
      <aside
        aria-label="Detail orang"
        class="box-border flex min-w-0 flex-[1_1_360px] flex-col gap-[22px] border-l border-line bg-surface p-6 max-md:border-t max-md:border-l-0 max-md:p-4"
      >
        {#key current.id}
          <div in:fly={{ x: 12, duration: 260 }} class="flex flex-col gap-[22px]">
            <div class="flex items-center gap-3.5">
              <span class="pop flex"
                ><Avatar initials={current.initials} name={current.name} size={48} /></span
              >
              <div class="flex min-w-0 flex-col gap-0.5">
                <span class="truncate text-lg font-semibold tracking-[-0.01em]">{current.name}</span
                >
                <span class="text-[13px] text-text-3"
                  >{current.roleName ?? 'Tanpa role'} · {current.taskCount} tugas</span
                >
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="person-name" class="label">Nama</label>
              <input
                bind:this={nameInput}
                id="person-name"
                class="field"
                value={current.name}
                autocomplete="off"
                onchange={(event) => {
                  const name = event.currentTarget.value.trim()
                  if (name === '') event.currentTarget.value = current.name
                  else store.getState().edit('Nama diubah', updateResource(current.id, { name }))
                }}
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="person-role" class="label">Role</label>
              <div class="relative">
                <select
                  id="person-role"
                  class="field appearance-none pr-9"
                  value={current.roleId ?? ''}
                  onchange={(event) => {
                    const value = event.currentTarget.value
                    store
                      .getState()
                      .edit(
                        'Role diubah',
                        updateResource(current.id, { roleId: value === '' ? null : value }),
                      )
                  }}
                >
                  <option value="">Tanpa role</option>
                  {#each project.roles as role (role.id)}<option value={role.id}>{role.name}</option
                    >{/each}
                </select>
                <span
                  class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-3"
                  ><Icon name="chevron-down" strokeWidth={2} /></span
                >
              </div>
              <span class="text-xs text-text-3">
                Daftar role diatur lewat <button
                  type="button"
                  class="font-medium text-accent-text underline-offset-2 hover:underline"
                  onclick={() => (rolesOpen = true)}>Kelola role</button
                >.
              </span>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-baseline justify-between">
                <h2 class="m-0 text-[13px] font-semibold">Ditugaskan di</h2>
                <span class="text-xs text-text-3">{assigned.length} tugas</span>
              </div>
              {#if assigned.length > 0}
                <ul class="m-0 list-none overflow-hidden rounded-[10px] border border-line p-0">
                  {#each assigned as item (item.assignmentId)}
                    <li
                      transition:slide
                      animate:flip={{ duration: flipDuration }}
                      class="flex min-h-[52px] items-center gap-2.5 border-b border-line bg-surface py-1.5 pr-1.5 pl-3 last:border-b-0"
                    >
                      {#if item.task.type}<TypeChip type={item.task.type} />{/if}
                      <span class="flex min-w-0 flex-1 flex-col gap-px">
                        <span class="truncate text-[13px]">{item.task.name}</span>
                        <span class="mono text-[11.5px] text-text-3">{rangeOf(item)}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Lihat ${item.task.name} di Gantt`}
                        title="Lihat di Gantt"
                        class="btn-ghost size-8"
                        onclick={() => {
                          onShowTask(item.task.id)
                        }}
                      >
                        <Icon name="arrow-up-right" size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Lepas dari ${item.task.name}`}
                        title="Lepas dari tugas"
                        class="btn-ghost size-8 hover:text-danger"
                        onclick={() => {
                          store.getState().edit('Penugasan dilepas', unassign(item.assignmentId))
                        }}
                      >
                        <Icon name="x" size={15} strokeWidth={2} />
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}

              {#if assigning}
                <form
                  transition:slide
                  class="flex flex-col gap-2 rounded-[10px] border border-line bg-surface-2 p-3"
                  onsubmit={(event) => {
                    event.preventDefault()
                    assignSelected()
                  }}
                >
                  <label for="assign-task" class="label">Tugas</label>
                  {#if assignable.length === 0}
                    <p class="m-0 text-[13px] text-text-2">
                      Semua tugas sudah ditugaskan ke {current.name}.
                    </p>
                  {:else}
                    <select id="assign-task" class="field" bind:value={taskToAssign} required>
                      <option value="" disabled>Pilih tugas…</option>
                      {#each assignable as task (task.id)}<option value={task.id}
                          >{task.type ? `[${task.type}] ` : ''}{task.name}</option
                        >{/each}
                    </select>
                  {/if}
                  <div class="flex justify-end gap-2">
                    <button type="button" class="btn" onclick={() => (assigning = false)}
                      >Batal</button
                    >
                    <button type="submit" class="btn-primary" disabled={taskToAssign === ''}
                      >Tugaskan</button
                    >
                  </div>
                </form>
              {:else}
                <button
                  type="button"
                  class="press flex h-[38px] items-center justify-center gap-[7px] rounded-md border border-dashed border-line-strong text-[13px] font-medium text-text-2 hover:border-accent-border hover:bg-accent-soft hover:text-text"
                  onclick={() => (assigning = true)}
                >
                  <Icon name="plus" /> Tugaskan ke tugas
                </button>
              {/if}
            </div>

            <button
              type="button"
              class="btn-danger self-start"
              onclick={() => {
                store.getState().edit('Orang dihapus dari proyek', removeResource(current.id))
                selectedId = null
              }}
            >
              <Icon name="trash" /> Hapus dari proyek
            </button>
          </div>
        {/key}
      </aside>
    {/if}
  </div>
</div>

<RoleDialog open={rolesOpen} {project} onClose={() => (rolesOpen = false)} />

<style>
  .person-grid {
    grid-template-columns: minmax(0, 1fr) auto 20px;
    grid-template-areas:
      'name tasks chevron'
      'role role chevron';
  }
  .person-grid > :nth-child(1) {
    grid-area: name;
  }
  .person-grid > :nth-child(2) {
    grid-area: role;
    padding-left: 44px;
  }
  .person-grid > :nth-child(3) {
    grid-area: tasks;
  }
  .person-grid > :nth-child(4) {
    grid-area: chevron;
  }
  @container (min-width: 36rem) {
    .person-grid {
      grid-template-columns: minmax(200px, 2fr) minmax(140px, 1.4fr) 90px 20px;
      grid-template-areas: 'name role tasks chevron';
    }
    .person-grid > :nth-child(2) {
      padding-left: 0;
    }
  }
</style>
