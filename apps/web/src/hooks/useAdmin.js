import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { getMe } from '../api'

// status: 'loading' | 'anon'(로그인 안 함) | 'denied'(Google 로그인했지만 관리자 아님) | 'admin'
export function useAdmin() {
  const [state, setState] = useState({ status: 'loading', email: null })

  useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) setState({ status: 'anon', email: null })
        return
      }
      if (!cancelled) setState({ status: 'loading', email: user.email })
      try {
        await getMe()
        if (!cancelled) setState({ status: 'admin', email: user.email })
      } catch (e) {
        if (!cancelled) setState({ status: e.status === 403 ? 'denied' : 'anon', email: user.email })
      }
    })
    return () => { cancelled = true; unsub() }
  }, [])

  return state
}
