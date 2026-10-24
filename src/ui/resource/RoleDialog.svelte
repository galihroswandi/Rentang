<script lang="ts">
  import { flip } from 'svelte/animate'
  import { addRole, removeRole, renameRole } from '../../app/edits/project-edits.ts'
  import type { Project } from '../../core/model.ts'
  import Dialog from '../dialog/Dialog.svelte'
  import Icon from '../icons/Icon.svelte'
  import { prefersReducedMotion, slide } from '../motion.ts'
  import { useApp } from '../shell/context.ts'

  let { open, project, onClose }: { open: boolean; project: Project; onClose: () => void } =
    $props()

  const { store } = useApp()
  let newRole = $state('')
  let newInput: HTMLInputElement | undefined = $state()

  const usage = $derived(
    new Map(
      project.roles.map((role) => [
        role.id,
        project.resources.filter((person) => person.roleId === role.id).length,
      ]),
    ),
  )

  function add(event: SubmitEvent): void {
    event.preventDefault()
    const name = newRole.trim()
    if (name === '') return
    store.getState().edit('Role ditambahkan', addRole(store.getState().createId(), name))
    newRole = ''
    newInput?.focus()
  }
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) onClose()
  }}
  title="Kelola role"
  width={460}
  initialFocus={() => newInput}
>
  {#snippet description()}Role adalah pilihan per proyek, misalnya Barista atau Desainer.{/snippet}

  <form class="mb-4 flex gap-2" onsubmit={add}>
    <label for="new-role" class="sr-only">Nama role baru</label>
    <input
      bind:this={newInput}
      id="new-role"
      class="field flex-1"
      bind:value={newRole}
      placeholder="Role baru"
      autocomplete="off"
    />
    <button type="submit" class="btn-primary h-[38px]" disabled={newRole.trim() === ''}>
      <Icon name="plus" strokeWidth={2} /> Tambah
    </button>
  </form>

  {#if project.roles.length === 0}
    <p
      class="m-0 rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-text-2"
    >
      Belum ada role di proyek ini.
    </p>
  {:else}
    <ul class="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-line p-0">
      {#each project.roles as role (role.id)}
        <li
          animate:flip={{ duration: prefersReducedMotion() ? 0 : 220 }}
          transition:slide
          class="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 last:border-b-0"
        >
          <label for={`role-${role.id}`} class="sr-only">Nama role</label>
          <input
            id={`role-${role.id}`}
            class="field h-9 flex-1"
            value={role.name}
            onchange={(event) => {
              const name = event.currentTarget.value.trim()
              if (name === '') event.currentTarget.value = role.name
              else store.getState().edit('Role diganti nama', renameRole(role.id, name))
            }}
          />
          <span class="w-16 text-right text-xs whitespace-nowrap text-text-3"
            >{usage.get(role.id) ?? 0} orang</span
          >
          <button
            type="button"
            aria-label={`Hapus role ${role.name}`}
            title="Hapus role"
            class="btn-ghost size-9 hover:text-danger"
            onclick={() => {
              store.getState().edit('Role dihapus', removeRole(role.id))
            }}
          >
            <Icon name="trash" />
          </button>
        </li>
      {/each}
    </ul>
    <p class="mt-2 mb-0 text-xs text-text-3">
      Menghapus role tidak menghapus orangnya; mereka menjadi tanpa role.
    </p>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn-primary h-10 px-4" onclick={onClose}>Selesai</button>
  {/snippet}
</Dialog>
