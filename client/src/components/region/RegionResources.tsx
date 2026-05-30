import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { RegionBoundariesLayer } from '../map/RegionBoundariesLayer'
import ThreeViewer from './ThreeViewer'

import {
  buildAnalyticalReference,
  buildLandPlotMatches,
  buildPresentationSlides,
  calculateArea,
  calculateEstimate,
  getHazardClass,
  type RankingResult,
  type Region,
  type UserInput,
} from '../../api/api'

interface RegionResourcesProps {
  region: Region
  input: UserInput
  ranking: RankingResult
}

const MapContainerAny = MapContainer as unknown as (props: any) => ReactElement
const TileLayerAny = TileLayer as unknown as (props: any) => ReactElement
const CircleMarkerAny = CircleMarker as unknown as (props: any) => ReactElement

const getPlotColor = (fitsRequest: boolean, isActive: boolean, status: 'available' | 'reserve') => {
  if (!fitsRequest) {
    return '#b42318'
  }

  if (isActive) {
    return '#f59e0b'
  }

  return status === 'available' ? '#20a561' : '#2d6fe2'
}

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    value,
  )

const formatKmOptional = (value: number | null | undefined) => (value == null ? 'нет данных' : `${value} км`)

export function RegionResources({ region, input, ranking }: RegionResourcesProps) {
  const matches = useMemo(() => buildLandPlotMatches(input, region), [input, region])
  const defaultPlotId = matches[0]?.plot.id ?? region.landPlots[0]?.id ?? ''
  const [activePlotId, setActivePlotId] = useState(defaultPlotId)

  useEffect(() => {
    setActivePlotId(defaultPlotId)
  }, [defaultPlotId])

  const analytics = buildAnalyticalReference(input, region)
  const area = calculateArea(input)
  const estimate = calculateEstimate(input)
  const slides = buildPresentationSlides(input, region, ranking)
  const hazardClass = getHazardClass(input.insulationType)
  const activePlot = matches.find((item) => item.plot.id === activePlotId) ?? matches[0]
  const suitablePlots = matches.filter((item) => item.fitsRequest)

  return (
    <section className="region-resources" aria-label="Материалы региона">
      <h1 className="region-resources__title">Страница региона: {region.title}</h1>
      <p className="region-resources__subtitle">Итоговый рейтинг региона: {ranking.score} / 100</p>

      <section className="region-resources__block region-land" aria-label="Свободная земля в регионе">
        <div className="region-land__header">
          <div>
            <h2 className="region-resources__item-title">Свободная земля под запрос</h2>
            <p className="region-resources__text">
              Подходящих участков: {suitablePlots.length} из {matches.length}
            </p>
          </div>
          {activePlot ? (
            <div className="region-land__active-card">
              <span className="region-land__active-label">Выбранный участок</span>
              <strong>{activePlot.plot.title}</strong>
              <span>{activePlot.fitsRequest ? 'Полностью подходит' : 'Требует доработки'}</span>
            </div>
          ) : null}
        </div>

        <div className="region-land__map-frame">
          <MapContainerAny
            attributionControl={false}
            center={[region.location.lat, region.location.lon]}
            className="region-land__leaflet"
            scrollWheelZoom={false}
            zoom={7}
          >
            <TileLayerAny
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RegionBoundariesLayer
              activeRegionName={region.title}
              color="#315b93"
              activeColor="#dc2626"
              fitActiveBounds
              regionNames={[region.title]}
              weight={2}
              activeWeight={4}
            />
            {matches.map((item) => {
              const isActive = item.plot.id === activePlotId
              const color = getPlotColor(item.fitsRequest, isActive, item.plot.status)

              return (
                <CircleMarkerAny
                  center={[item.plot.location.lat, item.plot.location.lon]}
                  eventHandlers={{
                    click: () => setActivePlotId(item.plot.id),
                  }}
                  fillColor={color}
                  fillOpacity={0.85}
                  key={item.plot.id}
                  pathOptions={{ color }}
                  radius={isActive ? 13 : 9}
                  weight={isActive ? 4 : 2}
                >
                  <Popup>
                    <div className="region-land__popup">
                      <strong>{item.plot.title}</strong>
                      <span>{item.plot.description}</span>
                      <span>Площадь: {Math.round(item.plot.areaM2)} м2</span>
                      <span>Цена: {item.plot.priceMillionRub} млн руб.</span>
                      <span>Ж/д доступ: {item.plot.railwayAccess ? 'есть' : 'нет'}</span>
                      <span>Подходит: {item.fitsRequest ? 'да' : 'частично'}</span>
                    </div>
                  </Popup>
                </CircleMarkerAny>
              )
            })}
          </MapContainerAny>
        </div>

        <ul className="region-land__list">
          {matches.map((item) => {
            const isActive = item.plot.id === activePlotId
            return (
              <li className={`region-land__card ${isActive ? 'region-land__card--active' : ''}`} key={item.plot.id}>
                <button className="region-land__card-button" onClick={() => setActivePlotId(item.plot.id)} type="button">
                  <div className="region-land__card-head">
                    <strong>{item.plot.title}</strong>
                    <span className={`region-land__status ${item.fitsRequest ? 'region-land__status--ok' : 'region-land__status--warn'}`}>
                      {item.fitsRequest ? 'Подходит' : 'Есть ограничения'}
                    </span>
                  </div>
                  <p className="region-land__text">{item.plot.description}</p>
                  <div className="region-land__meta-grid">
                    <span>Площадь: {Math.round(item.plot.areaM2)} м2</span>
                    <span>Цена: {item.plot.priceMillionRub} млн руб.</span>
                    <span>До трассы: {formatKmOptional(item.plot.distanceToHighwayKm)}</span>
                    <span>До ж/д: {formatKmOptional(item.plot.distanceToRailwayKm)}</span>
                    <span>Мощность: {item.plot.powerKva} кВА</span>
                    <span>Вода: {item.plot.waterAvailable ? 'есть' : 'нет'}</span>
                    <span>Газ: {item.plot.gasAvailable ? 'есть' : 'нет'}</span>
                    <span>Владение: {item.plot.ownership}</span>
                    <span>Категория: {item.plot.landCategory}</span>
                  </div>
                  <div className="region-land__chips">
                    {item.plot.suitableFor.map((label) => (
                      <span className="region-land__chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                  {item.reasons.length > 0 ? (
                    <p className="region-land__reason">Ограничения: {item.reasons.join('; ')}</p>
                  ) : (
                    <p className="region-land__reason region-land__reason--ok">Полностью соответствует пользовательскому запросу.</p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Концепт-борд</h2>
        <div className="region-resources__board">
          <p className="region-resources__text">
            Стили: <strong>{region.metrics.culturalCode.styles.join(', ')}</strong>
          </p>
          <p className="region-resources__text">
            Материалы: <strong>{region.metrics.culturalCode.materials.join(', ')}</strong>
          </p>
          <div className="region-resources__palette">
            {region.metrics.culturalCode.colorProfile.map((color) => (
              <span className="region-resources__swatch" key={color}>
                {color}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">4 фотореалистичных рендера</h2>
        <ul className="region-resources__render-grid">
          {region.renders.map((render) => (
            <li className="region-resources__render-card" key={render.side}>
              <img alt={`${render.side} фасад`} className="region-resources__render-image" src={render.imageUrl} />
              <div className="region-resources__render-meta">
                <strong>{render.side}</strong>
                <span>{render.caption}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Интерактивная 3D-визуализация участка</h2>
        <div className="region-resources__viewer">
          {region.has3DModel ? (
            // Lazy-loaded ThreeViewer
            <ThreeViewer input={input} region={region} />
          ) : (
            <p className="region-resources__text">3D модель не предоставлена.</p>
          )}
        </div>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Аналитическая справка</h2>
        <div className="region-resources__columns">
          <div className="region-resources__about">
            <h3 className="region-resources__subheading">Социальный паспорт</h3>
            <p className="region-resources__text">Индекс городской среды: {analytics.socialPassport.urbanIndex}</p>
            <p className="region-resources__text">
              Мест в садах на 100 детей: {analytics.socialPassport.kindergartenPer100}
            </p>
            <p className="region-resources__text">Профильные колледжи: {analytics.socialPassport.collegesCount}</p>
            <p className="region-resources__text">Средняя аренда 1-комн.: {formatRub(analytics.socialPassport.rentRub)}</p>
          </div>

          <div className="region-resources__about">
            <h3 className="region-resources__subheading">Экономика региона</h3>
            <p className="region-resources__text">
              Налоговые льготы: {analytics.economy.hasTaxBenefits ? 'ТОР/ОЭЗ доступны' : 'не выявлены'}
            </p>
            <p className="region-resources__text">Страховые взносы: {analytics.economy.insuranceRate}%</p>
            <p className="region-resources__text">Энерготариф: {analytics.economy.energyTariffRubKwh} руб/кВт*ч</p>
            <p className="region-resources__text">
              Средняя зарплата: {formatRub(analytics.economy.avgSalaryRubMonth)}
            </p>
          </div>

          <div className="region-resources__about">
            <h3 className="region-resources__subheading">Сетевой блок</h3>
            <p className="region-resources__text">Газ: {analytics.network.gasAvailable ? 'магистральный' : 'не подведен'}</p>
            <p className="region-resources__text">Свободная мощность: {analytics.network.freePowerKva} кВА</p>
            <p className="region-resources__text">До подстанции: {formatKmOptional(analytics.network.substationDistanceKm)}</p>
            <p className="region-resources__text">
              Техприсоединение: {formatRub(analytics.network.connectionCostRubKw)} / кВт
            </p>
          </div>

          <div className="region-resources__about">
            <h3 className="region-resources__subheading">Логистика сырья</h3>
            <p className="region-resources__text">До поставщика стали: {formatKmOptional(analytics.rawLogistics.steelDistanceKm)}</p>
            <p className="region-resources__text">
              До поставщика утеплителя: {formatKmOptional(analytics.rawLogistics.insulationDistanceKm)}
            </p>
            <p className="region-resources__text">Радиус сбыта: {formatKmOptional(analytics.rawLogistics.marketRadiusKm)}</p>
            <p className="region-resources__text">Класс опасности производства: {hazardClass}</p>
          </div>
        </div>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Рекомендации по удержанию персонала</h2>
        <ul className="region-resources__sublist">
          {analytics.recommendations.map((item) => (
            <li className="region-resources__subitem" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Предварительная смета и площади</h2>
        <div className="region-resources__table-wrap">
          <table className="region-resources__table">
            <thead>
              <tr>
                <th>Объект</th>
                <th>Площадь, м2</th>
                <th>Стоимость</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.areaM2 ? Math.round(item.areaM2) : '-'}</td>
                  <td>{formatRub(item.amountRub)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Итого</td>
                <td>{Math.round(area.totalPlotM2)}</td>
                <td>{formatRub(estimate.totalRub)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="region-resources__block">
        <h2 className="region-resources__item-title">Презентация для администрации (6 слайдов)</h2>
        <ol className="region-resources__slides">
          {slides.map((slide) => (
            <li className="region-resources__slide" key={slide.index}>
              <h3 className="region-resources__subheading">
                Слайд {slide.index}. {slide.title}
              </h3>
              <p className="region-resources__text">{slide.content}</p>
            </li>
          ))}
        </ol>
      </section>

      <ul className="region-resources__sublist">
        <li className="region-resources__subitem">
          <a className="region-resources__link" href={region.conceptBoardUrl}>
            Открыть концепт-борд
          </a>
        </li>
        <li className="region-resources__subitem">
          <a className="region-resources__link" href={region.presentationUrl}>
            Скачать презентацию
          </a>
        </li>
      </ul>
    </section>
  )
}
