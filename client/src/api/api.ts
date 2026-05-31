import { regionsMock as exampleRegionsMock } from './regionMockData'

export type RegionId = 'bashkortostan' | 'moskovskaya-oblast' | 'sverdlovskaya-oblast' | 'krasnodarskiy-kray' | 'novosibirskaya-oblast'
export type InsulationType = 'ppu' | 'mineral-wool' | 'pps'
export type ArchitecturePriority = 'authentic' | 'tech' | 'eco'
export type HousingPercent = 0 | 30 | 50 | 70
export type HousingType = 'hostel' | 'apartments'

export interface UserInput {
    productionVolume: number
    employeesCount: number
    budgetMillionRub: number
    railwayRequired: boolean
    maxDistanceToHighwayKm: number
    architecturePriority: ArchitecturePriority
    landscaping: string[]
    housingPercent: HousingPercent
    housingType: HousingType
    kindergartenPlacesPer100: 0 | 15 | 30 | 50
    sports: string[]
    insulationType: InsulationType
}

export interface RegionMetrics {
    rawLogistics: {
        steelDistanceKm: number
        insulationDistanceKm: number
        marketRadiusKm: number
    }
    social: {
        urbanIndex: number
        kindergartenPer100: number
        collegesCount: number
        rentRub: number
    }
    economy: {
        hasTaxBenefits: boolean
        insuranceRate: number
        energyTariffRubKwh: number
        avgSalaryRubMonth: number
        ecologicalClassIza: number
    }
    network: {
        gasAvailable: boolean
        freePowerKva: number
        substationDistanceKm: number
        connectionCostRubKw: number
    }
    culturalCode: {
        styles: string[]
        materials: string[]
        colorProfile: string[]
    }
}

export interface RenderItem {
    side: 'Юг' | 'Север' | 'Запад' | 'Восток'
    imageUrl: string
    caption: string
}

export interface LandPlot {
    id: string
    title: string
    location: {
        lat: number
        lon: number
    }
    areaM2: number
    priceMillionRub: number
    distanceToHighwayKm: number
    distanceToRailwayKm: number
    railwayAccess: boolean
    powerKva: number
    gasAvailable: boolean
    waterAvailable: boolean
    ownership: 'муниципальная' | 'частная' | 'государственная'
    landCategory: 'промышленная' | 'смешанная' | 'коммерческая'
    status: 'available' | 'reserve'
    suitableFor: string[]
    description: string
}

export interface Region {
    id: RegionId
    title: string
    location: {
        lat: number
        lon: number
    }
    federalDistrict: string
    priorities: string[]
    imageUrl: string
    shortDescription: string
    renders: RenderItem[]
    landPlots: LandPlot[]
    has3DModel: boolean
    conceptBoardUrl: string
    presentationUrl: string
    metrics: RegionMetrics
}

export interface RankingResult {
    region: Region
    score: number
    details: {
        logistics: number
        social: number
        economy: number
        network: number
        cultural: number
    }
}

export interface AreaCalculation {
    workshopM2: number
    warehouseM2: number
    officeM2: number
    parkingM2: number
    roadsM2: number
    housingM2: number
    kindergartenM2: number
    canteenM2: number
    medicalPointM2: number
    totalPlotM2: number
}

export interface EstimateItem {
    name: string
    areaM2?: number
    amountRub: number
}

export interface EstimateResult {
    items: EstimateItem[]
    totalRub: number
}

export interface PresentationSlide {
    index: number
    title: string
    content: string
}

const priceNorms = {
    workshopWarehouse: 35000,
    office: 55000,
    housingHostel: 70000,
    housingApartments: 90000,
    kindergarten: 50000,
    canteen: 35000,
    medicalPoint: 45000,
    roadsParking: 5000,
    landscaping: 2000,
} as const

const sportObjectCosts: Record<string, number> = {
    Стадион: 5_000_000,
    Бассейн: 8_000_000,
    Спортзал: 3_000_000,
    'Хоккейная коробка': 2_000_000,
}

