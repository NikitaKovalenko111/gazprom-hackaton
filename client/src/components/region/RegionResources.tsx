import {
  buildAnalyticalReference,
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

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    value,
  )

export function RegionResources({ region, input, ranking }: RegionResourcesProps) {
  const analytics = buildAnalyticalReference(input, region)
  const area = calculateArea(input)
  const estimate = calculateEstimate(input)
  const slides = buildPresentationSlides(input, region, ranking)
  const hazardClass = getHazardClass(input.insulationType)

  return (
    <section className="region-resources" aria-label="Материалы региона">
      <h1 className="region-resources__title">Страница региона: {region.title}</h1>
      <p className="region-resources__subtitle">Итоговый рейтинг региона: {ranking.score} / 100</p>

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
          <p className="region-resources__text">
            {region.has3DModel
              ? '3D сцена готова к подключению Three.js (вращение, масштабирование, переключение слоев).'
              : '3D модель не предоставлена.'}
          </p>
          <div className="region-resources__viewer-controls">
            <button className="region-resources__viewer-btn" type="button">
              Вид сверху
            </button>
            <button className="region-resources__viewer-btn" type="button">
              Вращение
            </button>
            <button className="region-resources__viewer-btn" type="button">
              Слои
            </button>
          </div>
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
            <p className="region-resources__text">
              До подстанции: {analytics.network.substationDistanceKm} км
            </p>
            <p className="region-resources__text">
              Техприсоединение: {formatRub(analytics.network.connectionCostRubKw)} / кВт
            </p>
          </div>

          <div className="region-resources__about">
            <h3 className="region-resources__subheading">Логистика сырья</h3>
            <p className="region-resources__text">До поставщика стали: {analytics.rawLogistics.steelDistanceKm} км</p>
            <p className="region-resources__text">
              До поставщика утеплителя: {analytics.rawLogistics.insulationDistanceKm} км
            </p>
            <p className="region-resources__text">Радиус сбыта: {analytics.rawLogistics.marketRadiusKm} км</p>
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
