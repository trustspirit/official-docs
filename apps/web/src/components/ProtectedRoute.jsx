import { Navigate } from 'react-router-dom'
import { getToken } from '../api'

export default function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />
  return children
}
