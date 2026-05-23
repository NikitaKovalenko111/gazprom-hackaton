export type RegionId = 'primorskiy-kray' | 'hanty-mansi-ao' | 'sahalinskaya-oblast'
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

export const regionsMock: Region[] = [
    {
        id: 'primorskiy-kray',
        title: 'Приморский край',
        location: { lat: 43.1155, lon: 131.8855 },
        federalDistrict: 'Дальневосточный федеральный округ',
        priorities: ['Логистика', 'Промышленность', 'Туризм'],
        imageUrl:
            'https://images.unsplash.com/photo-1547448415-e9f5b28e570d?auto=format&fit=crop&w=1000&q=80',
        shortDescription:
            'Портовая инфраструктура, экспортный потенциал и кадровый резерв для масштабирования производства.',
        renders: [
            {
                side: 'Юг',
                caption: 'Южный фасад с общественным пространством',
                imageUrl:
                    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Север',
                caption: 'Северный фасад и логистический периметр',
                imageUrl:
                    'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Запад',
                caption: 'Западный фасад с технологическим въездом',
                imageUrl:
                    'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Восток',
                caption: 'Восточный фасад с рекреационной зоной',
                imageUrl:
                    'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1200&q=80',
            },
        ],
        landPlots: [
            {
                id: 'vladivostok-tech-park',
                title: 'Технопарк у Владивостокского шоссе',
                location: { lat: 43.1355, lon: 131.9202 },
                areaM2: 182000,
                priceMillionRub: 148,
                distanceToHighwayKm: 2.4,
                distanceToRailwayKm: 4.1,
                railwayAccess: true,
                powerKva: 980,
                gasAvailable: true,
                waterAvailable: true,
                ownership: 'муниципальная',
                landCategory: 'промышленная',
                status: 'available',
                suitableFor: ['Промышленная сборка', 'Логистический хаб', 'Административный корпус'],
                description: 'Площадка с удобным выездом на магистраль и готовыми сетевыми лимитами.',
            },
            {
                id: 'ussuriysk-industrial',
                title: 'Индустриальная зона Уссурийска',
                location: { lat: 43.8121, lon: 132.2765 },
                areaM2: 256000,
                priceMillionRub: 176,
                distanceToHighwayKm: 5.8,
                distanceToRailwayKm: 2.6,
                railwayAccess: true,
                powerKva: 1120,
                gasAvailable: true,
                waterAvailable: true,
                ownership: 'государственная',
                landCategory: 'промышленная',
                status: 'available',
                suitableFor: ['Производство', 'Складской комплекс', 'Благоустройство'],
                description: 'Крупный участок под промышленный кластер с железнодорожной логистикой.',
            },
            {
                id: 'nachalovo-reserve',
                title: 'Резервная площадка на юге края',
                location: { lat: 43.0284, lon: 131.9847 },
                areaM2: 138000,
                priceMillionRub: 112,
                distanceToHighwayKm: 3.3,
                distanceToRailwayKm: 7.4,
                railwayAccess: false,
                powerKva: 760,
                gasAvailable: true,
                waterAvailable: false,
                ownership: 'частная',
                landCategory: 'смешанная',
                status: 'reserve',
                suitableFor: ['Очередь развития', 'Складские площади', 'Площадка под расширение'],
                description: 'Резерв под расширение проекта, требует донастройки по воде.',
            },
        ],
        has3DModel: true,
        conceptBoardUrl: '#',
        presentationUrl: '#',
        metrics: {
            rawLogistics: { steelDistanceKm: 240, insulationDistanceKm: 180, marketRadiusKm: 420 },
            social: { urbanIndex: 227, kindergartenPer100: 84, collegesCount: 8, rentRub: 34000 },
            economy: {
                hasTaxBenefits: true,
                insuranceRate: 7.6,
                energyTariffRubKwh: 6.1,
                avgSalaryRubMonth: 91000,
                ecologicalClassIza: 5.2,
            },
            network: {
                gasAvailable: true,
                freePowerKva: 920,
                substationDistanceKm: 4.2,
                connectionCostRubKw: 2800,
            },
            culturalCode: {
                styles: ['Морской индустриальный модерн', 'Локальная аутентика'],
                materials: ['Металл', 'Стекло', 'Дерево лиственницы'],
                colorProfile: ['Графит', 'Туманно-синий', 'Светлый песок'],
            },
        },
    },
    {
        id: 'hanty-mansi-ao',
        title: 'ХМАО - Югра',
        location: { lat: 61.0042, lon: 69.0019 },
        federalDistrict: 'Уральский федеральный округ',
        priorities: ['Нефтегазовый сектор', 'Инфраструктура', 'Технологии'],
        imageUrl:
            'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1000&q=80',
        shortDescription:
            'Высокий уровень доходов, стабильная энергосистема и крупные индустриальные заказчики.',
        renders: [
            {
                side: 'Юг',
                caption: 'Южный фасад с акцентом на энергоэффективность',
                imageUrl:
                    'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Север',
                caption: 'Северный фасад с ветровой защитой',
                imageUrl:
                    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Запад',
                caption: 'Западный фасад административного блока',
                imageUrl:
                    'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Восток',
                caption: 'Восточный фасад складской зоны',
                imageUrl:
                    'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1200&q=80',
            },
        ],
        landPlots: [
            {
                id: 'surgut-industrial-1',
                title: 'Сургутская индустриальная площадка',
                location: { lat: 61.0257, lon: 69.0892 },
                areaM2: 214000,
                priceMillionRub: 132,
                distanceToHighwayKm: 1.7,
                distanceToRailwayKm: 5.2,
                railwayAccess: true,
                powerKva: 1280,
                gasAvailable: true,
                waterAvailable: true,
                ownership: 'муниципальная',
                landCategory: 'промышленная',
                status: 'available',
                suitableFor: ['Производственный корпус', 'Энергоемкое производство', 'Склад'],
                description: 'Площадка в зоне с развитой инженерией и высокой доступной мощностью.',
            },
            {
                id: 'nyagan-logistics',
                title: 'Логистический участок у Нягани',
                location: { lat: 62.1441, lon: 65.4323 },
                areaM2: 168000,
                priceMillionRub: 96,
                distanceToHighwayKm: 4.9,
                distanceToRailwayKm: 1.9,
                railwayAccess: true,
                powerKva: 840,
                gasAvailable: true,
                waterAvailable: true,
                ownership: 'государственная',
                landCategory: 'смешанная',
                status: 'available',
                suitableFor: ['Складской комплекс', 'Логистический центр', 'Подъездные пути'],
                description: 'Оптимален под распределительный склад с железнодорожным плечом.',
            },
            {
                id: 'khmao-reserve-east',
                title: 'Восточный резерв ХМАО',
                location: { lat: 60.892, lon: 69.3154 },
                areaM2: 124000,
                priceMillionRub: 84,
                distanceToHighwayKm: 6.2,
                distanceToRailwayKm: 8.3,
                railwayAccess: false,
                powerKva: 620,
                gasAvailable: false,
                waterAvailable: true,
                ownership: 'частная',
                landCategory: 'коммерческая',
                status: 'reserve',
                suitableFor: ['Резерв развития', 'Соцобъекты', 'Склад облегченного типа'],
                description: 'Резервная территория, подходит при отсутствии требования по железной дороге.',
            },
        ],
        has3DModel: true,
        conceptBoardUrl: '#',
        presentationUrl: '#',
        metrics: {
            rawLogistics: { steelDistanceKm: 360, insulationDistanceKm: 250, marketRadiusKm: 360 },
            social: { urbanIndex: 242, kindergartenPer100: 92, collegesCount: 6, rentRub: 31000 },
            economy: {
                hasTaxBenefits: true,
                insuranceRate: 7.6,
                energyTariffRubKwh: 5.5,
                avgSalaryRubMonth: 103000,
                ecologicalClassIza: 4.7,
            },
            network: {
                gasAvailable: true,
                freePowerKva: 860,
                substationDistanceKm: 5.8,
                connectionCostRubKw: 2500,
            },
            culturalCode: {
                styles: ['Северный техно-минимализм', 'Индустриальная лаконика'],
                materials: ['Металл', 'Композит', 'Древесина'],
                colorProfile: ['Серебристый', 'Ледяной белый', 'Угольный'],
            },
        },
    },
    {
        id: 'sahalinskaya-oblast',
        title: 'Сахалинская область',
        location: { lat: 46.9592, lon: 142.738 },
        federalDistrict: 'Дальневосточный федеральный округ',
        priorities: ['Энергетика', 'Логистика', 'Переработка'],
        imageUrl:
            'https://images.unsplash.com/photo-1504814532849-927d7d9df391?auto=format&fit=crop&w=1000&q=80',
        shortDescription:
            'Сильный энергетический контур, морская логистика и потенциал промышленного кластера.',
        renders: [
            {
                side: 'Юг',
                caption: 'Южный фасад с входной группой',
                imageUrl:
                    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Север',
                caption: 'Северный фасад с ветровыми экранами',
                imageUrl:
                    'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Запад',
                caption: 'Западный фасад логистического блока',
                imageUrl:
                    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
            },
            {
                side: 'Восток',
                caption: 'Восточный фасад с благоустройством',
                imageUrl:
                    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
            },
        ],
        landPlots: [
            {
                id: 'yuzhno-sakhalinsk-tech',
                title: 'Южно-Сахалинский техплощадка',
                location: { lat: 46.9458, lon: 142.7433 },
                areaM2: 201000,
                priceMillionRub: 155,
                distanceToHighwayKm: 2.1,
                distanceToRailwayKm: 3.8,
                railwayAccess: true,
                powerKva: 940,
                gasAvailable: false,
                waterAvailable: true,
                ownership: 'муниципальная',
                landCategory: 'промышленная',
                status: 'available',
                suitableFor: ['Переработка', 'Сборка', 'Инженерный центр'],
                description: 'Площадка рядом с городской инфраструктурой и подъездом к морской логистике.',
            },
            {
                id: 'korsakov-port-zone',
                title: 'Портовая зона Корсакова',
                location: { lat: 46.6359, lon: 142.7901 },
                areaM2: 233000,
                priceMillionRub: 188,
                distanceToHighwayKm: 3.4,
                distanceToRailwayKm: 6.6,
                railwayAccess: true,
                powerKva: 1150,
                gasAvailable: false,
                waterAvailable: true,
                ownership: 'государственная',
                landCategory: 'промышленная',
                status: 'available',
                suitableFor: ['Портовая логистика', 'Склад', 'Отгрузка готовой продукции'],
                description: 'Подходит для морского плеча и крупнотоннажной отгрузки.',
            },
            {
                id: 'aniva-reserve',
                title: 'Резерв Антивы',
                location: { lat: 46.7133, lon: 142.5222 },
                areaM2: 148000,
                priceMillionRub: 101,
                distanceToHighwayKm: 5.5,
                distanceToRailwayKm: 10.4,
                railwayAccess: false,
                powerKva: 680,
                gasAvailable: false,
                waterAvailable: false,
                ownership: 'частная',
                landCategory: 'смешанная',
                status: 'reserve',
                suitableFor: ['Резерв расширения', 'Офисно-складской формат', 'Локальный сервис'],
                description: 'Запасной участок для расширения очередей проекта в будущем.',
            },
        ],
        has3DModel: true,
        conceptBoardUrl: '#',
        presentationUrl: '#',
        metrics: {
            rawLogistics: { steelDistanceKm: 290, insulationDistanceKm: 230, marketRadiusKm: 390 },
            social: { urbanIndex: 214, kindergartenPer100: 80, collegesCount: 5, rentRub: 42000 },
            economy: {
                hasTaxBenefits: true,
                insuranceRate: 7.6,
                energyTariffRubKwh: 6.8,
                avgSalaryRubMonth: 98000,
                ecologicalClassIza: 4.9,
            },
            network: {
                gasAvailable: false,
                freePowerKva: 740,
                substationDistanceKm: 7.1,
                connectionCostRubKw: 3400,
            },
            culturalCode: {
                styles: ['Прибрежный индустриальный стиль', 'Сдержанная эклектика'],
                materials: ['Фибробетон', 'Металл', 'Локальный камень'],
                colorProfile: ['Штормовой серый', 'Глубокий синий', 'Светлый гранит'],
            },
        },
    },
]

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

        if (plot.priceMillionRub > input.budgetMillionRub) {
            reasons.push(`Цена ${plot.priceMillionRub} млн руб. выше бюджета ${input.budgetMillionRub} млн руб.`)
        }

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