export const projectInputMock: UserInput = {
    productionVolume: 420,
    employeesCount: 120,
    budgetMillionRub: 180,
    railwayRequired: true,
    maxDistanceToHighwayKm: 25,
    architecturePriority: 'authentic',
    landscaping: ['Аллея', 'Сквер с фонтаном', 'Арт-объект'],
    housingPercent: 50,
    housingType: 'hostel',
    kindergartenPlacesPer100: 30,
    sports: ['Стадион', 'Спортзал'],
    insulationType: 'mineral-wool',
}

export const regionsMock: Region[] = exampleRegionsMock

const normalizeInverse = (value: number, min: number, max: number) => {
    const clamped = Math.min(Math.max(value, min), max)
    return 1 - (clamped - min) / (max - min)
}

const normalizeDirect = (value: number, min: number, max: number) => {
    const clamped = Math.min(Math.max(value, min), max)
    return (clamped - min) / (max - min)
}

export const getHazardClass = (insulationType: InsulationType) =>
    insulationType === 'ppu' ? 2 : 3

export const calculateArea = (input: UserInput): AreaCalculation => {
    const workshopM2 = input.productionVolume * 0.4
    const warehouseM2 = workshopM2 * 0.35
    const officeM2 = workshopM2 * 0.02
    const parkingM2 = input.employeesCount * 0.5 * 25
    const roadsM2 = (workshopM2 + warehouseM2) * 0.25
    const housingM2 =
        input.employeesCount * (input.housingPercent / 100) * (input.housingType === 'hostel' ? 25 : 40)
    const kindergartenM2 = (input.employeesCount / 100) * input.kindergartenPlacesPer100 * 15
    const canteenM2 = input.employeesCount * 0.5
    const medicalPointM2 = Math.max(input.employeesCount * 0.1, 20)
    const totalPlotM2 =
        workshopM2 +
        warehouseM2 +
        officeM2 +
        parkingM2 +
        roadsM2 +
        housingM2 +
        kindergartenM2 +
        canteenM2 +
        medicalPointM2

    return {
        workshopM2,
        warehouseM2,
        officeM2,
        parkingM2,
        roadsM2,
        housingM2,
        kindergartenM2,
        canteenM2,
        medicalPointM2,
        totalPlotM2,
    }
}

export const calculateEstimate = (input: UserInput): EstimateResult => {
    const area = calculateArea(input)
    const housingNorm = input.housingType === 'hostel' ? priceNorms.housingHostel : priceNorms.housingApartments
    const landscapingM2 = Math.max(area.totalPlotM2 * 0.14, input.landscaping.length * 500)

    const items: EstimateItem[] = [
        {
            name: 'Цех',
            areaM2: area.workshopM2,
            amountRub: area.workshopM2 * priceNorms.workshopWarehouse,
        },
        {
            name: 'Склад',
            areaM2: area.warehouseM2,
            amountRub: area.warehouseM2 * priceNorms.workshopWarehouse,
        },
        { name: 'АБК', areaM2: area.officeM2, amountRub: area.officeM2 * priceNorms.office },
        { name: 'Жилье', areaM2: area.housingM2, amountRub: area.housingM2 * housingNorm },
        {
            name: 'Детский сад',
            areaM2: area.kindergartenM2,
            amountRub: area.kindergartenM2 * priceNorms.kindergarten,
        },
        { name: 'Столовая', areaM2: area.canteenM2, amountRub: area.canteenM2 * priceNorms.canteen },
        {
            name: 'Медпункт',
            areaM2: area.medicalPointM2,
            amountRub: area.medicalPointM2 * priceNorms.medicalPoint,
        },
        {
            name: 'Дороги и парковка',
            areaM2: area.roadsM2 + area.parkingM2,
            amountRub: (area.roadsM2 + area.parkingM2) * priceNorms.roadsParking,
        },
        {
            name: 'Благоустройство',
            areaM2: landscapingM2,
            amountRub: landscapingM2 * priceNorms.landscaping,
        },
        {
            name: 'Спортобъекты',
            amountRub: input.sports.reduce((total, sport) => total + (sportObjectCosts[sport] ?? 900_000), 0),
        },
    ]

    const totalRub = items.reduce((sum, item) => sum + item.amountRub, 0)
    return { items, totalRub }
}

