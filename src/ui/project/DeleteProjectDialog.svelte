<script lang="ts">
  import Dialog from '../dialog/Dialog.svelte'
  import Icon from '../icons/Icon.svelte'

  type Props = { open: boolean; name: string; onClose: () => void; onConfirm: () => void }
  let { open, name, onClose, onConfirm }: Props = $props()
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) onClose()
  }}
  title="Hapus proyek?"
  width={460}
>
  <p class="m-0 text-[13.5px] text-text-2">
    “{name}” akan dihapus dari browser ini beserta semua tugas dan dokumennya. Simpan ke berkas dulu
    bila masih perlu.
  </p>

  {#snippet footer()}
    <button type="button" class="btn h-10" onclick={onClose}>Batal</button>
    <button type="button" class="btn-danger h-10 border border-danger/40 px-4" onclick={onConfirm}>
      <Icon name="trash" /> Ya, hapus proyek
    </button>
  {/snippet}
</Dialog>
