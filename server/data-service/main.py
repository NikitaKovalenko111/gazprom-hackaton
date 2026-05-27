import json
import copy
import statistics
import math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# --- 1. PYDANTIC МОДЕЛИ ДЛЯ ВЫВОДА ---

class SocialInfrastructure(BaseModel):
    urban_environment_index: int
    kindergarten_availability_per_100_children: int
    average_1room_apartment_rent_rub: int
    profile_colleges_budget_places: int

class RegionEconomy(BaseModel):
    has_tax_incentives_tor_oez: bool
    tax_incentives_description: str
    has_reduced_insurance_contributions: bool
    industrial_electricity_tariff_rub_kwh: float
    average_monthly_salary_rub: int
    ecological_class_iza: str

class NetworkInfrastructure(BaseModel):
    available_electrical_capacity_kva: int
    technological_connection_fee_rub_kw: int

class ColorProfile(BaseModel):
    primary: str
    secondary: str
    accent: str
    description: str

class CulturalCode(BaseModel):
    dominant_architectural_styles: List[str]
    traditional_materials_ornaments: List[str]
    color_profile: ColorProfile

# Модель региона теперь содержит сырые и дополненные данными площадки
class RegionInfo(BaseModel):
    region_name: str
    region_lat: float
    region_lon: float
    social_infrastructure: SocialInfrastructure
    economy: RegionEconomy
    network_infrastructure: NetworkInfrastructure
    cultural_code: CulturalCode
    places: List[dict]  # Каждая площадка внутри будет содержать свой индивидуальный estimate и insights

# --- МОДЕЛИ ДЛЯ СМЕТЫ И СКОРИНГА ---

class UserRequest(BaseModel):
    productionVolume: int
    employeesCount: int
    budgetMillionRub: int
    railwayRequired: bool
    maxDistanceToHighwayKm: int
    architecturePriority: str
    landscaping: List[str]
    housingPercent: int
    housingType: str
    kindergartenPlacesPer100: int
    sports: List[str]


class ScoreBreakdown(BaseModel):
    logistics: float
    energy: float
    labor: float
    social: float
    economy: float

class WhyInsights(BaseModel):
    top_factor: str
    pros: List[str]
    cons: List[str]
    risks: List[str]

# ФИНАЛЬНЫЙ СКОР С УБРАННЫМ ESTIMATE С ВЕРХНЕГО УРОВНЯ
class ScoredPlace(BaseModel):
    region_name: str
    place_address: str
    score: float
    confidence: float
    breakdown: ScoreBreakdown
    why: WhyInsights
    region_info: RegionInfo  # Смета теперь находится внутри region_info.places


# --- 2. ИНИЦИАЛИЗАЦИЯ СЕРВИСА ---

app = FastAPI(title="Location Scoring Service - Precision Finance Edition")

try:
    with open("regions_enriched.json", "r", encoding="utf-8") as f:
        REGIONS_DB = json.load(f)
except FileNotFoundError:
    REGIONS_DB = []
    print("ВНИМАНИЕ: Файл regions_enriched.json не найден!")


# ---  Initialize reference ranges (robust percentiles) ---
def _compute_ref_ranges(db):
    tariffs = []
    salaries = []
    region_costs = []
    for r in (db or []):
        t = r.get("economy", {}).get("industrial_electricity_tariff_rub_kwh")
        if t is not None:
            tariffs.append(float(t))
        s = r.get("economy", {}).get("average_monthly_salary_rub")
        if s is not None:
            salaries.append(float(s))
        # estimate region cost via median of place prices + conn
        places = r.get("places", []) or []
        conn_fee = r.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw", 10000)
        conn_cost_mln = (500 * conn_fee) / 1_000_000.0
        for p in places:
            pr = p.get("price_rub", p.get("price", None))
            try:
                pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
            except Exception:
                pr_mln = 0.0
            region_costs.append(pr_mln + conn_cost_mln)

    def _p(bounds, default_low, default_high):
        if not bounds:
            return default_low, default_high
        sorted_b = sorted(bounds)
        n = len(sorted_b)
        p5 = sorted_b[max(0, int(n*0.05)-1)]
        p95 = sorted_b[min(n-1, int(n*0.95))]
        if p5 == p95:
            return default_low, default_high
        return p5, p95

    TAR_MIN, TAR_MAX = _p(tariffs, 3.0, 8.0)
    SAL_MIN, SAL_MAX = _p(salaries, 30000.0, 120000.0)
    CAPEX_MIN, CAPEX_MAX = _p(region_costs, 10.0, 400.0)
    return {
        "tariff": (TAR_MIN, TAR_MAX),
        "salary": (SAL_MIN, SAL_MAX),
        "capex": (CAPEX_MIN, CAPEX_MAX),
    }

