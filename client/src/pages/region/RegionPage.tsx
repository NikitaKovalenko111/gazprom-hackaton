import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import {
  requestLLMRecommendation,
  requestLLMPresentation,
  type LLMResponse,
  type PlaceRecord,
} from '../../api/gateway'
import { groupTopRegions, loadTopRegions } from '../../api/session'
import { RegionBoundariesLayer } from '../../components/map/RegionBoundariesLayer'
import { getRegionRenderAssets, getRegionRenderType, getRegionRenderTypeLabel } from '../../data/renders'
import ThreeViewer from '../../components/region/ThreeViewer'
import { loadProjectInput } from '../../api/session'

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)

const formatRubOptional = (value: number | null | undefined) => (value == null ? 'нет данных' : formatRub(value))

const formatKmOptional = (value: number | null | undefined) => (value == null ? 'нет данных' : `${value} км`)

const formatInsulationName = (value?: string) => {
  const normalized = value?.toUpperCase()

  switch (normalized) {
    case 'PPU':
      return 'ППУ'
    case 'MINVATA':
      return 'Минвата'
    case 'PPS':
      return 'ППС'
    default:
      return 'нет данных'
  }
}

const formatListValue = (value?: string | string[] | null) => {
  if (!value) {
    return 'не указано'
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(' · ') : 'не указано'
  }

  return value
}

const formatDealStructure = (value?: string[]) => formatListValue(value)

const formatTopFactor = (value?: string) => {
  switch (value) {
    case 'economy':
      return 'Экономика'
    case 'logistics':
      return 'Логистика'
    case 'labor':
      return 'Кадры'
    case 'social':
      return 'Социальная среда'
    case 'energy':
      return 'Энергетика'
    case 'rental':
      return 'Аренда'
    default:
      return value ?? 'нет данных'
  }
}

const formatBenefitsLabel = (value?: string[] | null) => {
  if (!value) {
    return 'без льгот'
  }

  const normalized = value.map((item) => {
    const lower = item.toLowerCase()

    if (lower.includes('special_economic_zone') || lower.includes('special economic zone') || lower.includes('оэз')) {
      return 'ОЭЗ'
    }

    if (lower.includes('advanced development area') || lower.includes('tor') || lower.includes('тосэр')) {
      return 'ТОР'
    }

    if (lower.includes('arctic zone')) {
      return 'Арктическая зона'
    }

    return item
  })

  return normalized.length > 0 ? normalized.join(' · ') : 'без льгот'
}

