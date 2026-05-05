import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TabBar from './components/layout/TabBar'
import { PageSpinner } from './components/ui/Spinner'

import Auth           from './pages/Auth'
import Home           from './pages/Home'
import Templates      from './pages/Templates'
import ActiveWorkout  from './pages/ActiveWorkout'
import ExerciseLibrary from './pages/ExerciseLibrary'
import ExerciseDetail from './pages/ExerciseDetail'
import Progress       from './pages/Progress'
import Calendar       from './pages/Calendar'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <PageSpinner />

  if (!session) {
    return (
      <div className="flex-1 overflow-hidden">
        <Auth />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main scrollable content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/"                   element={<Home />} />
          <Route path="/templates"          element={<Templates />} />
          <Route path="/workout/new"        element={<ActiveWorkout />} />
          <Route path="/workout/:id"        element={<ActiveWorkout />} />
          <Route path="/exercises"          element={<ExerciseLibrary />} />
          <Route path="/exercises/:id"      element={<ExerciseDetail />} />
          <Route path="/progress"           element={<Progress />} />
          <Route path="/calendar"           element={<Calendar />} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </div>
  )
}
