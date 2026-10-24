<script lang="ts" module>
  // The Lucide icons the design canvas uses, under the names the components ask for.
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'
  import CalendarCheck from '@lucide/svelte/icons/calendar-check'
  import ChartGantt from '@lucide/svelte/icons/chart-gantt'
  import Check from '@lucide/svelte/icons/check'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Clock from '@lucide/svelte/icons/clock'
  import CloudAlert from '@lucide/svelte/icons/cloud-alert'
  import CloudCheck from '@lucide/svelte/icons/cloud-check'
  import Columns3 from '@lucide/svelte/icons/columns-3'
  import Diamond from '@lucide/svelte/icons/diamond'
  import File from '@lucide/svelte/icons/file'
  import FileInput from '@lucide/svelte/icons/file-input'
  import Flag from '@lucide/svelte/icons/flag'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import GripVertical from '@lucide/svelte/icons/grip-vertical'
  import LayoutGrid from '@lucide/svelte/icons/layout-grid'
  import LayoutList from '@lucide/svelte/icons/layout-list'
  import Moon from '@lucide/svelte/icons/moon'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Plus from '@lucide/svelte/icons/plus'
  import Redo2 from '@lucide/svelte/icons/redo-2'
  import Route from '@lucide/svelte/icons/route'
  import Search from '@lucide/svelte/icons/search'
  import Sparkles from '@lucide/svelte/icons/sparkles'
  import Sun from '@lucide/svelte/icons/sun'
  import Table from '@lucide/svelte/icons/table'
  import Tag from '@lucide/svelte/icons/tag'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import Undo2 from '@lucide/svelte/icons/undo-2'
  import Upload from '@lucide/svelte/icons/upload'
  import UserPlus from '@lucide/svelte/icons/user-plus'
  import Users from '@lucide/svelte/icons/users'
  import X from '@lucide/svelte/icons/x'
  import ZoomIn from '@lucide/svelte/icons/zoom-in'
  import ZoomOut from '@lucide/svelte/icons/zoom-out'

  const ICONS = {
    'arrow-up-right': ArrowUpRight,
    'calendar-check': CalendarCheck,
    gantt: ChartGantt,
    check: Check,
    'chevron-down': ChevronDown,
    'chevron-right': ChevronRight,
    clock: Clock,
    'cloud-alert': CloudAlert,
    'cloud-check': CloudCheck,
    columns: Columns3,
    diamond: Diamond,
    file: File,
    'file-import': FileInput,
    flag: Flag,
    'folder-open': FolderOpen,
    grip: GripVertical,
    cards: LayoutGrid,
    'layout-list': LayoutList,
    moon: Moon,
    pencil: Pencil,
    plus: Plus,
    redo: Redo2,
    route: Route,
    search: Search,
    sparkles: Sparkles,
    sun: Sun,
    table: Table,
    tag: Tag,
    trash: Trash2,
    alert: TriangleAlert,
    undo: Undo2,
    upload: Upload,
    'user-plus': UserPlus,
    users: Users,
    x: X,
    'zoom-in': ZoomIn,
    'zoom-out': ZoomOut,
  } as const

  export type IconName = keyof typeof ICONS
</script>

<script lang="ts">
  type Props = { name: IconName; size?: number; strokeWidth?: number; class?: string }
  let { name, size = 16, strokeWidth = 1.75, class: className = '' }: Props = $props()

  const Component = $derived(ICONS[name])
</script>

<!-- Lucide marks icons aria-hidden; the button or text beside each one carries its meaning. -->
<Component {size} {strokeWidth} class={['flex-none', className]} />
