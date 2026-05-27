import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { requestLLMRecommendation, type LLMResponse, type PlaceRecord } from '../../api/gateway'
import { findRegionGroup, loadProjectInput, loadTopRegions } from '../../api/session'
import { RegionBoundariesLayer } from '../../components/map/RegionBoundariesLayer'
import ThreeViewer from '../../components/region/ThreeViewer'

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)

const formatRubOptional = (value: number | null | undefined) => (value == null ? 'нет данных' : formatRub(value))

const formatInsulationName = (value?: string) => {
  switch (value) {
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

const formatDealStructure = (value?: string) => {
  switch (value) {
    case 'selling':
      return 'Продажа'
    case 'auction':
      return 'Аукцион'
    case 'lease':
      return 'Аренда'
    case 'rent':
      return 'Аренда'
    default:
      return value ?? 'не указан'
  }
}

const formatBenefitsLabel = (value?: string | null) => {
  if (!value) {
    return 'без льгот'
  }

  const normalized = value.toLowerCase()

  if (normalized.includes('special_economic_zone') || normalized.includes('special economic zone')) {
    return 'ОЭЗ'
  }

  if (normalized.includes('advanced development area') || normalized.includes('tor')) {
    return 'ТОР'
  }

  if (normalized.includes('arctic zone')) {
    return 'Арктическая зона'
  }

  return value
}

const renderLabels = [
  'Главный фасад',
  'Вид с высоты',
  'Въездная группа',
  'Контекст застройки',
] as const

const MapContainerAny = MapContainer as unknown as (props: any) => ReactElement
const TileLayerAny = TileLayer as unknown as (props: any) => ReactElement
const CircleMarkerAny = CircleMarker as unknown as (props: any) => ReactElement

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

const buildLlmModuleDoc = (html: string) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`

function RegionPlacesMap({ regionName, places }: { regionName: string; places: PlaceRecord[] }) {
  const firstPlace = places[0]

  if (!firstPlace) {
    return null
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
                key={`${place.place_address}-${index}`}
                fillColor={color}
                fillOpacity={0.82}
                pathOptions={{ color }}
                radius={isPrimary ? 12 : 9}
                weight={isPrimary ? 4 : 2}
              >
                <Popup>
                  <div className="region-land__popup">
                    <strong>{place.place_address}</strong>
                    <span>Score: {place.insights.score.toFixed(3)}</span>
                    <span>Confidence: {(place.insights.confidence * 100).toFixed(1)}%</span>
                    <span>Площадь: {place.square_m2} м2</span>
                    <span>Смета: {place.estimate.total_mln_rub} млн руб</span>
                  </div>
                </Popup>
              </CircleMarkerAny>
            )
          })}
        </MapContainerAny>
      </div>
    </section>
  )
}

export function RegionPage() {
  const [searchParams] = useSearchParams()
  const rawRegions = useMemo(() => loadTopRegions(), [])
  const projectInput = useMemo(() => loadProjectInput(), [])
  const selectedRegionName = searchParams.get('region') ?? rawRegions[0]?.region_name ?? ''
  const selectedGroup = useMemo(
    () => findRegionGroup(rawRegions, selectedRegionName) ?? null,
    [rawRegions, selectedRegionName],
  )
  const [isLoadingLlm, setIsLoadingLlm] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmResponse, setLlmResponse] = useState<LLMResponse | null>(null)

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
  const viewerInput = projectInput
    ? {
        ...projectInput,
        insulationType: 'mineral-wool' as const,
      }
    : undefined

  return (
    <section className="region-page">
      <div className="container region-page__inner">
        <section className="region-resources" aria-label="Детали региона">
          <RegionPlacesMap regionName={selectedGroup.regionName} places={selectedGroup.places} />

          <section className="region-resources__block region-resources__hero">
            <div>
              <h1 className="region-resources__title">Регион: {selectedGroup.regionName}</h1>
              <p className="region-resources__subtitle">
                Лучший участок: {selectedRegion.place_address}. Площадок в регионе: {selectedGroup.places.length}
              </p>
            </div>
            <div className="region-resources__hero-stats">
              <span className="region-resources__hero-chip">Score: {selectedRegion.score.toFixed(3)}</span>
              <span className="region-resources__hero-chip">Confidence: {(selectedRegion.confidence * 100).toFixed(1)}%</span>
              <span className="region-resources__hero-chip">Ключевой фактор: {selectedRegion.why.top_factor}</span>
              <span className="region-resources__hero-chip">
                Утеплитель: {formatInsulationName(selectedGroup.places[0]?.insights.insulation?.type)}
              </span>
            </div>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Краткое описание региона</h2>
            <p className="region-resources__text">
              {selectedRegion.region_name} показывает сильный баланс между экономикой, логистикой и социальной
              инфраструктурой. Здесь уже есть площадки с разной моделью сделки, поэтому можно сравнивать не только
              географию, но и коммерческие условия.
            </p>
            <ul className="region-resources__sublist">
              <li className="region-resources__subitem">Логистика: {selectedRegion.breakdown.logistics.toFixed(3)}</li>
              <li className="region-resources__subitem">Энергия: {selectedRegion.breakdown.energy.toFixed(3)}</li>
              <li className="region-resources__subitem">Кадры: {selectedRegion.breakdown.labor.toFixed(3)}</li>
              <li className="region-resources__subitem">Соцфакторы: {selectedRegion.breakdown.social.toFixed(3)}</li>
              <li className="region-resources__subitem">Экономика: {selectedRegion.breakdown.economy.toFixed(3)}</li>
            </ul>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Почему этот регион</h2>
            <p className="region-resources__text">Ключевой фактор: {selectedRegion.why.top_factor}</p>
            {
              selectedRegion.why.pros.length > 0 && <>
              <h3 className="region-resources__subheading">Плюсы</h3>
              <ul className="region-resources__sublist">
                {selectedRegion.why.pros.map((item) => (
                  <li className="region-resources__subitem" key={item}>
                    {item}
                  </li>
                ))}
              </ul> </>
            }
            {
              selectedRegion.why.cons.length > 0 && <>
              <h3 className="region-resources__subheading">Минусы</h3>
              <ul className="region-resources__sublist">
                {selectedRegion.why.cons.map((item) => (
                  <li className="region-resources__subitem" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
              </>
            }
            {
              selectedRegion.why.risks.length > 0 && <>
              <h3 className="region-resources__subheading">Риски</h3>
              <ul className="region-resources__sublist">
                {selectedRegion.why.risks.map((item) => (
                  <li className="region-resources__subitem" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
              </>
            }
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Социальная инфраструктура</h2>
            <p className="region-resources__text">Индекс городской среды: {social.urban_environment_index}</p>
            <p className="region-resources__text">
              Детсадов на 100 детей: {social.kindergarten_availability_per_100_children}
            </p>
            <p className="region-resources__text">
              Аренда 1-комн квартиры: {formatRub(social.average_1room_apartment_rent_rub)}
            </p>
            <p className="region-resources__text">
              Бюджетные места в колледжах: {social.profile_colleges_budget_places}
            </p>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Экономика и сети</h2>
            <p className="region-resources__text">
              Налоговые льготы: {economy.has_tax_incentives_tor_oez ? 'есть' : 'нет'}
            </p>
            <p className="region-resources__text">Описание льгот: {economy.tax_incentives_description}</p>
            <p className="region-resources__text">
              Пониженные страховые взносы: {economy.has_reduced_insurance_contributions ? 'есть' : 'нет'}
            </p>
            <p className="region-resources__text">
              Энерготариф: {economy.industrial_electricity_tariff_rub_kwh} руб/кВт*ч
            </p>
            <p className="region-resources__text">
              Средняя зарплата: {formatRub(economy.average_monthly_salary_rub)}
            </p>
            <p className="region-resources__text">Экологический класс ИЗА: {economy.ecological_class_iza}</p>
            <p className="region-resources__text">
              Свободная мощность: {network.available_electrical_capacity_kva} кВА
            </p>
            <p className="region-resources__text">
              Стоимость техприсоединения: {formatRub(network.technological_connection_fee_rub_kw)} / кВт
            </p>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Культурный код</h2>
            <p className="region-resources__text">
              Архитектурные стили: {culture.dominant_architectural_styles.join(', ') || 'нет данных'}
            </p>
            <p className="region-resources__text">
              Материалы и орнаменты: {culture.traditional_materials_ornaments.join(', ') || 'нет данных'}
            </p>
            <p className="region-resources__text">Primary: {culture.color_profile.primary}</p>
            <p className="region-resources__text">Secondary: {culture.color_profile.secondary}</p>
            <p className="region-resources__text">Accent: {culture.color_profile.accent}</p>
            <p className="region-resources__text">Описание палитры: {culture.color_profile.description}</p>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">3D-визуализация</h2>
            <div className="region-resources__viewer region-resources__viewer--three">
              {viewerInput ? (
                <ThreeViewer input={viewerInput} className="region-resources__three" />
              ) : (
                <p className="region-resources__text">Не удалось восстановить параметры проекта для 3D-модели.</p>
              )}
            </div>
          </section>

          

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">4 рендера завода</h2>
            <ul className="region-resources__render-grid">
              {renderLabels.map((label, index) => (
                <li className="region-resources__render-card" key={label}>
                  <div className="region-resources__render-image region-resources__render-image--placeholder">
                    <div className="region-resources__render-placeholder">
                      <span className="region-resources__render-index">0{index + 1}</span>
                      <strong>{label}</strong>
                      <p>Пока здесь заглушка под будущий рендер.</p>
                    </div>
                  </div>
                  <div className="region-resources__render-meta">
                    <strong>{label}</strong>
                    <span>{selectedRegion.region_name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Рекомендация LLM</h2>
            {isLoadingLlm ? <p className="region-resources__text">Генерируем рекомендацию...</p> : null}
            {llmError ? <p className="region-resources__text">Ошибка: {llmError}</p> : null}
            {llmResponse ? (
              <>
                {llmResponse.result ? (
                  <div className="region-resources__board" aria-label="LLM HTML модуль">
                    <iframe
                      title="LLM HTML module"
                      srcDoc={buildLlmModuleDoc(llmResponse.result)}
                      sandbox=""
                      style={{ width: '100%', minHeight: 420, border: '1px solid #d0d7e2', borderRadius: 12 }}
                    />
                  </div>
                ) : null}
                <details className="region-resources__tech-popover">
                  <summary>Технические детали</summary>
                  <div className="region-resources__tech-popover-body">
                    <p className="region-resources__text">Статус: {llmResponse.ok ? 'ok' : 'error'}</p>
                    {llmResponse.model ? <p className="region-resources__text">Модель: {llmResponse.model}</p> : null}
                    {llmResponse.usage_tokens ? (
                      <p className="region-resources__text">Токены: {llmResponse.usage_tokens}</p>
                    ) : null}
                    {llmResponse.error ? (
                      <p className="region-resources__text">Ошибка LLM: {llmResponse.error}</p>
                    ) : null}
                    {llmResponse.details ? <p className="region-resources__text">Детали: {llmResponse.details}</p> : null}
                  </div>
                </details>
              </>
            ) : null}
          </section>

          <section className="region-resources__block">
            <h2 className="region-resources__item-title">Площадки региона</h2>
            <p className="region-resources__text">
              Ниже показаны все площадки из ответа API для региона {selectedGroup.regionName}, каждая со своими плюсами,
              минусами и условиями.
            </p>
            <div className="region-places">
              {selectedGroup.places.map((place: PlaceRecord, index) => (
                <article className="region-place-card" key={`${selectedGroup.regionName}-${place.place_address}-${index}`}>
                  <div className="region-place-card__thumb">
                    <div className="region-place-card__thumb-image" />
                    <div className="region-place-card__thumb-meta">
                      <span className="region-place-card__badge">#{index + 1}</span>
                        <span className="region-place-card__insulation">
                          {formatInsulationName(place.insights.insulation?.type)}
                        </span>
                      <strong className="region-place-card__estimate">{place.estimate ? `${place.estimate.total_mln_rub} млн ₽` : '—'}</strong>
                      <small className="region-place-card__price">{formatRubOptional(place.price_rub)}</small>
                    </div>
                  </div>

                  <div className="region-place-card__body">
                    <div className="region-place-card__header">
                      <div>
                        <h3 className="region-place-card__title">{place.place_address}</h3>
                        <p className="region-place-card__subtitle">
                          {formatDealStructure(place.deal_structure)} · {formatBenefitsLabel(place.benefits)} · {place.square_m2} м2
                        </p>
                      </div>
                      <div className="region-place-card__score">
                        <span>Score</span>
                        <strong>{place.insights.score.toFixed(3)}</strong>
                        <small>{(place.insights.confidence * 100).toFixed(1)}%</small>
                      </div>
                    </div>

                    <div className="region-place-card__grid">
                      <div className="region-place-card__panel">
                        <h4>Плюсы</h4>
                        <ul className="region-place-card__chips">
                          {place.insights.pros.map((item) => (
                            <li className="region-place-card__chip region-place-card__chip--positive" key={item}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="region-place-card__panel">
                        <h4>Минусы и риски</h4>
                        <ul className="region-place-card__chips">
                          {[...place.insights.cons, ...place.insights.risks].map((item) => (
                            <li className="region-place-card__chip region-place-card__chip--negative" key={item}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="region-place-card__meta-grid">
                      <span>Режим сделки: {formatDealStructure(place.deal_structure)}</span>
                      <span>Льготы: {formatBenefitsLabel(place.benefits)}</span>
                      <span>Утеплитель: {formatInsulationName(place.insights.insulation?.type)}</span>
                      <span>
                        Объяснение: {place.insights.insulation?.reason ?? 'автоматически выбран по правилам оценки'}
                      </span>
                      {place.insights.budget_overrun ? (
                        <span>
                          Превышение бюджета: +{place.insights.budget_overrun_amount?.toFixed(2) ?? '0.00'} млн руб
                        </span>
                      ) : (
                        <span>Бюджет: укладывается</span>
                      )}
                      <span>До ЖД: {place.distance_to_the_nearest_railway_station_km} км</span>
                      <span>До трассы: {place.distance_to_the_nearest_federal_highway_km} км</span>
                      <span>До подстанции: {place.distance_to_the_nearest_electric_substation_km} км</span>
                      <span>До поставщика стали: {place.distance_to_the_supplier_of_rolled_steel_km} км</span>
                      <span>Площадь: {place.square_m2} м2</span>
                      <span>Цена: {formatRubOptional(place.price_rub)}</span>
                      <span>Смета: {formatRub(place.estimate.total_mln_rub * 1_000_000)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Link className="top-card__link" to="/top-regions">
            Назад к списку регионов
          </Link>
        </section>
      </div>
    </section>
  )
}