REF_RANGES = _compute_ref_ranges(REGIONS_DB)

def normalize(value, min_val, max_val):
    if max_val == min_val: return 0.0
    if value <= min_val: return 0.0
    if value >= max_val: return 1.0
    return (value - min_val) / (max_val - min_val)

ECO_MAP = {"Низкий": 0.0, "Средний": 0.05, "Повышенный": 0.1}

# keywords considered negative in explainability texts (used for safe classification)
NEGATIVE_KEYWORDS = [
    "не укладывается",
    "превышает",
    "высокая сметная стоимость",
    "ухудш",
    "снижает",
    "превышает",
]


# --- 3. ФИЛЬТРЫ И ИЗВЛЕЧЕНИЕ ФИЧ ---

def passes_filters(place, user_req: UserRequest) -> bool:
    square = place.get("square", place.get("square_m2", 0))
    min_required_square = user_req.productionVolume * 10
    if square < min_required_square:
        return False
    
    dist_power = place.get("distance_to_the_nearest_electric_substation", 
                           place.get("distance_to_the_nearest_electric_substation_km", 999))
    if dist_power > 100:
        return False
        
    return True

def compute_features(region, place):
    return {
        "square": place.get("square", place.get("square_m2", 0)),
        "dist_steel": place.get("distance_to_the_supplier_of_rolled_steel", 
                                place.get("distance_to_the_supplier_of_rolled_steel_km", 100)),
        "dist_insulation": place.get("distance_to_the_insulation_supplier", 
                                     place.get("distance_to_the_insulation_supplier_km", 100)),
        "dist_power": place.get("distance_to_the_nearest_electric_substation", 
                                place.get("distance_to_the_nearest_electric_substation_km", 10)),
        "tariff": region.get("economy", {}).get("industrial_electricity_tariff_rub_kwh", 5.0),
        "power_capacity": region.get("network_infrastructure", {}).get("available_electrical_capacity_kva", 0),
        "connection_fee": region.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw", 10000),
        "salary": region.get("economy", {}).get("average_monthly_salary_rub", 50000),
        "kindergarten": region.get("social_infrastructure", {}).get("kindergarten_availability_per_100_children", 50),
        "has_benefits": region.get("economy", {}).get("has_tax_incentives_tor_oez", False),
        "place_benefits": place.get("benefits", None),
        "ecology_class": region.get("economy", {}).get("ecological_class_iza", "Средний"),
        "dist_railway": place.get("distance_to_the_nearest_railway_station_km", None),
        "has_railway": place.get("has_railway", None),
        "dist_highway": place.get("distance_to_highway_km", None),
        # Цена участка (руб) — может быть указана как price_rub или price
        "price_rub": place.get("price_rub", place.get("price", None))
    }


def infer_insulation_type(features, user_req: UserRequest):
    """Детерминированная эвристика выбора типа утеплителя.

    Возвращает dict:
      - type: 'PPU'|'MINVATA'|'PPS'
      - reason: объяснение выбора (строка на русском)
      - effects: {energy_multiplier, risk_modifier, cost_multiplier}

    Правила (приоритетные):
      1) Безопасность: если ecology_class == 'Повышенный' -> Минвата (негорючий)
      2) Энергоэффективность: большой объем производства -> ППУ
      3) Бюджет: ограниченный бюджет -> ППС
      4) Дефолт: ППУ
    """
    ecology = (features.get("ecology_class") or "Средний")
    prod = getattr(user_req, "productionVolume", 0)
    employees = getattr(user_req, "employeesCount", 0)
    budget = getattr(user_req, "budgetMillionRub", 0)

    # Пороговые значения — интерпретируемые и детерминированные
    LARGE_PRODUCTION_THRESHOLD = 500
    LOW_BUDGET_THRESHOLD = 40

    # 1) Safety
    if isinstance(ecology, str) and ecology.lower().startswith("повыш"):
        return {
            "type": "MINVATA",
            "reason": "Повышенный экологический/промышленный риск — выбираем негорючий материал (Минвата).",
            "effects": {"energy_multiplier": 0.0, "risk_modifier": -0.05, "cost_multiplier": 1.0},
        }

    # 2) Energy efficiency for large production
    if prod >= LARGE_PRODUCTION_THRESHOLD or employees >= 200:
        return {
            "type": "PPU",
            "reason": "Большой объем производства требует высокоэффективного утеплителя с минимальными теплопотерями (ППУ).",
            "effects": {"energy_multiplier": 0.05, "risk_modifier": 0.0, "cost_multiplier": 1.12},
        }

    # 3) Budget constrained
    if budget and budget < LOW_BUDGET_THRESHOLD:
        return {
            "type": "PPS",
            "reason": "Ограниченный бюджет — выбираем более дешевое решение (ППС).",
            "effects": {"energy_multiplier": -0.05, "risk_modifier": 0.05, "cost_multiplier": 0.85},
        }

    # 4) Default balanced
    return {
        "type": "PPU",
        "reason": "Нет явных ограничений — выбираем сбалансированный вариант с хорошей энергоэффективностью (ППУ).",
        "effects": {"energy_multiplier": 0.05, "risk_modifier": 0.0, "cost_multiplier": 1.12},
    }


