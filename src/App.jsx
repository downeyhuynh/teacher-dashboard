import { PresentationProvider } from './context/PresentationContext'
import { ToolsProvider } from './context/ToolsContext'
import { SeatingProvider } from './context/SeatingContext'
import { AppShell } from './components/layout/AppShell'

/**
 * Composition root — providers + shell only.
 */
function App() {
  return (
    <PresentationProvider>
      <ToolsProvider>
        <SeatingProvider>
          <AppShell />
        </SeatingProvider>
      </ToolsProvider>
    </PresentationProvider>
  )
}

export default App
