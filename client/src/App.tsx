import { Navigate, Route, Routes } from 'react-router-dom'
import { FormPage } from './pages/form/FormPage'
import { RegionPage } from './pages/region/RegionPage'
import { TopRegionsPage } from './pages/top-regions/TopRegionsPage'

function App() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<FormPage />} />
          <Route path="/top-regions" element={<TopRegionsPage />} />
          <Route path="/region" element={<RegionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
