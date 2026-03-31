import { HashRouter, Routes, Route } from 'react-router-dom'
import CalendarView from './pages/CalendarView'
import WorkoutPlayer from './pages/WorkoutPlayer'
import YogaPlayer from './pages/YogaPlayer'
import useSheets from './hooks/useSheets'

export default function App() {
  useSheets()

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<CalendarView />} />
        <Route path="/workout" element={<WorkoutPlayer />} />
        <Route path="/yoga" element={<YogaPlayer />} />
      </Routes>
    </HashRouter>
  )
}
