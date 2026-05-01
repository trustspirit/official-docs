import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Document from './pages/Document'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import Create from './pages/admin/Create'
import Edit from './pages/admin/Edit'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/doc/:slug" element={<Document />} />

        {/* Admin */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
        <Route path="/admin/edit/:id" element={<ProtectedRoute><Edit /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
