import { Link } from 'react-router-dom'

export default function SiteLayout({ children }) {
  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="site-header__title">지역칠십인 공문</span>
        <nav className="site-header__nav">
          <Link to="/">공문 목록</Link>
        </nav>
      </header>
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        © 지역칠십인
      </footer>
    </div>
  )
}