const formatMlnRub = (value: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} млн руб`

const formatEstimateBreakdown = (estimate: PlaceRecord['estimate']) => [
  ['Производственный цех', estimate.detailed_costs_rub['Производственный цех']],
  ['Склад готовой продукции', estimate.detailed_costs_rub['Склад готовой продукции']],
  ['АБК (офисный блок)', estimate.detailed_costs_rub['АБК (офисный блок)']],
  ['Жилье (общежитие/квартиры)', estimate.detailed_costs_rub['Жилье (общежитие/квартиры)']],
  ['Детский сад', estimate.detailed_costs_rub['Детский сад']],
  ['Столовая', estimate.detailed_costs_rub['Столовая']],
  ['Медпункт', estimate.detailed_costs_rub['Медпункт']],
  ['Дороги и парковки', estimate.detailed_costs_rub['Дороги и парковки']],
  ['Благоустройство территории', estimate.detailed_costs_rub['Благоустройство территории']],
  ['Спортивные объекты', estimate.detailed_costs_rub['Спортивные объекты']],
  ['Технологическое присоединение к сетям', estimate.detailed_costs_rub['Технологическое присоединение к сетям']],
]
  .filter(([, value]) => typeof value === 'number')
  .map(([label, value]) => ({ label, value: formatRub(value as number) }))

const formatWholeNumber = (value: number | string) => Math.round(Number(value) || 0).toString()

const MapContainerAny = MapContainer as unknown as (props: any) => ReactElement
const TileLayerAny = TileLayer as unknown as (props: any) => ReactElement
const CircleMarkerAny = CircleMarker as unknown as (props: any) => ReactElement

type RegionTabKey = 'overview' | 'economy' | 'social' | 'culture' | 'sites'

const REGION_TABS: Array<{ key: RegionTabKey; label: string }> = [
  { key: 'overview', label: 'Обзор' },
  { key: 'economy', label: 'Экономика' },
  { key: 'social', label: 'Социальная среда' },
  { key: 'culture', label: 'Культурный код' },
  { key: 'sites', label: 'Площадки' },
]

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const getIndicatorTone = (percent: number) => {
  if (percent >= 75) {
    return 'excellent'
  }

  if (percent >= 50) {
    return 'medium'
  }

  return 'attention'
}

const getIndicatorLabel = (percent: number) => {
  if (percent >= 75) {
    return 'Отлично'
  }

  if (percent >= 50) {
    return 'Средне'
  }

  return 'Требует внимания'
}

const getPlaceColor = (score: number, isPrimary: boolean) => {
  if (isPrimary) {
    return '#1d4ed8'
  }

  if (score >= 0.65) {
    return '#20a561'
  }

  if (score >= 0.62) {
    return '#2d6fe2'
  }

  return '#d97706'
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const resolveRenderAssetUrl = (src: string) => {
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }

  return new URL(src, window.location.origin).href
}

const buildRenderGalleryHtml = (renders: Array<{ src: string; title: string; viewIndex: number; type: string }>) => {
  if (renders.length === 0) {
    return ''
  }

  return `
    <div class="region-render-grid">
      ${renders
        .map(
          (render) => `
            <figure class="region-render-card">
              <img
                alt="${escapeHtml(render.title)}"
                class="region-render-image"
                src="${resolveRenderAssetUrl(render.src)}"
              />
            </figure>
          `,
        )
        .join('')}
    </div>
  `
}

const injectRenderGalleryIntoPresentation = (
  html: string,
  renders: Array<{ src: string; title: string; viewIndex: number; type: string }>,
) => {
  if (!html || renders.length === 0) {
    return html
  }

  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(`<div id="presentation-root">${html}</div>`, 'text/html')
  const root = parsedDocument.getElementById('presentation-root')

  if (!root) {
    return html
  }

  const galleryHtml = buildRenderGalleryHtml(renders)
  const gridBlock = root.querySelector('.grid-2x2')

  if (gridBlock) {
    gridBlock.outerHTML = galleryHtml
    return root.innerHTML
  }

  const renderSlide = Array.from(root.querySelectorAll('.slide')).find((slide) => {
    const text = slide.textContent ?? ''
    return /рендер/i.test(text) || slide.querySelector('.render-box') !== null
  })

  const slideContent = renderSlide?.querySelector('.slide-content')
  if (slideContent) {
    slideContent.insertAdjacentHTML('beforeend', galleryHtml)
  }

  return root.innerHTML
}

const buildHtmlModuleDoc = (html: string, title = 'HTML module') => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <style>
      :root {
        color-scheme: light;
      }

      body {
        margin: 0;
        padding: 14px;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 14px;
        line-height: 1.45;
        color: #0f172a;
        background: #ffffff;
      }

      h1, h2, h3, h4 {
        margin: 0 0 10px;
      }

      p, ul, ol {
        margin: 0 0 10px;
      }

      .region-render-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        width: 100%;
      }

      .region-render-card {
        margin: 0;
        overflow: hidden;
        border-radius: 12px;
        border: 1px solid #dbe4ee;
        background: #fff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        display: block;
      }

      .region-render-image {
        display: block;
        width: 100%;
        height: auto;
        object-fit: contain;
        background: #f1f5f9;
      }

      .region-render-grid .region-render-card,
      .region-render-grid .region-render-card * {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`

