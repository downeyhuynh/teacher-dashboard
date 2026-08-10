import {
  AnnotateIcon,
  AttendanceIcon,
  BathroomIcon,
  CalculatorIcon,
  NoiseIcon,
  SeatingIcon,
  StudentsIcon,
  TimerIcon,
} from '../components/ui/icons'
import { PANEL_IDS } from '../utils/panelDefaults'
import { AnnotatePanel } from './AnnotatePanel'
import { AttendancePanel } from './AttendancePanel'
import { BathroomPanel } from './BathroomPanel'
import { CalculatorPanel } from './CalculatorPanel'
import { NoiseLevelPanel } from './NoiseLevelPanel'
import { SeatingChartPanel } from './SeatingChartPanel'
import { StudentPickerPanel } from './StudentPickerPanel'
import { TimerPanel } from './TimerPanel'

/**
 * Single source of truth for tool metadata and panel content.
 * Adding a tool later: register here + add a panel component.
 */
export const PANEL_REGISTRY = [
  {
    id: PANEL_IDS.TIMER,
    label: 'Timer',
    Icon: TimerIcon,
    Component: TimerPanel,
  },
  {
    id: PANEL_IDS.ANNOTATE,
    label: 'Annotate',
    Icon: AnnotateIcon,
    Component: AnnotatePanel,
  },
  {
    id: PANEL_IDS.CALCULATOR,
    label: 'Calculator',
    Icon: CalculatorIcon,
    Component: CalculatorPanel,
  },
  {
    id: PANEL_IDS.STUDENTS,
    label: 'Students',
    Icon: StudentsIcon,
    Component: StudentPickerPanel,
  },
  {
    id: PANEL_IDS.SEATING,
    label: 'Seating',
    Icon: SeatingIcon,
    Component: SeatingChartPanel,
    dock: 'quick',
  },
  {
    id: PANEL_IDS.ATTENDANCE,
    label: 'Attendance',
    Icon: AttendanceIcon,
    Component: AttendancePanel,
    dock: 'quick',
  },
  {
    id: PANEL_IDS.NOISE,
    label: 'Noise',
    Icon: NoiseIcon,
    Component: NoiseLevelPanel,
    dock: 'quick',
    compact: true,
    hideMinimize: true,
    corner: 'top-right',
  },
  {
    id: PANEL_IDS.BATHROOM,
    label: 'Bathroom',
    Icon: BathroomIcon,
    Component: BathroomPanel,
    dock: 'quick',
    compact: true,
    hideMinimize: true,
    corner: 'bottom-right',
  },
]

export const PANEL_REGISTRY_BY_ID = Object.fromEntries(
  PANEL_REGISTRY.map((entry) => [entry.id, entry]),
)

export const REGISTERED_PANEL_IDS = PANEL_REGISTRY.map((entry) => entry.id)

export const MAIN_TOOLBAR_TOOLS = PANEL_REGISTRY.filter(
  (entry) => entry.dock !== 'quick',
)

export const QUICK_TOOLBAR_TOOLS = PANEL_REGISTRY.filter(
  (entry) => entry.dock === 'quick',
)