# --- 4. ТОЧНЫЙ ПООБЪЕКТНЫЙ ФИНАНСОВЫЙ ДВИЖОК ---

def compute_estimate(features, user_req: UserRequest):
    """Калькулятор сметы, завязанный на фичи КОНКРЕТНОЙ площадки"""
    shop_area = user_req.productionVolume * 0.4
    warehouse_area = shop_area * 0.35
    office_area = shop_area * 0.02
    parking_area = user_req.employeesCount * 0.5 * 25
    roads_area = (shop_area + warehouse_area) * 0.25

    housing_multiplier = 25 if user_req.housingType == "hostel" else 40
    housing_area = user_req.employeesCount * (user_req.housingPercent / 100.0) * housing_multiplier

    kindergarten_area = (user_req.employeesCount / 100.0) * user_req.kindergartenPlacesPer100 * 15
    canteen_area = user_req.employeesCount * 0.5
    medical_area = max(20.0, user_req.employeesCount * 0.1)

    total_area = sum([shop_area, warehouse_area, office_area, parking_area, 
                      roads_area, housing_area, kindergarten_area, canteen_area, medical_area])

    shop_cost = shop_area * 35000
    warehouse_cost = warehouse_area * 35000
    office_cost = office_area * 55000
    parking_cost = parking_area * 5000
    roads_cost = roads_area * 5000

    housing_price = 70000 if user_req.housingType == "hostel" else 90000
    housing_cost = housing_area * housing_price

    kindergarten_cost = kindergarten_area * 50000
    canteen_cost = canteen_area * 35000
    medical_cost = medical_area * 45000
    landscaping_cost = total_area * 2000

    sports_cost = 0
    sports_map = {"Стадион": 5_000_000, "Бассейн": 8_000_000, "Спортзал": 3_000_000, "Хоккейная коробка": 2_000_000}
    for sport in user_req.sports:
        sports_cost += sports_map.get(sport, 0)

    # Важно: Стоимость техприсоединения рассчитывается с учетом удаленности конкретной площадки
    # Увеличиваем базовую стоимость подключения, если подстанция дальше 5 км
    distance_penalty_multiplier = 1.0 if features["dist_power"] <= 5 else (1.0 + (features["dist_power"] * 0.02))
    power_connection_cost = 500 * features["connection_fee"] * distance_penalty_multiplier

    total_cost_rub = sum([
        shop_cost, warehouse_cost, office_cost, parking_cost, roads_cost,
        housing_cost, kindergarten_cost, canteen_cost, medical_cost,
        landscaping_cost, sports_cost, power_connection_cost
    ])

    return {
        "total_mln_rub": round(total_cost_rub / 1_000_000, 2),
        "areas_m2": {
            "shop": round(shop_area, 1),
            "warehouse": round(warehouse_area, 1),
            "office": round(office_area, 1),
            "housing": round(housing_area, 1),
            "social": round(kindergarten_area + canteen_area + medical_area, 1),
            "infrastructure": round(parking_area + roads_area, 1)
        },
        "costs_mln_rub": {
            "production": round((shop_cost + warehouse_cost) / 1_000_000, 2),
            "office_and_housing": round((office_cost + housing_cost) / 1_000_000, 2),
            "social_and_sports": round((kindergarten_cost + canteen_cost + medical_cost + sports_cost) / 1_000_000, 2),
            "infrastructure_and_landscaping": round((parking_cost + roads_cost + landscaping_cost) / 1_000_000, 2),
            "power_connection": round(power_connection_cost / 1_000_000, 2)
        }
    }


