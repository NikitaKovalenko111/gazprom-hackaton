import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { rankRegions } from '../../api/api'
import { loadProjectInput } from '../../api/session'
import { RegionResources } from '../../components/region/RegionResources'

export function RegionPage() {
  const [searchParams] = useSearchParams()
  const regionId = searchParams.get('region')

  const input = useMemo(() => loadProjectInput(), [])
  const ranking = useMemo(() => rankRegions(input), [input])
  const activeRanking = ranking.find((item) => item.region.id === regionId) ?? ranking[0]

  return (
    <section className="region-page">
      <div className="container region-page__inner">
        <RegionResources input={input} ranking={activeRanking} region={activeRanking.region} />
      </div>
    </section>
  )
}
