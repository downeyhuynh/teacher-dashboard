import { PresentationProvider } from './context/PresentationContext'
import { ToolsProvider } from './context/ToolsContext'
import { SeatingProvider } from './context/SeatingContext'
import { AppShell } from './components/layout/AppShell'
import { AppNav } from './components/layout/AppNav'
import { HomeScreen } from './components/layout/HomeScreen'
import { ParentPortal } from './portal/ParentPortal'
import { useAppView } from './utils/appView'

/**
 * Home offers Teacher Dashboard and Progress Report.
 * The family report reads the published grade file.
 */
function App() {
  const view = useAppView()

  if (view === 'home') return <HomeScreen />
  if (view === 'portal') return <ParentPortal />

  return (
    <PresentationProvider>
      <ToolsProvider>
        <SeatingProvider>
          <div className="app-frame">
            <AppNav />
            <div className="app-frame__body">
              <AppShell />
            </div>
          </div>
        </SeatingProvider>
      </ToolsProvider>
    </PresentationProvider>
  )
}

export default App