def compute_economy_score(features, user_req: UserRequest, total_cost_mln: float):
    """Многофакторный экономический скор с объяснимой разбивкой.

    Компоненты:
      - incentives: бинарный (налоговые льготы региона/площадки)
      - tariff_factor: обратный тариф на электроэнергию (ниже лучше)
      - salary_factor: обратная цена рабочей силы (ниже лучше)
      - capex_factor: стоимость проекта (меньше — лучше)

    Бюджет выступает как мультипликатор в конце (не как прямой бонус).
    Возвращает dict с полями:
      - score_component: базовый объединённый скор (0..1)
      - multiplier: бюджетный множитель применённый после базового скоров
      - breakdown: по-компонентные значения
      - explain: список поясняющих строк
      - budget_overrun: bool
      - budget_overrun_amount: float
    """
    # Веса — подобраны чтобы давать дифференциацию и соответствовать целевым диапазонам
    w_incentives = 0.20
    w_tariff = 0.25
    w_salary = 0.25
    w_capex = 0.30

    # Сырьевые значения
    has_benefits = bool(features.get("has_benefits"))
    tariff = float(features.get("tariff") or REF_RANGES["tariff"][1])
    salary = float(features.get("salary") or REF_RANGES["salary"][1])

    # Use reference ranges (robust percentiles) for normalization
    tmin, tmax = REF_RANGES["tariff"]
    smin, smax = REF_RANGES["salary"]
    cmin, cmax = REF_RANGES["capex"]

    # Нормализация и инверсия: низкий тариф -> близко к 1.0
    tariff_factor = max(0.0, min(1.0, 1.0 - normalize(tariff, tmin, tmax)))
    salary_factor = max(0.0, min(1.0, 1.0 - normalize(salary, smin, smax)))

    # CAPEX: экономия при низкой сумме проекта; используем референсные пороги
    capex_factor = max(0.0, min(1.0, 1.0 - normalize(total_cost_mln, cmin, cmax)))

    # graded incentives (allow for partial scoring later if dataset has types)
    incentives = 0.6 if has_benefits else 0.0

    # Базовый объединённый скор (без бюджетного множителя)
    base = (
        w_incentives * incentives +
        w_tariff * tariff_factor +
        w_salary * salary_factor +
        w_capex * capex_factor
    )

    # Бюджет как плавный мультипликатор (sigmoid на (budget - cost)/scale)
    def smooth_sigmoid(x, k=1.0):
        # bounded sigmoid-like mapping
        return 1.0 / (1.0 + math.exp(-k * x))

    budget = getattr(user_req, "budgetMillionRub", 0) or 0
    multiplier = 1.0
    budget_overrun = False
    budget_overrun_amount = 0.0
    if budget > 0:
        # relative difference (budget - cost) normalized by budget
        diff = (budget - total_cost_mln) / max(1.0, budget)
        # center the sigmoid to be responsive: k tuned to 6.0
        sig = smooth_sigmoid(diff * 6.0, k=1.0)
        # map sigmoid (0..1) to multiplier in [0.6 .. 1.15]
        multiplier = 0.6 + 0.55 * sig
        if total_cost_mln > budget:
            budget_overrun = True
            budget_overrun_amount = round(total_cost_mln - budget, 2)

    scored = base * multiplier

    # Light monotonic squashing to hit target ranges; increase dispersion
    # Use power transform with gamma > 1 to increase spread (more leaders/laggards)
    a = 0.02
    b = 0.98
    gamma = 1.2  # increased from 0.95 to add 'stiffness' per user request
    final = max(0.0, min(1.0, a + b * (scored ** gamma)))

    # Explainability
    explain = []
    if incentives:
        explain.append({
            "type": "positive",
            "text": "Наличие налоговых льгот повышает экономическую привлекательность.",
        })
    else:
        explain.append({
            "type": "negative",
            "text": "Отсутствие налоговых льгот снижает экономическую привлекательность.",
        })

    if tariff_factor > 0.7:
        explain.append({
            "type": "positive",
            "text": "Низкий тариф на электроэнергию положительно влияет на OPEX.",
        })
    elif tariff_factor < 0.3:
        explain.append({
            "type": "negative",
            "text": "Высокий тариф на электроэнергию снижает экономическую привлекательность.",
        })

    if salary_factor > 0.6:
        explain.append({
            "type": "positive",
            "text": "Низкая средняя зарплата улучшает конкурентоспособность затрат на персонал.",
        })
    elif salary_factor < 0.3:
        explain.append({
            "type": "negative",
            "text": "Высокая средняя зарплата уменьшает маржинальность проекта.",
        })

    if capex_factor > 0.6:
        explain.append({
            "type": "positive",
            "text": "Невысокая сметная стоимость улучшает CAPEX-позицию проекта.",
        })
    elif capex_factor < 0.3:
        explain.append({
            "type": "negative",
            "text": "Высокая сметная стоимость ухудшает инвестиционную привлекательность (CAPEX).",
        })

    if budget_overrun:
        explain.append({
            "type": "negative",
            "text": "Проект не укладывается в бюджет инвестора — применяется понижающий множитель.",
        })
    else:
        if budget and budget > 0:
            explain.append({
                "type": "positive",
                "text": "Проект укладывается в бюджет инвестора — применяется повышающий множитель.",
            })

    breakdown = {
        "incentives": round(incentives, 3),
        "tariff_factor": round(tariff_factor, 3),
        "salary_factor": round(salary_factor, 3),
        "capex_factor": round(capex_factor, 3),
        "base": round(base, 3),
        "multiplier": round(multiplier, 3),
        "final_scaled": round(final, 3)
    }

    return {
        "score_component": round(base, 3),
        "multiplier": round(multiplier, 3),
        "final": round(final, 3),
        "breakdown": breakdown,
        "explain": explain,
        "budget_overrun": budget_overrun,
        "budget_overrun_amount": budget_overrun_amount,
    }


