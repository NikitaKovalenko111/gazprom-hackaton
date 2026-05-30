import { Link } from 'react-router-dom'
import type { RegionGroup } from '../../api/session'

const armModules = import.meta.glob('../../assets/arms/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const armFileByRegion: Record<string, string> = {
  'Краснодарский край': 'krasnodar',
  'Республика Башкортостан': 'bashkortostan',
  'Архангельская область': 'arhangelsk',
  'Новосибирская область': 'novosibirsk',
  'Свердловская область': 'sverdlovskaya',
}

const getRegionArmSrc = (regionName: string) => {
  const fileBase = armFileByRegion[regionName]

  if (!fileBase) {
    return null
  }

  const match = Object.entries(armModules).find(([path]) => {
    const fileName = path.split('/').pop()?.toLowerCase() ?? ''
    return fileName.startsWith(`${fileBase}.`)
  })

  return match?.[1] ?? null
}

interface TopRegionsListProps {
  regions: RegionGroup[]
  activeRegionIndex: number
}

export function TopRegionsList({ regions, activeRegionIndex }: TopRegionsListProps) {
  return (
    <section className="top-list" aria-label="Список топ регионов">
      <h2 className="top-list__title">Список регионов</h2>
      <ul className="top-list__items">
        {regions.map((item, index) => {
          const armSrc = getRegionArmSrc(item.regionName)

          return (
            <li
              className={`top-card ${index === activeRegionIndex ? 'top-card--active' : ''}`}
              key={item.regionName}
            >
              <div className="top-card__media">
                <img className="top-card__image" src={armSrc ?? `data:image/svg+xml;utf8,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
                  <defs>
                    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stop-color="#1d4ed8" />
                      <stop offset="55%" stop-color="#60a5fa" />
                      <stop offset="100%" stop-color="#e2e8f0" />
                    </linearGradient>
                  </defs>
                  <rect width="640" height="420" rx="32" fill="url(#g)" />
                  <circle cx="510" cy="100" r="66" fill="rgba(255,255,255,0.25)" />
                  <path d="M0 330 C120 300 180 350 290 320 C400 290 490 240 640 300 L640 420 L0 420 Z" fill="rgba(255,255,255,0.26)" />
                  <path d="M96 268 L180 188 L274 240 L350 146 L474 214 L544 168 L544 370 L96 370 Z" fill="rgba(255,255,255,0.38)" />
                  <text x="48" y="86" font-family="Segoe UI, Arial" font-size="28" font-weight="700" fill="#ffffff">GAZPROM</text>
                  <text x="48" y="124" font-family="Segoe UI, Arial" font-size="20" fill="#e0f2fe">API region preview</text>
                  <text x="48" y="356" font-family="Segoe UI, Arial" font-size="16" fill="#ffffff">{item.region_name}</text>
                </svg>
              `)}`} alt={item.regionName} />
                <div className="top-card__media-overlay">
                  <span className="top-card__badge">#{index + 1} в рейтинге</span>
                  <span className="top-card__place">{item.summary.place_address}</span>
                </div>
              </div>

              <div className="top-card__content">
                <h3 className="top-card__title">{item.regionName}</h3>
                <p className="top-card__text">Лучший участок: {item.summary.place_address}</p>
                <p className="top-card__text">Региональный score: {item.summary.score.toFixed(3)}</p>
                <p className="top-card__text">Площадок в регионе: {item.places.length}</p>
                <ul className="top-card__metrics">
                  <li className="top-card__metric">Логистика: {item.summary.breakdown.logistics.toFixed(3)}</li>
                  <li className="top-card__metric">Энергия: {item.summary.breakdown.energy.toFixed(3)}</li>
                  <li className="top-card__metric">Кадры: {item.summary.breakdown.labor.toFixed(3)}</li>
                  <li className="top-card__metric">Соцфакторы: {item.summary.breakdown.social.toFixed(3)}</li>
                  <li className="top-card__metric">Экономика: {item.summary.breakdown.economy.toFixed(3)}</li>
                </ul>
                <Link className="top-card__link" to={`/region?region=${encodeURIComponent(item.regionName)}`}>
                  Подробнее
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