const buildPrintableModuleDoc = (title: string, html: string) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }

      :root {
        color-scheme: light;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      body {
        padding: 14px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .region-render-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        width: 100%;
        margin-top: 10px;
      }

      .region-render-card {
        margin: 0;
        display: flex;
        flex-direction: column;
        min-width: 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .region-render-image {
        display: block;
        width: 100%;
        height: 52mm;
        object-fit: contain;
        background: #f1f5f9;
      }

      img {
        max-width: 100%;
      }

      * {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`

const saveHtmlAsPdf = (title: string, html: string) => {
  const printWindow = window.open('', '_blank', 'width=1280,height=900')

  if (!printWindow) {
    throw new Error('Не удалось открыть окно печати. Проверьте блокировщик всплывающих окон.')
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintableModuleDoc(title, html))
  printWindow.document.close()
  printWindow.focus()

  window.setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 250)
}

function RegionPlacesMap({ regionName, places }: { regionName: string; places: PlaceRecord[] }) {
  const firstPlace = places[0]

  if (!firstPlace) {
    return null
  }

  const [infraMarkers, setInfraMarkers] = useState<Array<any>>([])

  const createDivIcon = (emoji: string, bg = '#ffffff') => {
    return L.divIcon({
      className: 'infra-div-icon',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:${bg};font-size:18px">${emoji}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    })
  }

  const buildYandexMapsUrl = (place: PlaceRecord) => {
    const latitude = place.place_lat
    const longitude = place.place_lon

    return `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16&l=map`
  }

  const showInfraForPlace = (place: PlaceRecord) => {
    const markers: Array<any> = []
    const infra = (place.infrastructure as any) || {}

    if (place.nearest_metallurgical_factory && place.nearest_metallurgical_factory.lat && place.nearest_metallurgical_factory.lon) {
      markers.push({
        lat: place.nearest_metallurgical_factory.lat,
        lon: place.nearest_metallurgical_factory.lon,
        type: 'metallurgical',
        label: place.nearest_metallurgical_factory.company,
        icon: createDivIcon('🏭', '#ffdede'),
      })
    }

    if (place.nearest_insulation_factory && place.nearest_insulation_factory.lat && place.nearest_insulation_factory.lon) {
      markers.push({
        lat: place.nearest_insulation_factory.lat,
        lon: place.nearest_insulation_factory.lon,
        type: 'insulation',
        label: place.nearest_insulation_factory.company,
        icon: createDivIcon('📦', '#e6f7ff'),
      })
    }

    if (infra.substation_coordinates && infra.substation_coordinates.lat && infra.substation_coordinates.lon) {
      markers.push({
        lat: infra.substation_coordinates.lat,
        lon: infra.substation_coordinates.lon,
        type: 'substation',
        label: 'Подстанция',
        icon: createDivIcon('🔌', '#fff3bf'),
      })
    }

    if (infra.gas_coordinates && infra.gas_coordinates.lat && infra.gas_coordinates.lon) {
      markers.push({
        lat: infra.gas_coordinates.lat,
        lon: infra.gas_coordinates.lon,
        type: 'gas',
        label: 'Газовый узел',
        icon: createDivIcon('⛽', '#d1ffd6'),
      })
    }

    setInfraMarkers(markers)
  }

  return (
    <section className="region-resources__block">
      <h2 className="region-resources__item-title">Карта региона и площадок</h2>
      <p className="region-resources__text">Границы региона и все доступные точки площадок на одной карте.</p>
      <div className="region-resources__map-frame">
        <MapContainerAny
          attributionControl={false}
          center={[firstPlace.place_lat, firstPlace.place_lon]}
          className="region-resources__leaflet"
          scrollWheelZoom={false}
          zoom={7}
        >
          <TileLayerAny
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RegionBoundariesLayer
            regionNames={[regionName]}
            activeRegionName={regionName}
            color="#315b93"
            activeColor="#dc2626"
            fitActiveBounds
            weight={2}
            activeWeight={4}
          />
          {places.map((place, index) => {
            const isPrimary = index === 0
            const color = getPlaceColor(place.insights.score, isPrimary)

            return (
              <CircleMarkerAny
                center={[place.place_lat, place.place_lon]}
                key={`${place.place_name}-${index}`}
                fillColor={color}
                fillOpacity={0.82}
                pathOptions={{ color }}
                radius={isPrimary ? 12 : 9}
                weight={isPrimary ? 4 : 2}
                eventHandlers={{ click: () => showInfraForPlace(place) }}
              >
                <Popup className="region-map-popup">
                  <div className="region-map-popup__card">
                    <div className="region-map-popup__header">
                      <span className="region-map-popup__eyebrow">Площадка</span>
                      <strong className="region-map-popup__title">{place.place_name}</strong>
                    </div>

                    <div className="region-map-popup__meta">
                      <span className="region-map-popup__badge">Score {place.insights.score.toFixed(3)}</span>
                      <span className="region-map-popup__badge">Confidence {(place.insights.confidence * 100).toFixed(1)}%</span>
                    </div>

                    <div className="region-map-popup__stats">
                      <span>Площадь: {place.square_m2} м2</span>
                      <span>Смета: {formatMlnRub(place.estimate.total_mln_rub)}</span>
                    </div>

                    <details className="region-map-popup__estimate" style={{ marginTop: 8 }}>
                      <summary className="region-map-popup__link" style={{ cursor: 'pointer' }}>
                        Детализация сметы
                      </summary>
                      <div className="region-map-popup__estimate-list" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        {formatEstimateBreakdown(place.estimate).map((item) => (
                          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </details>

                    <a className="region-map-popup__link" href={buildYandexMapsUrl(place)} rel="noreferrer" target="_blank">
                      Открыть карты
                    </a>
                  </div>
                </Popup>
              </CircleMarkerAny>
            )
          })}
          {infraMarkers.map((m, i) => (
            <Marker key={`infra-${i}-${m.type}`} position={[m.lat, m.lon]} icon={m.icon}>
              <Popup className="region-map-popup region-map-popup--infra">
                <div className="region-map-popup__card">
                  <div className="region-map-popup__header">
                    <span className="region-map-popup__eyebrow">Инфраструктура</span>
                    <strong className="region-map-popup__title">{m.label}</strong>
                  </div>
                  <div className="region-map-popup__stats">
                    <span>Тип: {m.type}</span>
                    <span>Координаты: {m.lat.toFixed(3)}, {m.lon.toFixed(3)}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainerAny>
      </div>
    </section>
  )
}

export function RegionPage() {
  const [searchParams] = useSearchParams()
  const rawRegions = useMemo(() => loadTopRegions(), [])
  const topGroups = useMemo(() => groupTopRegions(rawRegions), [rawRegions])
  const selectedRegionName = searchParams.get('region') ?? rawRegions[0]?.region_name ?? ''
  const selectedGroup = useMemo(
    () => topGroups.find((item) => item.regionName === selectedRegionName) ?? null,
    [topGroups, selectedRegionName],
  )
  const regionRank = useMemo(() => {
    const index = topGroups.findIndex((item) => item.regionName === selectedRegionName)
    return index >= 0 ? index + 1 : null
  }, [topGroups, selectedRegionName])
  const selectedRenderType = useMemo(
    () => (selectedGroup ? getRegionRenderType(selectedGroup.summary) : 'comfort'),
    [selectedGroup],
  )
  const regionRenders = useMemo(
    () => (selectedGroup ? getRegionRenderAssets(selectedRenderType) : []),
    [selectedGroup, selectedRenderType],
  )
  const [activeTab, setActiveTab] = useState<RegionTabKey>('overview')
  const [isLoadingLlm, setIsLoadingLlm] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmResponse, setLlmResponse] = useState<LLMResponse | null>(null)
  const [isLoadingPresentation, setIsLoadingPresentation] = useState(false)
  const [presentationError, setPresentationError] = useState<string | null>(null)
  const [presentationResponse, setPresentationResponse] = useState<LLMResponse | null>(null)
  const presentationHtml = useMemo(
    () =>
      presentationResponse?.result ? injectRenderGalleryIntoPresentation(presentationResponse.result, regionRenders) : null,
    [presentationResponse, regionRenders],
  )

  useEffect(() => {
    setActiveTab('overview')
  }, [selectedRegionName])

  const handleSavePresentationPdf = () => {
    if (!selectedGroup || !presentationHtml) {
      return
    }

    try {
      saveHtmlAsPdf(`Презентация региона ${selectedGroup.regionName}`, presentationHtml)
    } catch (error) {
      setPresentationError(error instanceof Error ? error.message : 'Не удалось сохранить презентацию в PDF.')
    }
  }

  useEffect(() => {
    let isCancelled = false

    const fetchRecommendation = async () => {
      if (!selectedGroup) {
        return
      }

      try {
        setIsLoadingLlm(true)
        setLlmError(null)
        const response = await requestLLMRecommendation(selectedGroup.summary)

        if (!isCancelled) {
          setLlmResponse(response)
        }
      } catch (error) {
        if (!isCancelled) {
          setLlmError(
            error instanceof Error ? error.message : 'Не удалось получить рекомендацию от LLM через gateway-service.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingLlm(false)
        }
      }
    }

    setLlmResponse(null)
    fetchRecommendation()

    return () => {
      isCancelled = true
    }
  }, [selectedGroup])

  useEffect(() => {
    let isCancelled = false

    const fetchPresentation = async () => {
      if (!selectedGroup) {
        return
      }

      try {
        setIsLoadingPresentation(true)
        setPresentationError(null)
        const response = await requestLLMPresentation(selectedGroup.summary)

        if (!isCancelled) {
          setPresentationResponse(response)
        }
      } catch (error) {
        if (!isCancelled) {
          setPresentationError(
            error instanceof Error ? error.message : 'Не удалось получить презентацию через gateway-service.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPresentation(false)
        }
      }
    }

    setPresentationResponse(null)
    fetchPresentation()

    return () => {
      isCancelled = true
    }
  }, [selectedGroup])

  if (!selectedGroup) {
    return (
      <section className="region-page">
        <div className="container region-page__inner">
          <h1 className="region-resources__title">Нет данных по региону</h1>
          <p className="region-resources__text">Сначала отправьте форму и получите ответ от gateway-service.</p>
          <Link className="top-card__link" to="/">
            Вернуться к форме
          </Link>
        </div>
      </section>
    )
  }

  const selectedRegion = selectedGroup.summary
  const social = selectedRegion.region_info.social_infrastructure
  const economy = selectedRegion.region_info.economy
  const network = selectedRegion.region_info.network_infrastructure
  const culture = selectedRegion.region_info.cultural_code
  const overviewKpis = [
    {
      icon: '🏙',
      label: 'Индекс среды',
      value: String(social.urban_environment_index),
      helper: 'Качество городской среды',
    },
    {
      icon: '👶',
      label: 'Детсадов/100 детей',
      value: formatWholeNumber(social.kindergarten_availability_per_100_children),
      helper: 'Социальная инфраструктура',
    },
    {
      icon: '🏠',
      label: 'Аренда',
      value: formatRub(social.average_1room_apartment_rent_rub),
      helper: '1-комнатная квартира',
    },
    {
      icon: '🎓',
      label: 'Места в колледжах',
      value: String(social.profile_colleges_budget_places),
      helper: 'Кадровый резерв',
    },
  ]

  const economyCards = [
    {
      label: 'Льготы',
      percent: economy.benefits.length > 0 ? 100 : 35,
      value: economy.benefits.length > 0 ? 'Есть' : 'Нет',
      detail: formatBenefitsLabel(economy.benefits),
    },
    {
      label: 'Энергия',
      percent: clampPercent(100 - economy.industrial_electricity_tariff_rub_kwh * 10),
      value: `${economy.industrial_electricity_tariff_rub_kwh} руб/кВт*ч`,
      detail: 'Энерготариф региона',
    },
    {
      label: 'Кадры',
      percent: clampPercent(100 - economy.average_monthly_salary_rub / 1500),
      value: formatRub(economy.average_monthly_salary_rub),
      detail: 'Средняя зарплата',
    },
    {
      label: 'Мощность',
      percent: clampPercent(network.available_electrical_capacity_kva / 10),
      value: `${network.available_electrical_capacity_kva} кВА`,
      detail: 'Свободная электрическая мощность',
    },
  ]

  const economyMeta = [
    `Льготы: ${formatBenefitsLabel(economy.benefits)}`,
    `Экологический класс ИЗА: ${economy.ecological_class_iza}`,
    `Техприсоединение: ${formatRub(network.technological_connection_fee_rub_kw)} / кВт`,
  ]

  const socialCards = [
    { icon: '🏙', label: 'Индекс городской среды', value: social.urban_environment_index, note: 'Городская среда' },
    {
      icon: '👶',
      label: 'Детсадов на 100 детей',
      value: formatWholeNumber(social.kindergarten_availability_per_100_children),
      note: 'Доступность для семей',
    },
    {
      icon: '🏠',
      label: 'Средняя аренда',
      value: formatRub(social.average_1room_apartment_rent_rub),
      note: 'Жилищная нагрузка',
    },
    {
      icon: '🎓',
      label: 'Бюджетные места',
      value: social.profile_colleges_budget_places,
      note: 'Потенциал подготовки кадров',
    },
  ]

  const cultureGroups = [
    {
      title: 'Архитектурные стили',
      values: culture.dominant_architectural_styles,
    },
    {
      title: 'Материалы и орнаменты',
      values: culture.traditional_materials_ornaments,
    },
  ]

  const palette = [
    { label: 'Primary', value: culture.color_profile.primary },
    { label: 'Secondary', value: culture.color_profile.secondary },
    { label: 'Accent', value: culture.color_profile.accent },
  ]

  const renderOverviewTab = () => (
    <div className="region-dashboard__grid region-dashboard__grid--overview">
      <RegionPlacesMap regionName={selectedGroup.regionName} places={selectedGroup.places} />

      <section className="region-resources__block region-dashboard__panel">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">Визуальные материалы</h2>
            <p className="region-resources__text">Автоподобранные рендеры и текущие AI-модули по региону.</p>
            <p className="region-resources__text">Тип рендера: {getRegionRenderTypeLabel(selectedRenderType)}</p>
          </div>
        </div>

        <ul className="region-resources__render-grid">
          {regionRenders.map((renderAsset, index) => (
            <li className="region-resources__render-card" key={renderAsset.title}>
              <img
                alt={`${selectedGroup.regionName} ${index + 1}`}
                className="region-resources__render-image"
                src={renderAsset.src}
              />
              <div className="region-resources__render-meta">
                <strong>{renderAsset.title}</strong>
                <span>{selectedRegion.region_name}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="region-resources__block region-dashboard__panel">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">3D-визуализация</h2>
            <p className="region-resources__text">Интерактивная 3D модель площадки (WebGL)</p>
          </div>
        </div>
        <div style={{ width: '100%', minHeight: 420 }}>
          <ThreeViewer input={loadProjectInput() ?? undefined} region={selectedRegion.region_info} />
        </div>
      </section>

      <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">Рекомендация LLM</h2>
            <p className="region-resources__text">Сводка с учетом выбранного региона.</p>
          </div>
        </div>

        {isLoadingLlm ? <p className="region-resources__text">Генерируем рекомендацию...</p> : null}
        {llmError ? <p className="region-resources__text">Ошибка: {llmError}</p> : null}
        {llmResponse?.result ? (
          <div className="region-resources__board" aria-label="LLM HTML модуль">
            <iframe
              title="LLM HTML module"
              srcDoc={buildHtmlModuleDoc(llmResponse.result)}
              sandbox=""
              style={{ width: '100%', minHeight: 420, border: '1px solid #d0d7e2', borderRadius: 12 }}
            />
          </div>
        ) : null}

        {llmResponse ? (
          <details className="region-resources__tech-popover">
            <summary>Технические детали</summary>
            <div className="region-resources__tech-popover-body">
              <p className="region-resources__text">Статус: {llmResponse.ok ? 'ok' : 'error'}</p>
              {llmResponse.model ? <p className="region-resources__text">Модель: {llmResponse.model}</p> : null}
              {llmResponse.usage_tokens ? (
                <p className="region-resources__text">Токены: {llmResponse.usage_tokens}</p>
              ) : null}
              {llmResponse.error ? <p className="region-resources__text">Ошибка LLM: {llmResponse.error}</p> : null}
              {llmResponse.details ? <p className="region-resources__text">Детали: {llmResponse.details}</p> : null}
            </div>
          </details>
        ) : null}
      </section>

      <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">Презентация проекта</h2>
            <p className="region-resources__text">Презентация для выбранной площадки и региона.</p>
          </div>
          <button
            className="region-resources__action"
            disabled={!presentationResponse?.result}
            onClick={handleSavePresentationPdf}
            type="button"
          >
            Сохранить в PDF
          </button>
        </div>

        {isLoadingPresentation ? <p className="region-resources__text">Генерируем презентацию...</p> : null}
        {presentationError ? <p className="region-resources__text">Ошибка: {presentationError}</p> : null}
        {presentationHtml ? (
          (() => {
            const text = presentationHtml
            const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text)

            if (looksLikeHtml) {
              return (
                <div className="region-resources__board region-resources__presentation-board" aria-label="HTML презентация">
                  <iframe
                    title="Presentation HTML module"
                    srcDoc={buildHtmlModuleDoc(text)}
                    sandbox=""
                    className="region-resources__presentation-frame"
                  />
                </div>
              )
            }

            return (
              <div className="region-resources__board region-resources__presentation-board" aria-label="Presentation (text)">
                <p className="region-resources__text">LLM вернул неожиданный текстовый формат вместо HTML-презентации.</p>
                <pre className="region-resources__text" style={{ whiteSpace: 'pre-wrap' }}>{text}</pre>
                <p className="region-resources__text">Нажмите «Сохранить в PDF» после повторной генерации.</p>
              </div>
            )
          })()
        ) : null}

        {presentationResponse ? (
          <details className="region-resources__tech-popover">
            <summary>Технические детали презентации</summary>
            <div className="region-resources__tech-popover-body">
              <p className="region-resources__text">Статус: {presentationResponse.ok ? 'ok' : 'error'}</p>
              {presentationResponse.model ? (
                <p className="region-resources__text">Модель: {presentationResponse.model}</p>
              ) : null}
              {presentationResponse.usage_tokens ? (
                <p className="region-resources__text">Токены: {presentationResponse.usage_tokens}</p>
              ) : null}
              {presentationResponse.error ? (
                <p className="region-resources__text">Ошибка LLM: {presentationResponse.error}</p>
              ) : null}
              {presentationResponse.details ? (
                <p className="region-resources__text">Детали: {presentationResponse.details}</p>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  )

  const renderEconomyTab = () => (
    <div className="region-dashboard__grid region-dashboard__grid--economy">
      <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">Экономика и сети</h2>
          </div>
        </div>

        <div className="region-economy__grid">
          {economyCards.map((item) => {
            const tone = getIndicatorTone(item.percent)

            return (
              <article className={`region-economy__card region-economy__card--${tone}`} key={item.label}>
                <div className="region-economy__card-head">
                  <div>
                    <h3 className="region-economy__title">{item.label}</h3>
                    <p className="region-economy__value">{item.value}</p>
                  </div>
                  <span className={`region-economy__badge region-economy__badge--${tone}`}>{getIndicatorLabel(item.percent)}</span>
                </div>

                <div className="region-economy__bar" aria-hidden="true">
                  <span className="region-economy__bar-fill" style={{ width: `${item.percent}%` }} />
                </div>
                <p className="region-economy__detail">{item.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="region-resources__block region-dashboard__panel">
        <div className="region-dashboard__panel-head">
          <div>
            <h2 className="region-resources__item-title">Экономический профиль</h2>
          </div>
        </div>
        <div className="region-economy__meta-list">
          {economyMeta.map((item) => (
            <span className="region-economy__meta-pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  )

  const renderSocialTab = () => (
    <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
      <div className="region-dashboard__panel-head">
        <div>
          <h2 className="region-resources__item-title">Социальная инфраструктура</h2>
        </div>
      </div>

      <div className="region-social__grid">
        {socialCards.map((item) => (
          <article className="region-social__card" key={item.label}>
            <div className="region-social__icon">{item.icon}</div>
            <div className="region-social__content">
              <span className="region-social__label">{item.label}</span>
              <strong className="region-social__value">{item.value}</strong>
              <span className="region-social__note">{item.note}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderCultureTab = () => (
    <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
      <div className="region-dashboard__panel-head">
        <div>
          <h2 className="region-resources__item-title">Культурный код</h2>
          <p className="region-resources__text">Архитектурные стили, материалы и палитра</p>
        </div>
      </div>

      <div className="region-culture__body">
        {cultureGroups.map((group) => (
          <div className="region-culture__section" key={group.title}>
            <h3 className="region-culture__subtitle">{group.title}</h3>
            <div className="region-culture__chips">
              {(group.values.length > 0 ? group.values : ['нет данных']).map((item) => (
                <span className="region-culture__chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="region-culture__section">
          <h3 className="region-culture__subtitle">Цветовая палитра</h3>
          <div className="region-culture__palette">
            {palette.map((color) => (
              <div className="region-culture__swatch" key={color.label} title={color.value}>
                <span
                  aria-label={`${color.label} ${color.value}`}
                  className="region-culture__swatch-dot"
                  style={{ backgroundColor: color.value }}
                />
                <span className="region-culture__swatch-label">{color.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="region-culture__description">{culture.color_profile.description}</p>
      </div>
    </section>
  )

  const renderSitesTab = () => (
    <section className="region-resources__block region-dashboard__panel region-dashboard__panel--wide">
      <div className="region-dashboard__panel-head">
        <div>
          <h2 className="region-resources__item-title">Площадки региона</h2>
          <p className="region-resources__text">Нажмите на карточку, чтобы раскрыть подробную информацию.</p>
        </div>
      </div>

      <div className="region-sites__list">
        {selectedGroup.places.map((place: PlaceRecord, index) => (
          <details className="region-site-card" key={`${selectedGroup.regionName}-${place.place_name}-${index}`}>
            <summary className="region-site-card__summary">
              <div className="region-site-card__summary-main">
                <span className="region-site-card__rank">#{index + 1}</span>
                <h3 className="region-site-card__title">{place.place_name}</h3>
                <p className="region-site-card__subtitle">
                  {formatDealStructure(place.deal_structure)} · {formatBenefitsLabel(place.benefit)} · {place.square_m2} м2
                </p>
                <div className="region-site-card__chips">
                  {place.insights.pros.slice(0, 3).map((item) => (
                    <span className="region-site-card__chip region-site-card__chip--positive" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="region-site-card__score">
                <span>Score</span>
                <strong>{place.insights.score.toFixed(3)}</strong>
                <small>{(place.insights.confidence * 100).toFixed(1)}%</small>
              </div>

              <div className="region-site-card__toggle" aria-hidden="true">
                <span className="region-site-card__toggle-label">Подробнее</span>
              </div>
            </summary>

            <div className="region-site-card__body">
              <div className="region-site-card__panel-grid">
                <div className="region-site-card__panel">
                  <h4>Преимущества</h4>
                  <div className="region-site-card__chips">
                    {place.insights.pros.map((item) => (
                      <span className="region-site-card__chip region-site-card__chip--positive" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="region-site-card__panel">
                  <h4>Ограничения</h4>
                  <div className="region-site-card__chips">
                    {[...place.insights.cons, ...place.insights.risks].map((item) => (
                      <span className="region-site-card__chip region-site-card__chip--negative" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="region-site-card__meta-grid">
                <span>Площадь: {place.square_ha} га</span>
                <span>Площадь: {place.square_m2} м2</span>
                <span>Цена: {formatRubOptional(place.price_rub)}</span>
                <span>Смета: {formatMlnRub(place.estimate.total_mln_rub)}</span>
                <span>До ЖД: {formatKmOptional(place.distance_to_the_nearest_railway_station_km)}</span>
                <span>До трассы: {formatKmOptional(place.distance_to_the_nearest_federal_highway_km)}</span>
                <span>До подстанции: {formatKmOptional(place.infrastructure.distance_to_substation_km)}</span>
                <span>Мощность: {place.infrastructure.available_power_kva} кВА</span>
                <span>Газ: {place.infrastructure.has_gas ? 'есть' : 'нет'}</span>
                <span>До металлурга: {formatKmOptional(place.min_dist_km_to_metallurgical_factory)}</span>
                <span>Металлург: {place.nearest_metallurgical_factory.company}</span>
                <span>До утеплителя: {formatKmOptional(place.min_dist_km_to_insulation_factory)}</span>
                <span>Поставщик утеплителя: {place.nearest_insulation_factory.company}</span>
                <span>Утеплитель: {formatInsulationName(place.insights.insulation?.type)}</span>
                <span>Льготы: {formatBenefitsLabel(place.benefit)}</span>
              </div>

              <details className="region-site-card__estimate" style={{ marginTop: 12 }}>
                <summary className="region-site-card__reason" style={{ cursor: 'pointer' }}>
                  Детализация сметы
                </summary>
                <div className="region-site-card__panel-grid" style={{ marginTop: 12 }}>
                  {formatEstimateBreakdown(place.estimate).map((item) => (
                    <div className="region-site-card__panel" key={item.label}>
                      <h4>{item.label}</h4>
                      <p style={{ margin: 0, fontWeight: 700 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </details>

              <p className={`region-site-card__reason ${place.insights.budget_overrun ? '' : 'region-site-card__reason--ok'}`}>
                {place.insights.budget_overrun
                  ? `Превышение бюджета: +${place.insights.budget_overrun_amount?.toFixed(2) ?? '0.00'} млн руб`
                  : 'Бюджет: укладывается'}
              </p>

              <p className="region-site-card__reason">
                Объяснение: {place.insights.insulation?.reason ?? 'автоматически выбран по правилам оценки'}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  )

  const activePanel =
    activeTab === 'overview'
      ? renderOverviewTab()
      : activeTab === 'economy'
        ? renderEconomyTab()
        : activeTab === 'social'
          ? renderSocialTab()
          : activeTab === 'culture'
            ? renderCultureTab()
            : renderSitesTab()

  return (
    <section className="region-page">
      <div className="container region-page__inner">
        <section className="region-dashboard" aria-label="Детали региона">
          <section className="region-resources__block region-overview-card">
            <div className="region-overview-card__header">
              <div>
                <p className="region-overview-card__eyebrow">Обзор региона</p>
                <h1 className="region-overview-card__title">{selectedGroup.regionName}</h1>
              </div>

              <div className="region-overview-card__scorebox">
                <span className="region-overview-card__score-label">Региональный скор</span>
                <strong className="region-overview-card__score-value">{selectedRegion.score.toFixed(3)}</strong>
                <div className="region-overview-card__meta-row">
                  <span className="region-overview-card__meta-pill">Ранг #{regionRank ?? '—'}</span>
                  <span className="region-overview-card__meta-pill">Площадок {selectedGroup.places.length}</span>
                </div>
              </div>
            </div>

            <div className="region-overview-card__stats-grid">
              <div className="region-overview-card__stat">
                <span className="region-overview-card__stat-label">Лучший участок</span>
                <strong className="region-overview-card__stat-value">{selectedRegion.place_name}</strong>
              </div>
              <div className="region-overview-card__stat">
                <span className="region-overview-card__stat-label">Ключевой фактор</span>
                <strong className="region-overview-card__stat-value">{formatTopFactor(selectedRegion.why.top_factor)}</strong>
              </div>
              <div className="region-overview-card__stat">
                <span className="region-overview-card__stat-label">Утеплитель</span>
                <strong className="region-overview-card__stat-value">
                  {formatInsulationName(selectedGroup.places[0]?.insights.insulation?.type)}
                </strong>
              </div>
              <div className="region-overview-card__stat">
                <span className="region-overview-card__stat-label">Confidence</span>
                <strong className="region-overview-card__stat-value">{(selectedRegion.confidence * 100).toFixed(1)}%</strong>
              </div>
            </div>

            <div className="region-overview-card__kpi-grid">
              {overviewKpis.map((item) => (
                <article className="region-kpi-card" key={item.label}>
                  <span className="region-kpi-card__icon">{item.icon}</span>
                  <div className="region-kpi-card__body">
                    <strong className="region-kpi-card__value">{item.value}</strong>
                    <span className="region-kpi-card__label">{item.label}</span>
                    <span className="region-kpi-card__helper">{item.helper}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="region-resources__block region-why-card">
            <div className="region-dashboard__panel-head">
              <div>
                <h2 className="region-resources__item-title">Почему регион выбран</h2>
                <p className="region-resources__text">Почему регион попал в топ — с плюсами и ограничениями</p>
              </div>
            </div>

            <div className="region-why-card__grid">
              <div className="region-why-card__column region-why-card__column--positive">
                <h3 className="region-why-card__title">Преимущества</h3>
                <div className="region-why-card__chips">
                  {(selectedRegion.why.pros.length > 0 ? selectedRegion.why.pros : ['Преимущества не указаны']).map((item) => (
                    <span className="region-why-card__chip region-why-card__chip--positive" key={item}>
                      ✅ {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="region-why-card__column region-why-card__column--negative">
                <h3 className="region-why-card__title">Ограничения</h3>
                <div className="region-why-card__chips">
                  {selectedRegion.why.cons.length + selectedRegion.why.risks.length > 0 ? (
                    [...selectedRegion.why.cons, ...selectedRegion.why.risks].map((item) => (
                      <span className="region-why-card__chip region-why-card__chip--negative" key={item}>
                        ⚠ {item}
                      </span>
                    ))
                  ) : (
                    <span className="region-why-card__chip region-why-card__chip--positive">Ограничения не выявлены</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <nav className="region-tabs" aria-label="Разделы информации о регионе">
            {REGION_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={`region-tabs__button ${activeTab === tab.key ? 'region-tabs__button--active' : ''}`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="region-tabs__panel" role="tabpanel">
            {activePanel}
          </div>

          <Link className="top-card__link" to="/top-regions">
            Назад к списку регионов
          </Link>
        </section>
      </div>
    </section>
  )
}