def compute_confidence(features, user_req: UserRequest, estimate: dict, n_region_places: int = 1):
    """Compute a more realistic confidence score between 0.1 and 0.99.

    Factors:
      - completeness of key fields
      - regional support (number of places)
      - ecological risk
    """
    required = ["tariff", "salary", "power_capacity", "connection_fee"]
    present = 0
    for k in required:
        if features.get(k) not in (None, 0, ""):
            present += 1
    completeness = present / len(required)

    support = min(1.0, n_region_places / 10.0)

    eco_risk = ECO_MAP.get(features.get("ecology_class", "Средний"), 0.05)

    base_conf = 0.85
    conf = base_conf * (0.6 + 0.4 * completeness) * (0.75 + 0.25 * support) * (1.0 - eco_risk)
    conf = max(0.1, min(0.99, conf))
    return round(conf, 2)


# --- 5. ЯДРО СКОРИНГА ---

def compute_score(features, user_req: UserRequest):
    pros, cons, risks_list = [], [], []
    pros_struct, cons_struct = [], []
    missing_data_points = 0

    if features["power_capacity"] == 0: missing_data_points += 1
    if features["salary"] == 50000: missing_data_points += 1

    # Автоматический выбор утеплителя и его влияние на метрики
    insulation = infer_insulation_type(features, user_req)
    ins_type = insulation.get("type")
    ins_reason = insulation.get("reason")
    ins_effects = insulation.get("effects", {})
    energy_effect = ins_effects.get("energy_multiplier", 0.0)
    risk_effect = ins_effects.get("risk_modifier", 0.0)
    cost_effect = ins_effects.get("cost_multiplier", 1.0)

    # Валидация жестких фильтров для формирования cons
    min_required_square = user_req.productionVolume * 10
    if features["square"] < min_required_square:
        cons.append(f"Площадь участка ({features['square']} м²) меньше требуемой по ТЗ ({min_required_square} м²)")
    if features["dist_power"] > 100:
        cons.append(f"Критическое расстояние до подстанции ({features['dist_power']} км > 100 км)")

    # Смета считается строго на базе фичей текущей площадки!
    estimate = compute_estimate(features, user_req)
    # Применяем влияние выбранного утеплителя на стоимость
    estimate["total_mln_rub"] = round(estimate["total_mln_rub"] * cost_effect, 2)
    for k, v in estimate.get("costs_mln_rub", {}).items():
        estimate["costs_mln_rub"][k] = round(v * cost_effect, 2)
    total_cost_mln = estimate["total_mln_rub"]

    # 1. Логистика
    base_logistics = ((1 / (1 + features["dist_steel"] / 50)) + (1 / (1 + features["dist_insulation"] / 50))) / 2
    vol_factor = normalize(user_req.productionVolume, 100, 1000) 
    logistics_score = base_logistics * (1 + vol_factor * 0.2)
    logistics_score = min(1.0, logistics_score)
    
    if features["dist_steel"] < 50:
        text = f"Близость к поставщику стали ({features['dist_steel']} км)"
        pros.append(text)
        pros_struct.append({"category": "logistics", "impact": 0.05, "text": text})

    # 2. Энергия
    tariff_score = 1.0 - normalize(features["tariff"], 3.0, 8.0)
    energy_score = (tariff_score + normalize(features["power_capacity"], 5000, 20000)) / 2
    # Влияние типа утеплителя на энергоэффективность
    energy_score = max(0.0, min(1.0, energy_score * (1.0 + energy_effect)))

    # 3. Труд
    labor_score = 1.0 - normalize(features["salary"], 30000, 120000)

    # 4. Социалка
    social_score = normalize(features["kindergarten"], 50, 100)
    gap = user_req.kindergartenPlacesPer100 - (features["kindergarten"] * 0.5) 
    if gap > 0:
        social_score -= normalize(gap, 0, 50)
        risks_list.append("Дефицит мест в детских садах региона")
    social_score = max(0.0, min(1.0, social_score))

    # 5. Экономика — многофакторная оценка с explainability
    # Сначала получаем итоговую смету (total_cost_mln уже посчитан выше)
    total_cost_mln = total_cost_mln
    econ = compute_economy_score(features, user_req, total_cost_mln)
    economy_score = econ.get("final", 0.0)
    # Merge economy explainability into structured lists (keep strings for API compatibility)
    for ex in econ.get("explain", []):
        if isinstance(ex, dict):
            text = ex.get("text", "")
            polarity = ex.get("type", "positive")
        else:
            text = str(ex)
            lowered = text.lower()
            polarity = "negative" if any(k in lowered for k in NEGATIVE_KEYWORDS) else "positive"

        if polarity == "negative":
            cons.append(text)
            cons_struct.append({"category": "budget", "impact": -0.2, "text": text})
        else:
            pros.append(text)
            pros_struct.append({"category": "economy", "impact": 0.1, "text": text})

    # Бюджетная информация
    budget_overrun = econ.get("budget_overrun", False)
    budget_overrun_amount = econ.get("budget_overrun_amount", 0.0)

    # Если у площадки есть локальные преимущества, дублируем это в pros (короткая заметка)
    if features.get("place_benefits"):
        text = "Налоговые льготы площадки"
        pros.append(text)
        pros_struct.append({"category": "incentive", "impact": 0.08, "text": text})

    if user_req.railwayRequired:
        if features.get("dist_railway") is None:
            if features["has_railway"] is None:
                risks_list.append("Неизвестно наличие ЖД ветки")
                missing_data_points += 1
                logistics_score *= 0.8
            elif features["has_railway"] is False:
                cons.append("Нет ЖД ветки (критично для ТЗ)")
                logistics_score *= 0.5
        elif features["dist_railway"] > 25:
            cons.append(f"Удаленность до ЖД ветки ({features['dist_railway']} км > 25 км)")
            logistics_score *= 0.85
        else:
            pros.append(f"Близость к ЖД ветке ({features['dist_railway']} км)")
            
    if features["dist_highway"] is None:
        missing_data_points += 1
    elif features["dist_highway"] > user_req.maxDistanceToHighwayKm:
        cons.append(f"Удаленность от трассы ({features['dist_highway']} км > {user_req.maxDistanceToHighwayKm} км)")
        logistics_score *= 0.7

    # 6. Равнозначная сумма — веса сбалансированы; экономика уже агрегирована внутри
    w_log, w_eng, w_lab, w_soc, w_eco = 0.20, 0.20, 0.15, 0.10, 0.35
    weighted_sum = (w_log * logistics_score + w_eng * energy_score + w_lab * labor_score + w_soc * social_score + w_eco * economy_score)
    score = weighted_sum ** 1.05

    # 7. Мультипликаторы
    size_bonus = normalize(features["square"], min_required_square, min_required_square * 5) * 0.05
    score *= (1 + size_bonus)
    if size_bonus > 0.03: pros.append("Масштаб участка позволяет кратно расширить производство")

    if user_req.architecturePriority == "authentic":
        score *= 1.03
        pros.append("Культурный код региона совпадает с бизнес-запросом")

    # 8. Explainability
    breakdown_dict = {
        "Логистика": logistics_score, "Энергетика": energy_score,
        "Кадры": labor_score, "Социальная среда": social_score, "Экономика": economy_score
    }
    top_factor = max(breakdown_dict, key=breakdown_dict.get)

    # 9. Confidence и Риски
    risk = ECO_MAP.get(features["ecology_class"], 0.05)
    # Учитываем влияние утеплителя на риск (пожароопасность и т.п.)
    risk = max(0.0, min(1.0, risk + risk_effect))
    # Compute a robust confidence
    confidence = compute_confidence(features, user_req, estimate, n_region_places=1)
    # incorporate risk as multiplicative deterioration
    score *= (1 - risk)

    score = max(0.0, min(1.0, score))

    return {
        "total_score": round(score, 3),
        "confidence": round(confidence, 2),
        "estimate": estimate,
        "breakdown": {
            "logistics": round(logistics_score, 3),
            "energy": round(energy_score, 3),
            "labor": round(labor_score, 3),
            "social": round(social_score, 3),
            "economy": round(economy_score, 3)
        },
        "why": {
            "top_factor": top_factor,
            "pros": pros,
            "cons": cons,
            "risks": risks_list
        },
        "insulation": {"type": ins_type, "reason": ins_reason},
        "budget_overrun": budget_overrun,
        "budget_overrun_amount": budget_overrun_amount
    }


