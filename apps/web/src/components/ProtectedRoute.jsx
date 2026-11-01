import { Navigate } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'

export default function ProtectedRoute({ children }) {
  const { status } = useAdmin()
  if (status === 'loading') {
    return <div className="loading-overlay" style={{ minHeight: '100vh' }}><span className="spinner" /></div>
  }
  if (status !== 'admin') return <Navigate to="/admin/login" replace />
  return children
}
