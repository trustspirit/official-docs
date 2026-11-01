import { Button } from 'trust-ui-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../../firebase'
import { useAdmin } from '../../hooks/useAdmin'
import GoogleSignInButton from '../../components/GoogleSignInButton'

export default function Login() {
  const navigate = useNavigate()
  const { status, email } = useAdmin()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 이미 관리자로 로그인되어 있으면 바로 이동
  useEffect(() => {
    if (status === 'admin') navigate('/admin', { replace: true })
  }, [status, navigate])

  const denied = status === 'denied'

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      // 관리자 여부는 useAdmin 이 서버(/api/auth/me)로 확인해 status 로 반영
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">관리자 로그인</h1>
        <p className="login-sub">지역칠십인 공문 시스템</p>

        {error && <div className="alert alert-error">{error}</div>}
        {denied && (
          <div className="alert alert-error">
            {email} 계정은 관리자 권한이 없습니다. 허용된 Google 계정으로 다시 로그인해 주세요.
            <div style={{ marginTop: '0.6rem' }}>
              <Button variant="outline" size="sm" onClick={() => signOut(auth)}>다른 계정으로 로그인</Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleSignInButton onClick={handleGoogle} disabled={loading || status === 'loading'} />
        </div>
      </div>
    </div>
  )
}