# --- 6. ENDPOINT ---

@app.post("/score", response_model=List[ScoredPlace])
def rank_places(request: UserRequest):
    if not REGIONS_DB:
        raise HTTPException(status_code=500, detail="База не загружена")
    # Новый алгоритм (по требованию):
    # 1) Считаем скор на уровне региона (агрегируя ключевые региональные показатели)
    # 2) Сортируем регионы и берём топ-3
    # 3) Для этих топ-3 регионов прогоняем площадки через детальную оценку (сметы/инсайты)

    enriched_regions = copy.deepcopy(REGIONS_DB)

    def compute_region_score(region, user_req: UserRequest):
        # Собираем региональные фичи (агрегаты по региону)
        tariff = region.get("economy", {}).get("industrial_electricity_tariff_rub_kwh", 5.0)
        power_capacity = region.get("network_infrastructure", {}).get("available_electrical_capacity_kva", 0)
        avg_salary = region.get("economy", {}).get("average_monthly_salary_rub", 50000)
        kindergarten = region.get("social_infrastructure", {}).get("kindergarten_availability_per_100_children", 50)
        has_benefits = region.get("economy", {}).get("has_tax_incentives_tor_oez", False)

        # Вспомогательные агрегации по площадкам (усреднённые дистанции)
        places = region.get("places", []) or []
        avg_dist_steel = None
        avg_dist_insulation = None
        if places:
            ds = [p.get("distance_to_the_supplier_of_rolled_steel_km", p.get("distance_to_the_supplier_of_rolled_steel", 100)) for p in places]
            di = [p.get("distance_to_the_insulation_supplier_km", p.get("distance_to_the_insulation_supplier", 100)) for p in places]
            try:
                # use median to reduce outlier impact
                avg_dist_steel = statistics.median(ds) if ds else 100
                avg_dist_insulation = statistics.median(di) if di else 100
            except Exception:
                avg_dist_steel = 100
                avg_dist_insulation = 100
        else:
            avg_dist_steel = 100
            avg_dist_insulation = 100

        # Логистика (чем меньше дистанции, тем лучше)
        base_logistics = ((1 / (1 + avg_dist_steel / 50)) + (1 / (1 + avg_dist_insulation / 50))) / 2
        vol_factor = normalize(user_req.productionVolume, 100, 1000)
        logistics_score = min(1.0, base_logistics * (1 + vol_factor * 0.2))

        tariff_score = 1.0 - normalize(tariff, 3.0, 8.0)
        energy_score = (tariff_score + normalize(power_capacity, 5000, 20000)) / 2

        labor_score = 1.0 - normalize(avg_salary, 30000, 120000)

        social_score = normalize(kindergarten, 50, 100)

        # Оцениваем типичную смету для региона как среднее значение (учитываем цену участка и базовую стоимость подключения)
        conn_fee = region.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw", 10000)
        conn_cost_mln = (500 * conn_fee) / 1_000_000.0
        prices = []
        for p in places:
            pr = p.get("price_rub", p.get("price", None))
            try:
                pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
            except Exception:
                pr_mln = 0.0
            prices.append(pr_mln + conn_cost_mln)
        if prices:
            # use median cost per region to reduce outlier impact
            try:
                region_total_cost_mln = statistics.median(prices)
            except Exception:
                region_total_cost_mln = sum(prices) / len(prices)
        else:
            region_total_cost_mln = REF_RANGES["capex"][1]

        region_features = {"tariff": tariff, "salary": avg_salary, "has_benefits": has_benefits}
        econ = compute_economy_score(region_features, user_req, region_total_cost_mln)
        economy_score = econ.get("final", 0.0)

        # Prepare explainability containers
        pros = []
        cons = []
        risks_list = []

        # merge explainability from economy
        if econ.get("explain"):
            for ex in econ.get("explain"):
                if isinstance(ex, dict):
                    text = ex.get("text", "")
                    polarity = ex.get("type", "positive")
                else:
                    text = str(ex)
                    lowered = text.lower()
                    polarity = "negative" if any(k in lowered for k in NEGATIVE_KEYWORDS) else "positive"

                if polarity == "negative":
                    cons.append(text)
                else:
                    pros.append(text)

        weighted_sum = (logistics_score + energy_score + labor_score + social_score + economy_score) / 5.0
        score = weighted_sum ** 1.1

        # confidence: базируется на количестве имеющихся данных и экологии региона
        risk = ECO_MAP.get(region.get("economy", {}).get("ecological_class_iza", "Средний"), 0.05)
        confidence = max(0.0, min(1.0, 1.0 - (risk + 0.05)))

        breakdown = {
            "logistics": round(logistics_score, 3),
            "energy": round(energy_score, 3),
            "labor": round(labor_score, 3),
            "social": round(social_score, 3),
            "economy": round(economy_score, 3),
        }

        # Add region-level pros/cons
        if has_benefits:
            pros.append("Налоговые льготы региона")
        if avg_dist_steel < 50:
            pros.append("Близость к поставщику стали в среднем по региону")
        if power_capacity < 1000:
            cons.append("Низкая доступная мощность по региону")

        top_factor = max(breakdown, key=breakdown.get)

        return {
            "total_score": round(max(0.0, min(1.0, score)), 3),
            "confidence": round(confidence, 2),
            "breakdown": breakdown,
            "why": {"top_factor": top_factor, "pros": pros, "cons": cons, "risks": risks_list},
        }

    # 1) Считаем скор для всех регионов
    region_rankings = []
    for region in enriched_regions:
        rscore = compute_region_score(region, request)
        region_rankings.append({"region": region, "score": rscore})

    # 2) Берём топ-3 регионов по региональному скору
    top_regions = sorted(region_rankings, key=lambda x: (x["score"]["total_score"], x["score"]["confidence"]), reverse=True)[:3]

    if not top_regions:
        raise HTTPException(status_code=404, detail="Нет регионов для ранжирования")

    results = []
    # 3) Для каждого из топ-3 прогоняем площадки через детальную оценку
    for rr in top_regions:
        region = rr["region"]
        region_score = rr["score"]

        # обогащаем площадки детальной сметой и инсайтами
        for place in region.get("places", []):
            features = compute_features(region, place)
            score_data = compute_score(features, request)
            place["estimate"] = score_data["estimate"]
            place["insights"] = {
                "score": score_data["total_score"],
                "confidence": score_data["confidence"],
                "pros": score_data["why"]["pros"],
                "cons": score_data["why"]["cons"],
                "risks": score_data["why"]["risks"],
                "insulation": score_data.get("insulation", {}),
                "budget_overrun": score_data.get("budget_overrun", False),
                "budget_overrun_amount": score_data.get("budget_overrun_amount", 0.0),
            }
            # Сохраняем технически полный скор для внутренней сортировки, если потребуется
            place["_full_score"] = score_data

        # optional: сортировать площадки внутри региона по скору
        region_places_sorted = sorted(region.get("places", []), key=lambda p: p.get("_full_score", {}).get("total_score", 0), reverse=True)

        # Формируем результирующий объект: региональный свод и его площадки
        best_place = region_places_sorted[0] if region_places_sorted else None
        results.append({
            "region_name": region.get("region_name"),
            "place_address": best_place["place_address"] if best_place else region.get("region_name"),
            "score": region_score["total_score"],
            "confidence": region_score["confidence"],
            "breakdown": region_score["breakdown"],
            "why": region_score["why"],
            "region_info": region,
        })

    # Удаляем технические временные ключи
    for res in results:
        for p in res["region_info"].get("places", []):
            p.pop("_full_score", None)
    
    return results

@app.get("/health")
async def health_check():
    return {"status": "ok"}
