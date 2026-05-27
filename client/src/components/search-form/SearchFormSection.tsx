import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitFormRequest, type FormRequest } from '../../api/gateway'
import { saveProjectInput, saveTopRegions } from '../../api/session'

const LANDSCAPING_OPTIONS = [
  'Аллея',
  'Сквер с фонтаном',
  'Беседки',
  'Сцена',
  'Тропа здоровья',
  'Пруд',
  'Арт-объект',
]

const SPORT_OPTIONS = ['Уличные тренажёры', 'Стадион', 'Бассейн', 'Спортзал', 'Хоккейная коробка']

export function SearchFormSection() {
  const navigate = useNavigate()
  const [landscaping, setLandscaping] = useState<string[]>([])
  const [sports, setSports] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleOption = (
    value: string,
    selected: string[],
    setSelected: (options: string[]) => void,
    limit: number,
  ) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value))
      return
    }

    if (selected.length < limit) {
      setSelected([...selected, value])
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (isSubmitting) {
      return
    }

    const formData = new FormData(event.currentTarget)

    const input: FormRequest = {
      productionVolume: Number(formData.get('productionVolume') ?? 300),
      employeesCount: Number(formData.get('employeesCount') ?? 80),
      budgetMillionRub: Number(formData.get('budgetValue') ?? 120),
      railwayRequired: String(formData.get('railwayNeeded')) === 'yes',
      maxDistanceToHighwayKm: Number(formData.get('roadDistance') ?? 35),
      architecturePriority: String(formData.get('architecturePriority')) as FormRequest['architecturePriority'],
      landscaping,
      housingPercent: Number(formData.get('housingPercent') ?? 0) as FormRequest['housingPercent'],
      housingType: String(formData.get('housingType')) as FormRequest['housingType'],
      kindergartenPlacesPer100: Number(formData.get('kindergartenPlaces') ?? 0) as FormRequest['kindergartenPlacesPer100'],
      sports,
    }

    try {
      setIsSubmitting(true)
      const regions = await submitFormRequest(input)
      saveProjectInput(input)
      saveTopRegions(regions)
      navigate('/top-regions')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось получить результаты от gateway-service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="search-section">
      <div className="container search-section__inner">
        <h1 className="search-section__title">Поиск региона для размещения производства</h1>
        <p className="search-section__subtitle">Заполните форму, чтобы получить подборку площадок</p>

        <form className="search-form" action="#" method="get" onSubmit={handleSubmit}>
          <div className="search-form__group">
            <h2 className="search-form__group-title">3.1 Производство</h2>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="production-volume">
                1. Объем выпуска (тыс. м2 панелей в год):
              </label>
              <input
                className="search-form__control"
                id="production-volume"
                name="productionVolume"
                type="number"
                min={100}
                max={1000}
                defaultValue={300}
                required
              />
            </div>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="employees-count">
                2. Количество сотрудников:
              </label>
              <input
                className="search-form__control"
                id="employees-count"
                name="employeesCount"
                type="number"
                min={10}
                max={200}
                defaultValue={80}
                required
              />
            </div>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="budget-value">
                3. Бюджет на участок и подключение к сетям (млн руб):
              </label>
              <input
                className="search-form__control"
                id="budget-value"
                name="budgetValue"
                type="number"
                min={10}
                max={300}
                defaultValue={120}
                required
              />
            </div>

          </div>

          <div className="search-form__group">
            <h2 className="search-form__group-title">3.2 Логистика</h2>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="railway-needed">
                4. Необходима ж/д ветка:
              </label>
              <select className="search-form__control" id="railway-needed" name="railwayNeeded">
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </div>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="road-distance">
                5. Макс. расстояние до федеральной трассы (км):
              </label>
              <input
                className="search-form__control"
                id="road-distance"
                name="roadDistance"
                type="number"
                min={1}
                max={100}
                defaultValue={35}
                required
              />
            </div>
          </div>

          <div className="search-form__group">
            <h2 className="search-form__group-title">3.3 Архитектура и стиль</h2>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="architecture-priority">
                6. Архитектурный приоритет:
              </label>
              <select
                className="search-form__control"
                id="architecture-priority"
                name="architecturePriority"
              >
                <option value="authentic">Аутентичность региону</option>
                <option value="tech">Техно-стиль</option>
                <option value="eco">Экодизайн</option>
              </select>
            </div>

            <fieldset className="search-form__field search-form__fieldset">
              <legend className="search-form__label">
                7. Благоустройство (выбор до 3 пунктов):
              </legend>
              <div className="search-form__chips">
                {LANDSCAPING_OPTIONS.map((option) => {
                  const checked = landscaping.includes(option)
                  return (
                    <label
                      className={`search-form__chip ${checked ? 'search-form__chip--active' : ''}`}
                      key={option}
                    >
                      <input
                        className="search-form__chip-input"
                        type="checkbox"
                        name="landscaping"
                        value={option}
                        checked={checked}
                        onChange={() => toggleOption(option, landscaping, setLandscaping, 3)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                })}
              </div>
              <p className="search-form__counter">Выбрано: {landscaping.length} / 3</p>
            </fieldset>
          </div>

          <div className="search-form__group">
            <h2 className="search-form__group-title">3.4 Социальные приоритеты</h2>

            <div className="search-form__field search-form__field--inline">
              <label className="search-form__label" htmlFor="housing-percent">
                8. Обеспечение жильем сотрудников:
              </label>
              <div className="search-form__inline-controls">
                <select className="search-form__control" id="housing-percent" name="housingPercent">
                  <option value="0">0%</option>
                  <option value="30">30%</option>
                  <option value="50">50%</option>
                  <option value="70">70%</option>
                </select>
                <select className="search-form__control" id="housing-type" name="housingType">
                  <option value="hostel">Общежитие</option>
                  <option value="apartments">Квартиры</option>
                </select>
              </div>
            </div>

            <div className="search-form__field">
              <label className="search-form__label" htmlFor="kindergarten-places">
                9. Детский сад (мест на 100 сотрудников):
              </label>
              <select className="search-form__control" id="kindergarten-places" name="kindergartenPlaces">
                <option value="0">0</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
            </div>

            <fieldset className="search-form__field search-form__fieldset">
              <legend className="search-form__label">10. Спорт (выбор до 2 пунктов):</legend>
              <div className="search-form__chips">
                {SPORT_OPTIONS.map((option) => {
                  const checked = sports.includes(option)
                  return (
                    <label
                      className={`search-form__chip ${checked ? 'search-form__chip--active' : ''}`}
                      key={option}
                    >
                      <input
                        className="search-form__chip-input"
                        type="checkbox"
                        name="sports"
                        value={option}
                        checked={checked}
                        onChange={() => toggleOption(option, sports, setSports, 2)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                })}
              </div>
              <p className="search-form__counter">Выбрано: {sports.length} / 2</p>
            </fieldset>
          </div>

          {error ? <p className="search-form__counter">Ошибка: {error}</p> : null}

          <button className="search-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Подбираем регионы...' : 'Найти участок'}
          </button>
        </form>
      </div>
    </section>
  )
}
