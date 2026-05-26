import { Link } from 'react-router-dom'

export function ProjectHeader() {
  return (
    <header className="project-header">
      <div className="container project-header__inner">
        <Link className="project-header__title" to="/">
          НАЗВАНИЕ ПРОЕКТА
        </Link>
      </div>
    </header>
  )
}
