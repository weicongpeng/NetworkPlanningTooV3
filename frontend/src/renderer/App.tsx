import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/Layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { DataPage } from './pages/DataPage'
import { PCIPage } from './pages/PCIPage'
import { NeighborPage } from './pages/NeighborPage'
import { LicensePage } from './pages/LicensePage'
import { MapPage } from './pages/MapPage'

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/pci" element={<PCIPage />} />
          <Route path="/neighbor" element={<NeighborPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/license" element={<LicensePage />} />
        </Routes>
      </MainLayout>
    </Router>
  )
}

export default App
