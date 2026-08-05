import { PresentationProvider } from './context/PresentationContext'
import { ToolsProvider } from './context/ToolsContext'
import { AppShell } from './components/layout/AppShell'

/**
 * Composition root — providers + shell only.
 */
function App() {
  return (
    <PresentationProvider>
      <ToolsProvider>
        <AppShell />
      </ToolsProvider>
    </PresentationProvider>
  )
}

export default App
