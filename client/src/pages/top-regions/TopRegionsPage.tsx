import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { groupTopRegions, loadTopRegions } from '../../api/session'
import { MapBlock } from '../../components/top-regions/MapBlock'
import { TopRegionsList } from '../../components/top-regions/TopRegionsList'

export function TopRegionsPage() {
  const [searchParams] = useSearchParams()
  const regions = useMemo(() => groupTopRegions(loadTopRegions()), [])
  const regionNameParam = searchParams.get('region')
  const defaultIndex = Math.max(
    regions.findIndex((item) => item.regionName === regionNameParam),
    0,
  )
  const [activeRegionIndex, setActiveRegionIndex] = useState(defaultIndex)

  if (regions.length === 0) {
    return (
      <section className="top-page">
        <div className="container top-page__inner">
          <h1 className="top-page__title">Нет данных по регионам</h1>
          <p className="top-page__subtitle">Сначала заполните форму, чтобы получить ответ.</p>
          <Link className="top-card__link" to="/">
            Вернуться к форме
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="top-page">
      <div className="container top-page__inner">
        <h1 className="top-page__title">Подходящие регионы</h1>
        <MapBlock
          regions={regions}
          activeRegionIndex={activeRegionIndex}
          onSelectRegion={setActiveRegionIndex}
        />
        <TopRegionsList regions={regions} activeRegionIndex={activeRegionIndex} />
      </div>
    </section>
  )
}