export const rankRegions = (input: UserInput, regions: Region[] = regionsMock): RankingResult[] => {
    return regions
        .map((region) => {
            const logisticsScore =
                normalizeInverse(region.metrics.rawLogistics.steelDistanceKm, 120, 420) * 0.45 +
                normalizeInverse(region.metrics.rawLogistics.insulationDistanceKm, 100, 320) * 0.35 +
                normalizeInverse(Math.abs(region.metrics.rawLogistics.marketRadiusKm - 400), 0, 200) * 0.2

            const socialScore =
                normalizeDirect(region.metrics.social.urbanIndex, 180, 260) * 0.35 +
                normalizeDirect(region.metrics.social.kindergartenPer100, 70, 100) * 0.25 +
                normalizeDirect(region.metrics.social.collegesCount, 3, 10) * 0.2 +
                normalizeInverse(region.metrics.social.rentRub, 28000, 45000) * 0.2

            const economyScore =
                (region.metrics.economy.hasTaxBenefits ? 1 : 0.2) * 0.35 +
                normalizeInverse(region.metrics.economy.energyTariffRubKwh, 4.5, 7.2) * 0.3 +
                normalizeInverse(region.metrics.economy.insuranceRate, 7.6, 30) * 0.2 +
                normalizeInverse(region.metrics.economy.ecologicalClassIza, 3.5, 7.5) * 0.15

            const networkScore =
                (region.metrics.network.gasAvailable ? 1 : 0.4) * 0.35 +
                normalizeDirect(region.metrics.network.freePowerKva, 350, 1000) * 0.3 +
                normalizeInverse(region.metrics.network.substationDistanceKm, 2, 12) * 0.2 +
                normalizeInverse(region.metrics.network.connectionCostRubKw, 2000, 5000) * 0.15

            const cultureWeight =
                input.architecturePriority === 'authentic'
                    ? 1
                    : input.architecturePriority === 'tech'
                        ? 0.82
                        : 0.88
            const culturalScore =
                normalizeDirect(region.metrics.culturalCode.styles.length, 1, 4) * 0.45 +
                normalizeDirect(region.metrics.culturalCode.materials.length, 1, 4) * 0.3 +
                normalizeDirect(region.metrics.culturalCode.colorProfile.length, 1, 4) * 0.25

            const totalScore =
                logisticsScore * 0.24 +
                socialScore * 0.2 +
                economyScore * 0.2 +
                networkScore * 0.21 +
                culturalScore * cultureWeight * 0.15

            return {
                region,
                score: Math.round(totalScore * 100),
                details: {
                    logistics: Math.round(logisticsScore * 100),
                    social: Math.round(socialScore * 100),
                    economy: Math.round(economyScore * 100),
                    network: Math.round(networkScore * 100),
                    cultural: Math.round(culturalScore * 100),
                },
            }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
}

export const buildPersonnelRecommendations = (input: UserInput, region: Region): string[] => {
    const recommendations: string[] = []

    if (input.housingPercent < 30) {
        recommendations.push('Увеличить покрытие жилья минимум до 30% для снижения текучести кадров.')
    } else {
        recommendations.push('Текущий уровень обеспечения жильем поддерживает стабильный набор персонала.')
    }

    if (region.metrics.network.substationDistanceKm > 15) {
        recommendations.push('Организовать корпоративный автобус из ближайшего населенного пункта.')
    } else {
        recommendations.push('Предусмотреть регулярный трансфер персонала до площадки в часы пик.')
    }

    if (input.kindergartenPlacesPer100 < 30) {
        recommendations.push('Рекомендуется увеличить емкость детского сада до 30 мест на 100 сотрудников.')
    }

    if (input.sports.length === 0) {
        recommendations.push('Добавить минимум один спортивный объект для HR-бренда работодателя.')
    }

    return recommendations
}

export const buildAnalyticalReference = (input: UserInput, region: Region) => {
    const estimate = calculateEstimate(input)

    return {
        socialPassport: {
            urbanIndex: region.metrics.social.urbanIndex,
            kindergartenPer100: region.metrics.social.kindergartenPer100,
            collegesCount: region.metrics.social.collegesCount,
            rentRub: region.metrics.social.rentRub,
        },
        economy: {
            hasTaxBenefits: region.metrics.economy.hasTaxBenefits,
            insuranceRate: region.metrics.economy.insuranceRate,
            energyTariffRubKwh: region.metrics.economy.energyTariffRubKwh,
            avgSalaryRubMonth: region.metrics.economy.avgSalaryRubMonth,
            ecologicalClassIza: region.metrics.economy.ecologicalClassIza,
        },
        network: {
            gasAvailable: region.metrics.network.gasAvailable,
            freePowerKva: region.metrics.network.freePowerKva,
            substationDistanceKm: region.metrics.network.substationDistanceKm,
            connectionCostRubKw: region.metrics.network.connectionCostRubKw,
        },
        rawLogistics: {
            steelDistanceKm: region.metrics.rawLogistics.steelDistanceKm,
            insulationDistanceKm: region.metrics.rawLogistics.insulationDistanceKm,
            marketRadiusKm: region.metrics.rawLogistics.marketRadiusKm,
        },
        recommendations: buildPersonnelRecommendations(input, region),
        preliminaryEstimateRub: estimate.totalRub,
    }
}

export interface LandPlotMatch {
    plot: LandPlot
    fitsRequest: boolean
    reasons: string[]
    areaGapM2: number
}

export const buildLandPlotMatches = (input: UserInput, region: Region): LandPlotMatch[] => {
    const requiredArea = calculateArea(input).totalPlotM2

    return region.landPlots.map((plot) => {
        const reasons: string[] = []

        if (plot.areaM2 < requiredArea) {
            reasons.push(`Нужно ${Math.round(requiredArea)} м2, доступно ${Math.round(plot.areaM2)} м2`)
        }

        if (plot.distanceToHighwayKm > input.maxDistanceToHighwayKm) {
            reasons.push(
                `До трассы ${plot.distanceToHighwayKm} км, лимит пользователя ${input.maxDistanceToHighwayKm} км`,
            )
        }

        if (input.railwayRequired && !plot.railwayAccess) {
            reasons.push('Пользователю нужна железная дорога, а на участке нет ж/д доступа')
        }

        // Бюджет теперь не используется для жёсткой фильтрации участка на фронтенде.
        // Если смета участка превышает бюджет — это фиксируется в скоринге на бэкенде и отображается как минус.

        return {
            plot,
            fitsRequest: reasons.length === 0,
            reasons,
            areaGapM2: Math.max(requiredArea - plot.areaM2, 0),
        }
    })
}

export const buildPresentationSlides = (
    input: UserInput,
    region: Region,
    ranking: RankingResult,
): PresentationSlide[] => {
    const jobs = input.employeesCount
    const estimate = calculateEstimate(input)
    const hazardClass = getHazardClass(input.insulationType)

    return [
        { index: 1, title: 'Титул', content: `Проект размещения завода сэндвич-панелей в регионе ${region.title}.` },
        {
            index: 2,
            title: 'Параметры проекта и рабочие места',
            content: `Объем ${input.productionVolume} тыс. м2/год, сотрудников ${jobs}, бюджет ${input.budgetMillionRub} млн руб.`,
        },
        {
            index: 3,
            title: '4 рендера 2x2',
            content: region.renders.map((render) => `${render.side}: ${render.caption}`).join(' | '),
        },
        {
            index: 4,
            title: 'План участка с соцобъектами',
            content: `Включены детский сад, спорт и столовая. Благоустройство: ${input.landscaping.join(', ')}.`,
        },
        {
            index: 5,
            title: 'Нормативы и сетевые условия',
            content: `Класс опасности ${hazardClass}, газ ${region.metrics.network.gasAvailable ? 'есть' : 'нет'}, мощность ${region.metrics.network.freePowerKva} кВА.`,
        },
        {
            index: 6,
            title: 'Экономика и выгоды региона',
            content: `Итоговый рейтинг ${ranking.score}/100, энерготариф ${region.metrics.economy.energyTariffRubKwh} руб/кВт*ч, смета ${Math.round(estimate.totalRub / 1_000_000)} млн руб.`,
        },
    ]
}

export const topRegionsMock: Region[] = rankRegions(projectInputMock).map((item) => item.region)
export const currentRegionMock: Region = topRegionsMock[0]