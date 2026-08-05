import {
  AnnotateIcon,
  CalculatorIcon,
  StudentsIcon,
  TimerIcon,
} from '../components/ui/icons'
import { PANEL_IDS } from '../utils/panelDefaults'
import { AnnotatePanel } from './AnnotatePanel'
import { CalculatorPanel } from './CalculatorPanel'
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
]

export const PANEL_REGISTRY_BY_ID = Object.fromEntries(
  PANEL_REGISTRY.map((entry) => [entry.id, entry]),
)

export const REGISTERED_PANEL_IDS = PANEL_REGISTRY.map((entry) => entry.id)
