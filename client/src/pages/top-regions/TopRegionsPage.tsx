import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { rankRegions } from '../../api/api'
import { loadProjectInput } from '../../api/session'
import { MapBlock } from '../../components/top-regions/MapBlock'
import { TopRegionsList } from '../../components/top-regions/TopRegionsList'

export function TopRegionsPage() {
  const [searchParams] = useSearchParams()
  const input = useMemo(() => loadProjectInput(), [])
  const ranking = useMemo(() => rankRegions(input), [input])
  const initialRegion = searchParams.get('region')
  const defaultRegion = ranking.find((item) => item.region.id === initialRegion)?.region.id ?? ranking[0].region.id
  const [activeRegionId, setActiveRegionId] = useState(defaultRegion)

  return (
    <section className="top-page">
      <div className="container top-page__inner">
        <h1 className="top-page__title">ТОП-3 регионов с аналитикой</h1>
        <p className="top-page__subtitle">
          Рейтинг учитывает сырьевую логистику, социнфраструктуру, экономику, сети и культурный код.
        </p>
        <MapBlock
          ranking={ranking}
          activeRegionId={activeRegionId}
          onSelectRegion={setActiveRegionId}
        />
        <TopRegionsList ranking={ranking} activeRegionId={activeRegionId} />
      </div>
    </section>
  )
}
