import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Victim from './pages/Victim'
import Volunteer from './pages/Volunteer'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/victim" element={<Victim />} />
        <Route path="/volunteer" element={<Volunteer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App