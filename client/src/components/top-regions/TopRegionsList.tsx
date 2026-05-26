import { Link } from 'react-router-dom'
import type { RankingResult, RegionId } from '../../api/api'

interface TopRegionsListProps {
  ranking: RankingResult[]
  activeRegionId: RegionId
}

export function TopRegionsList({ ranking, activeRegionId }: TopRegionsListProps) {
  return (
    <section className="top-list" aria-label="Список топ регионов">
      <h2 className="top-list__title">ТОП 3 регионов</h2>
      <ul className="top-list__items">
        {ranking.map((item, index) => (
          <li
            className={`top-card ${item.region.id === activeRegionId ? 'top-card--active' : ''}`}
            key={item.region.id}
          >
            <img className="top-card__image" src={item.region.imageUrl} alt={item.region.title} />
            <div className="top-card__content">
              <p className="top-card__badge">#{index + 1} в рейтинге: {item.score}/100</p>
              <h3 className="top-card__title">{item.region.title}</h3>
              <p className="top-card__text">{item.region.shortDescription}</p>
              <ul className="top-card__metrics">
                <li className="top-card__metric">Логистика: {item.details.logistics}</li>
                <li className="top-card__metric">Соцфакторы: {item.details.social}</li>
                <li className="top-card__metric">Экономика: {item.details.economy}</li>
                <li className="top-card__metric">Сети: {item.details.network}</li>
                <li className="top-card__metric">Культурный код: {item.details.cultural}</li>
              </ul>
              <Link className="top-card__link" to={`/region?region=${item.region.id}`}>
                Подробнее
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
