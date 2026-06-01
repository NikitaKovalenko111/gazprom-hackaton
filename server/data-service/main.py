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
    kindergarten_availability_per_100_children: float
    average_1room_apartment_rent_rub: int
    profile_colleges_budget_places: int

class RegionEconomy(BaseModel):
    benefits: List[str]
    industrial_electricity_tariff_rub_kwh: float
    average_monthly_salary_rub: float
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

class RegionInfo(BaseModel):
    region_name: str
    region_lat: float
    region_lon: float
    social_infrastructure: SocialInfrastructure
    economy: RegionEconomy
    network_infrastructure: NetworkInfrastructure
    cultural_code: CulturalCode
    places: List[dict]

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

class ScoredPlace(BaseModel):
    region_name: str
    place_name: str
    score: float
    confidence: float
    breakdown: ScoreBreakdown
    why: WhyInsights
    region_info: RegionInfo


# --- 2. ИНИЦИАЛИЗАЦИЯ СЕРВИСА ---

app = FastAPI(title="Location Scoring Service - Precision Finance Edition")

try:
    with open("regions.json", "r", encoding="utf-8") as f:
        REGIONS_DB = json.load(f)
except FileNotFoundError:
    REGIONS_DB = []
    print("ВНИМАНИЕ: Файл regions.json не найден!")

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
        places = r.get("places", []) or []
        
        conn_fee_raw = r.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw")
        conn_fee = float(conn_fee_raw) if conn_fee_raw is not None else 10000.0
        
        for p in places:
            pr = p.get("price_rub", p.get("price", None))
            try:
                pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
            except Exception:
                pr_mln = 0.0
            
            infra = p.get("infrastructure", {})
            p_conn_fee = infra.get("connection_cost_per_kw")
            p_conn_fee = float(p_conn_fee) if p_conn_fee is not None else conn_fee
            
            p_dist_power = infra.get("distance_to_substation_km", 10)
            p_dist_power = float(p_dist_power) if p_dist_power is not None else 10.0
            p_distance_penalty = 1.0 if p_dist_power <= 5 else (1.0 + (p_dist_power * 0.02))

            place_conn_cost_mln = (500 * p_conn_fee * p_distance_penalty) / 1_000_000.0
            region_costs.append(pr_mln + place_conn_cost_mln)

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
    if value is None: 
        return 0.0
    if min_val is None or max_val is None:
        return 0.0
    try:
        value = float(value)
        min_val = float(min_val)
        max_val = float(max_val)
    except (ValueError, TypeError):
        return 0.0

    if max_val == min_val: return 0.0
    if value <= min_val: return 0.0
    if value >= max_val: return 1.0
    return (value - min_val) / (max_val - min_val)


def clamp01(value):
    try:
        return max(0.0, min(1.0, float(value)))
    except (ValueError, TypeError):
        return 0.0


def build_scenario_profile(user_req: UserRequest, estimated_total_mln: Optional[float] = None):
    budget = float(user_req.budgetMillionRub or 0)

    volume_pressure = clamp01(normalize(user_req.productionVolume, 100, 1000))
    labor_pressure = clamp01(normalize(user_req.employeesCount, 20, 300))
    housing_pressure = clamp01(user_req.housingPercent / 100.0)
    childcare_pressure = clamp01(user_req.kindergartenPlacesPer100 / 20.0)
    sports_pressure = clamp01(len(user_req.sports) / 4.0)
    rail_pressure = 1.0 if user_req.railwayRequired else 0.0
    highway_tightness = clamp01(1.0 - normalize(user_req.maxDistanceToHighwayKm, 20, 150))
    authentic_pressure = 1.0 if user_req.architecturePriority == "authentic" else 0.0

    budget_pressure = 0.0
    if estimated_total_mln is not None and budget > 0:
        budget_pressure = clamp01((estimated_total_mln - budget) / max(1.0, budget))

    # Variant 1: scenario-driven weights only.
    # No diversity constraints are applied during top-region selection.
    weights = {
        "logistics": 0.22,
        "energy": 0.20,
        "labor": 0.18,
        "social": 0.15,
        "economy": 0.25,
    }

    weights["logistics"] += (0.28 * volume_pressure) + (0.18 * rail_pressure) + (0.08 * highway_tightness)
    weights["energy"] += (0.18 * volume_pressure) + (0.08 * labor_pressure)
    weights["labor"] += (0.24 * labor_pressure) + (0.12 * housing_pressure)
    weights["social"] += (0.22 * childcare_pressure) + (0.10 * housing_pressure) + (0.08 * sports_pressure)
    weights["economy"] += (0.20 * budget_pressure) + (0.05 * volume_pressure)

    if authentic_pressure:
        weights["social"] += 0.08

    total = sum(weights.values()) or 1.0
    normalized = {key: value / total for key, value in weights.items()}

    return {
        "weights": normalized,
        "pressures": {
            "volume": volume_pressure,
            "labor": labor_pressure,
            "housing": housing_pressure,
            "childcare": childcare_pressure,
            "sports": sports_pressure,
            "rail": rail_pressure,
            "highway_tightness": highway_tightness,
            "authentic": authentic_pressure,
            "budget": budget_pressure,
        },
    }


def scenario_constraint_check(features, user_req: UserRequest, estimate_total_mln: float = None):
    failures = []

    min_required_square = user_req.productionVolume * 0.4 * 1.5
    if features["square"] < min_required_square:
        failures.append("area")

    if user_req.railwayRequired:
        dist_railway = features.get("dist_railway")
        has_railway = features.get("has_railway")
        railway_ok = False
        if has_railway is True:
            railway_ok = True
        elif dist_railway is not None:
            try:
                railway_ok = float(dist_railway) <= 25
            except (ValueError, TypeError):
                railway_ok = False
        if not railway_ok:
            failures.append("railway")

    dist_highway = features.get("dist_highway")
    if dist_highway is not None:
        try:
            if float(dist_highway) > user_req.maxDistanceToHighwayKm * 1.2:
                failures.append("highway")
        except (ValueError, TypeError):
            failures.append("highway")

    # Interpret `budget` as the investor's budget for land purchase + connection
    budget = float(user_req.budgetMillionRub or 0)
    if budget > 0:
        # compute land price (in mln) from features
        pr = features.get("price_rub")
        try:
            pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
        except (ValueError, TypeError):
            pr_mln = 0.0

        # compute connection cost estimate from features
        conn_fee = features.get("connection_fee") or 10000.0
        try:
            conn_fee = float(conn_fee)
        except (ValueError, TypeError):
            conn_fee = 10000.0

        dist_power = features.get("dist_power", 10)
        try:
            dist_power = float(dist_power)
        except (ValueError, TypeError):
            dist_power = 10.0

        distance_penalty = 1.0 if dist_power <= 5 else (1.0 + (dist_power * 0.02))
        conn_cost = 500 * conn_fee * distance_penalty
        conn_cost_mln = conn_cost / 1_000_000.0

        land_and_conn_mln = pr_mln + conn_cost_mln
        if land_and_conn_mln > budget * 1.2:
            failures.append("budget")

    return failures

ECO_MAP = {
    "Низкий": 0.0, 
    "Средний": 0.05, 
    "Высокий": 0.08, 
    "Повышенный": 0.1, 
    "Очень высокий": 0.12
}

NEGATIVE_KEYWORDS = [
    "не укладывается", "превышает", "высокая сметная стоимость", 
    "ухудш", "снижает"
]

# --- 3. ФИЛЬТРЫ И ИЗВЛЕЧЕНИЕ ФИЧ ---

def passes_filters(place, user_req: UserRequest) -> bool:
    square_ha = place.get("square_ha", place.get("square", 0))
    try:
        square_m2 = float(square_ha) * 10000
    except (ValueError, TypeError):
        square_m2 = 0
    
    # productionVolume is provided in m^2/year; keep this as a soft gate,
    # because the stricter penalty path in compute_score already handles deficits.
    min_required_square = user_req.productionVolume * 0.4 * 1.1
    if square_m2 < min_required_square:
        return False
    
    infra = place.get("infrastructure", {})
    dist_power = infra.get("distance_to_substation_km")
    
    if dist_power is not None:
        try:
            if float(dist_power) > 150:
                return False
        except (ValueError, TypeError):
            pass 
        
    return True

def compute_features(region, place):
    square_ha = place.get("square_ha", place.get("square", 0))
    try:
        square_m2 = float(square_ha) * 10000
    except (ValueError, TypeError):
        square_m2 = 0
        
    region_benefits = region.get("economy", {}).get("benefits", [])
    has_region_benefits = len(region_benefits) > 0

    place_benefits_raw = place.get("benefit", [])
    place_benefits = [b for b in place_benefits_raw if b and b.lower() != "без льгот"]
    
    infra = place.get("infrastructure", {})
    soc_infra = region.get("social_infrastructure", {})
    
    return {
        "square": square_m2,
        "dist_steel": place.get("min_dist_km_to_metallurgical_factory", 500),
        "dist_insulation": place.get("min_dist_km_to_insulation_factory", 500),
        "dist_power": infra.get("distance_to_substation_km", 10),
        "connection_fee": infra.get("connection_cost_per_kw", region.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw", 10000)),
        "power_capacity": infra.get("available_power_kva", region.get("network_infrastructure", {}).get("available_electrical_capacity_kva", 0)),
        "has_gas": infra.get("has_gas", False),
        
        "tariff": region.get("economy", {}).get("industrial_electricity_tariff_rub_kwh", 5.0),
        "salary": region.get("economy", {}).get("average_monthly_salary_rub", 50000),
        
        # Новые социальные параметры
        "kindergarten": soc_infra.get("kindergarten_availability_per_100_children", 50),
        "urban_index": soc_infra.get("urban_environment_index", 180),
        "rent_price": soc_infra.get("average_1room_apartment_rent_rub", 25000),
        "colleges": soc_infra.get("profile_colleges_budget_places", 1000),
        
        "has_benefits": has_region_benefits,
        "place_benefits": place_benefits,
        "ecology_class": region.get("economy", {}).get("ecological_class_iza", "Средний"),
        "dist_railway": place.get("distance_to_the_nearest_railway_station_km", None),
        "has_railway": place.get("has_railway", None),
        "dist_highway": place.get("distance_to_the_nearest_federal_highway_km", place.get("distance_to_highway_km", None)),
        "price_rub": place.get("price_rub", place.get("price", None))
    }

def infer_insulation_type(features, user_req: UserRequest):
    ecology = (features.get("ecology_class") or "Средний")
    prod = getattr(user_req, "productionVolume", 0)
    employees = getattr(user_req, "employeesCount", 0)
    budget = getattr(user_req, "budgetMillionRub", 0)

    LARGE_PRODUCTION_THRESHOLD = 500
    LOW_BUDGET_THRESHOLD = 40

    if isinstance(ecology, str) and ecology.lower().startswith("повыш"):
        return {
            "type": "MINVATA",
            "reason": "Повышенный риск — выбираем негорючий материал (Минвата).",
            "effects": {"energy_multiplier": 0.0, "risk_modifier": -0.05, "cost_multiplier": 1.0},
        }
    if prod >= LARGE_PRODUCTION_THRESHOLD or employees >= 200:
        return {
            "type": "PPU",
            "reason": "Большой объем производства требует энергоэффективного утеплителя (ППУ).",
            "effects": {"energy_multiplier": 0.05, "risk_modifier": 0.0, "cost_multiplier": 1.12},
        }
    if budget and budget < LOW_BUDGET_THRESHOLD:
        return {
            "type": "PPS",
            "reason": "Ограниченный бюджет — выбираем более дешевое решение (ППС).",
            "effects": {"energy_multiplier": -0.05, "risk_modifier": 0.05, "cost_multiplier": 0.85},
        }
    return {
        "type": "PPU",
        "reason": "Сбалансированный вариант с хорошей энергоэффективностью (ППУ).",
        "effects": {"energy_multiplier": 0.05, "risk_modifier": 0.0, "cost_multiplier": 1.12},
    }

# --- 4. ТОЧНЫЙ ПООБЪЕКТНЫЙ ФИНАНСОВЫЙ ДВИЖОК ---

def compute_estimate(features, user_req: UserRequest):
    insulation = infer_insulation_type(features, user_req)
    cost_effect = insulation.get("effects", {}).get("cost_multiplier", 1.0)
    # productionVolume is in m^2/year; use factor 0.4 m² per unit per ТЗ
    shop_area = user_req.productionVolume * 0.4 
    warehouse_area = shop_area * 0.35
    office_area = shop_area * 0.02
    parking_area = user_req.employeesCount * 0.5 * 25
    roads_area = (shop_area + warehouse_area) * 0.25

    housing_multiplier = 25 if user_req.housingType in ["hostel", "общежитие"] else 40
    housing_area = user_req.employeesCount * (user_req.housingPercent / 100.0) * housing_multiplier

    # Округляем количество мест в детсадах до целого числа мест
    try:
        raw_kind_places = (user_req.employeesCount / 100.0) * float(user_req.kindergartenPlacesPer100)
    except (ValueError, TypeError):
        raw_kind_places = 0.0
    num_kindergarten_places = math.ceil(raw_kind_places)
    kindergarten_area = num_kindergarten_places * 15
    canteen_area = user_req.employeesCount * 0.5
    medical_area = max(20.0, user_req.employeesCount * 0.1)

    total_area = sum([shop_area, warehouse_area, office_area, parking_area, 
                      roads_area, housing_area, kindergarten_area, canteen_area, medical_area])

    shop_cost = shop_area * 35000
    warehouse_cost = warehouse_area * 35000
    office_cost = office_area * 55000
    parking_cost = parking_area * 5000
    roads_cost = roads_area * 5000

    housing_price = 70000 if user_req.housingType in ["hostel", "общежитие"] else 90000
    housing_cost = housing_area * housing_price

    kindergarten_cost = kindergarten_area * 50000
    canteen_cost = canteen_area * 35000
    medical_cost = medical_area * 45000
    landscaping_cost = total_area * 2000

    sports_cost = 0
    sports_map = {"Стадион": 5_000_000, "Бассейн": 8_000_000, "Спортзал": 3_000_000, "Хоккейная коробка": 2_000_000}
    for sport in user_req.sports:
        sports_cost += sports_map.get(sport, 0)

    try:
        dist_power = float(features.get("dist_power", 10))
    except (ValueError, TypeError):
        dist_power = 10.0
        
    distance_penalty_multiplier = 1.0 if dist_power <= 5 else (1.0 + (dist_power * 0.02))
    
    conn_fee = features.get("connection_fee")
    conn_fee = float(conn_fee) if conn_fee is not None else 10000.0
    
    power_connection_cost = 500 * conn_fee * distance_penalty_multiplier

    total_cost_rub = sum([
        shop_cost, warehouse_cost, office_cost, parking_cost, roads_cost,
        housing_cost, kindergarten_cost, canteen_cost, medical_cost,
        landscaping_cost, sports_cost, power_connection_cost
    ]) * cost_effect

    return {
        "total_mln_rub": round(total_cost_rub / 1_000_000, 2),
        "insulation_multiplier": cost_effect,
        "square_m2": round(total_area, 1),
        "areas_m2": {
            "shop": round(shop_area, 1),
            "warehouse": round(warehouse_area, 1),
            "office": round(office_area, 1),
            "housing": round(housing_area, 1),
            "social_objects": round(kindergarten_area + canteen_area + medical_area, 1),
            "infrastructure_and_roads": round(parking_area + roads_area, 1),
            "total_site_area": round(total_area, 1)
        },
        "detailed_costs_rub": {
            "Производственный цех": round(shop_cost * cost_effect),
            "Склад готовой продукции": round(warehouse_cost * cost_effect),
            "АБК (офисный блок)": round(office_cost * cost_effect),
            "Жилье (общежитие/квартиры)": round(housing_cost * cost_effect),
            "Детский сад": round(kindergarten_cost * cost_effect),
            "Столовая": round(canteen_cost * cost_effect),
            "Медпункт": round(medical_cost * cost_effect),
            "Дороги и парковки": round((parking_cost + roads_cost) * cost_effect),
            "Благоустройство территории": round(landscaping_cost * cost_effect),
            "Спортивные объекты": round(sports_cost * cost_effect),
            "Технологическое присоединение к сетям": round(power_connection_cost * cost_effect)
        },
        "costs_mln_rub": {
            "production": round(((shop_cost + warehouse_cost) * cost_effect) / 1_000_000, 2),
            "office_and_housing": round(((office_cost + housing_cost) * cost_effect) / 1_000_000, 2),
            "social_and_sports": round(((kindergarten_cost + canteen_cost + medical_cost + sports_cost) * cost_effect) / 1_000_000, 2),
            "infrastructure_and_landscaping": round(((parking_cost + roads_cost + landscaping_cost) * cost_effect) / 1_000_000, 2),
            "power_connection": round((power_connection_cost * cost_effect) / 1_000_000, 2)
        }
    }

def compute_economy_score(features, user_req: UserRequest, total_cost_mln: float):
    w_incentives = 0.20
    w_tariff = 0.25
    w_salary = 0.25
    w_capex = 0.30

    has_benefits = bool(features.get("has_benefits"))
    tariff = float(features.get("tariff") or REF_RANGES["tariff"][1])
    salary = float(features.get("salary") or REF_RANGES["salary"][1])

    tmin, tmax = REF_RANGES["tariff"]
    smin, smax = REF_RANGES["salary"]
    cmin, cmax = REF_RANGES["capex"]

    tariff_factor = max(0.0, min(1.0, 1.0 - normalize(tariff, tmin, tmax)))
    salary_factor = max(0.0, min(1.0, 1.0 - normalize(salary, smin, smax)))
    capex_factor = max(0.0, min(1.0, 1.0 - normalize(total_cost_mln, cmin, cmax)))

    incentives = 0.6 if has_benefits else 0.0

    base = (
        w_incentives * incentives +
        w_tariff * tariff_factor +
        w_salary * salary_factor +
        w_capex * capex_factor
    )

    def smooth_sigmoid(x, k=1.0):
        try:
            return 1.0 / (1.0 + math.exp(-k * x))
        except OverflowError:
            # If exp overflows it's because -k*x is very large -> sigmoid tends to 0.0
            # If -k*x is very negative, exp is ~0 and sigmoid -> 1.0 (no overflow in practice)
            return 0.0 if (-k * x) > 0 else 1.0

    budget = getattr(user_req, "budgetMillionRub", 0) or 0
    multiplier = 1.0
    budget_overrun = False
    budget_overrun_amount = 0.0
    
    if budget > 0:
        diff = (budget - total_cost_mln) / max(1.0, budget)
        sig = smooth_sigmoid(diff * 6.0, k=1.0)
        multiplier = 0.6 + 0.55 * sig
        if total_cost_mln > budget:
            budget_overrun = True
            budget_overrun_amount = round(total_cost_mln - budget, 2)

    scored = base * multiplier

    gamma = 0.85 
    final = (scored ** gamma) * 0.85
    final = max(0.0, min(0.95, final))

    explain = []
    if incentives:
        explain.append({"type": "positive", "text": "Наличие налоговых льгот."})
    else:
        explain.append({"type": "negative", "text": "Отсутствие налоговых льгот."})
    if tariff_factor > 0.7:
        explain.append({"type": "positive", "text": "Низкий тариф на электроэнергию."})
    elif tariff_factor < 0.3:
        explain.append({"type": "negative", "text": "Высокий тариф на электроэнергию."})
    if capex_factor > 0.6:
        explain.append({"type": "positive", "text": "Невысокая сметная стоимость."})
    elif capex_factor < 0.3:
        explain.append({"type": "negative", "text": "Высокая сметная стоимость."})
        
    if budget_overrun:
        explain.append({"type": "negative", "text": "Проект не укладывается в бюджет инвестора."})

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
    required = ["tariff", "salary", "power_capacity", "connection_fee"]
    present = sum(1 for k in required if features.get(k) not in (None, 0, ""))
    completeness = present / len(required)

    support = min(1.0, n_region_places / 10.0)
    eco_risk = ECO_MAP.get(features.get("ecology_class", "Средний"), 0.05)

    base_conf = 0.85
    conf = base_conf * (0.6 + 0.4 * completeness) * (0.75 + 0.25 * support) * (1.0 - eco_risk)
    return round(max(0.1, min(0.99, conf)), 2)

# --- 5. ЯДРО СКОРИНГА ---

def compute_score(features, user_req: UserRequest, n_places: int = 1):
    pros, cons, risks_list = [], [], []

    insulation = infer_insulation_type(features, user_req)
    ins_type = insulation.get("type")
    ins_reason = insulation.get("reason")
    ins_effects = insulation.get("effects", {})
    energy_effect = ins_effects.get("energy_multiplier", 0.0)
    risk_effect = ins_effects.get("risk_modifier", 0.0)

    # productionVolume is in m^2/year; adjust required area accordingly
    min_required_square = user_req.productionVolume * 0.4 * 1.5
    if features["square"] < min_required_square:
        cons.append(f"Площадь участка ({features['square']} м²) меньше требуемой по ТЗ")
        
    try:
        dist_power = float(features["dist_power"])
        if dist_power > 100:
            cons.append(f"Критическое расстояние до подстанции ({dist_power} км > 100 км)")
    except (ValueError, TypeError):
        pass

    estimate = compute_estimate(features, user_req)
    total_cost_mln = estimate["total_mln_rub"]

    # Compute investor-relevant budget reference: land price + connection cost (in mln)
    try:
        pr = features.get("price_rub")
        pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
    except (ValueError, TypeError):
        pr_mln = 0.0

    power_conn_mln = 0.0
    try:
        power_conn_mln = float(estimate.get("costs_mln_rub", {}).get("power_connection", 0.0))
    except (ValueError, TypeError):
        power_conn_mln = 0.0

    land_conn_mln = pr_mln + power_conn_mln

    # initialize penalties and budget flags before possible early modification
    hard_penalty = 1.0
    budget_overrun = False
    budget_overrun_amount = 0.0
    # scenario constraint check will now use features to evaluate land+connection against budget
    constraint_failures = scenario_constraint_check(features, user_req, None)
    if constraint_failures:
        # Previously we returned immediately (hard gate). To avoid empty results for strict
        # user requests, apply a strong penalty but continue computing a degraded score so
        # the API can still return ranked options with explanations.
        cons.append(f"Сценарное ограничение не выполнено: {', '.join(constraint_failures)}")
        # apply strong multiplicative penalty to reflect hard mismatch
        hard_penalty *= 0.18
        budget_overrun = "budget" in constraint_failures
        budget_overrun_amount = max(0.0, total_cost_mln - float(user_req.budgetMillionRub or 0))
    # build scenario profile using land+connection as the budget reference
    scenario = build_scenario_profile(user_req, land_conn_mln)
    weights = scenario["weights"]
    pressures = scenario["pressures"]

    # ЛОГИСТИКА
    try:
        dist_steel = float(features["dist_steel"])
        dist_insulation = float(features["dist_insulation"])
        # Use exponential decay to avoid rapid saturation for small distances
        # lambda chosen to give gradual decay (0.005 -> 100km ~ 0.61, 200km ~ 0.37)
        lam = 0.005
        ls = math.exp(-lam * max(0.0, dist_steel))
        li = math.exp(-lam * max(0.0, dist_insulation))
        base_logistics = (ls + li) / 2.0
        if dist_steel < 200:
            pros.append(f"Близость к поставщику стали ({dist_steel} км)")
        if dist_insulation < 200:
            pros.append(f"Близость к поставщику утеплителя ({dist_insulation} км)")
    except (ValueError, TypeError):
        base_logistics = 0.5
    # Combine base logistics with scenario pressures and small mode supports
    logistics_score = (
        base_logistics * (1.0 + pressures["volume"] * 0.25)
        + 0.12 * pressures.get("rail", 0.0)
        + 0.06 * pressures.get("highway_tightness", 0.0)
    )
    # Prevent trivial saturation; allow high but not perfect score by default
    logistics_score = max(0.0, min(0.98, logistics_score))

    # ЭНЕРГЕТИКА
    tariff_score = 1.0 - normalize(features["tariff"], 3.0, 8.0)
    energy_score = (tariff_score + normalize(features["power_capacity"], 5000, 20000)) / 2
    energy_score = max(0.0, min(1.0, energy_score * (1.0 + energy_effect + pressures["volume"] * 0.15)))
    if features.get("has_gas"):
        energy_score = min(1.0, energy_score + 0.1)
        pros.append("Наличие газоснабжения на участке")

    # КАДРЫ (ИНТЕГРАЦИЯ НОВЫХ ПОЛЕЙ: Зарплата, Аренда, Колледжи)
    rent_raw = features.get("rent_price")
    rent = float(rent_raw) if rent_raw is not None else 25000.0
    colleges_raw = features.get("colleges")
    colleges = float(colleges_raw) if colleges_raw is not None else 1000.0
    
    salary_factor = 1.0 - normalize(features["salary"], 30000, 120000)
    rent_factor = 1.0 - normalize(rent, 15000, 50000)
    colleges_factor = normalize(colleges, 500, 5000)
    
    labor_score = (salary_factor * 0.5) + (rent_factor * 0.2) + (colleges_factor * 0.3)
    labor_score = max(0.0, min(1.0, labor_score * (1.0 + pressures["labor"] * 0.35)))
    
    if rent < 20000: pros.append("Доступная стоимость аренды жилья")
    if colleges > 3000: pros.append("Высокий кадровый потенциал (много мест в колледжах)")

    # СОЦИАЛЬНАЯ СРЕДА (ИНТЕГРАЦИЯ НОВОГО ПОЛЯ: Индекс города)
    urban_idx_raw = features.get("urban_index")
    urban_idx = float(urban_idx_raw) if urban_idx_raw is not None else 180.0
    urban_factor = normalize(urban_idx, 150, 300)
    
    kg_availability = features.get("kindergarten")
    kg_availability = float(kg_availability) if kg_availability is not None else 50.0

    base_social = (normalize(kg_availability, 50, 100) * 0.6) + (urban_factor * 0.4)
    gap = user_req.kindergartenPlacesPer100 - (kg_availability * 0.5) 
    if gap > 0:
        base_social -= normalize(gap, 0, 50)
        risks_list.append("Дефицит мест в детских садах региона")
    social_score = max(0.0, min(1.0, base_social + (pressures["housing"] * 0.14) + (pressures["childcare"] * 0.12) + (pressures["sports"] * 0.05)))
    
    if urban_idx > 220: pros.append("Комфортная городская среда (высокий индекс)")

    # ЭКОНОМИКА
    # Compute economy score using land+connection as the primary budget reference
    econ = compute_economy_score(features, user_req, land_conn_mln)
    economy_score = econ.get("final", 0.0)
    for ex in econ.get("explain", []):
        text = ex.get("text", "") if isinstance(ex, dict) else str(ex)
        polarity = ex.get("type", "positive") if isinstance(ex, dict) else ("negative" if any(k in text.lower() for k in NEGATIVE_KEYWORDS) else "positive")

        if polarity == "negative":
            cons.append(text)
        else:
            pros.append(text)

    budget_overrun = econ.get("budget_overrun", False)
    budget_overrun_amount = econ.get("budget_overrun_amount", 0.0)

    if features.get("place_benefits"):
        pros.append("Налоговые льготы площадки")

    if user_req.railwayRequired:
        dist_railway = features.get("dist_railway")
        has_railway = features.get("has_railway")
        
        if dist_railway is None:
            if has_railway is False:
                cons.append("Нет ЖД ветки (критично для ТЗ)")
                hard_penalty *= 0.35
            else:
                risks_list.append("Неизвестно наличие ЖД ветки")
                hard_penalty *= 0.75
        else:
            try:
                dist_railway_val = float(dist_railway)
                if dist_railway_val > 25:
                    cons.append(f"Удаленность до ЖД ветки ({dist_railway_val} км > 25 км)")
                    hard_penalty *= math.exp(-0.12 * (dist_railway_val - 25))
                else:
                    pros.append(f"Близость к ЖД ветке ({dist_railway_val} км)")
            except (ValueError, TypeError):
                pass
            
    dist_highway = features.get("dist_highway")
    if dist_highway is not None:
        try:
            dist_highway_val = float(dist_highway)
            if dist_highway_val > user_req.maxDistanceToHighwayKm:
                excess = dist_highway_val - user_req.maxDistanceToHighwayKm
                cons.append(f"Удаленность от трассы ({dist_highway_val} км > {user_req.maxDistanceToHighwayKm} км)")
                hard_penalty *= math.exp(-0.08 * excess)
        except (ValueError, TypeError):
            pass

    # Penalize if land + connection exceed investor budget
    if land_conn_mln > user_req.budgetMillionRub > 0:
        budget_overrun_ratio = (land_conn_mln - user_req.budgetMillionRub) / max(1.0, float(user_req.budgetMillionRub))
        hard_penalty *= math.exp(-4.0 * budget_overrun_ratio)
        cons.append(f"Покупка участка и подключение выходит за бюджет на {round(land_conn_mln - user_req.budgetMillionRub, 2)} млн руб")

    if features["square"] < min_required_square:
        deficit_ratio = (min_required_square - features["square"]) / max(1.0, min_required_square)
        hard_penalty *= math.exp(-5.0 * deficit_ratio)

    weighted_sum = (
        weights["logistics"] * logistics_score +
        weights["energy"] * energy_score +
        weights["labor"] * labor_score +
        weights["social"] * social_score +
        weights["economy"] * economy_score
    )
    score = weighted_sum ** 1.15

    size_bonus = normalize(features["square"], min_required_square, min_required_square * 5) * 0.05
    score *= (1 + size_bonus)
    
    if user_req.architecturePriority == "authentic":
        score *= 1.03
        pros.append("Культурный код региона совпадает с бизнес-запросом")

    breakdown_dict = {
        "Логистика": logistics_score, "Энергетика": energy_score,
        "Кадры": labor_score, "Социальная среда": social_score, "Экономика": economy_score
    }
    top_factor = max(breakdown_dict, key=breakdown_dict.get)

    risk = ECO_MAP.get(features["ecology_class"], 0.05)
    risk = max(0.0, min(1.0, risk + risk_effect))
    
    confidence = compute_confidence(features, user_req, estimate, n_region_places=n_places)
    
    score *= hard_penalty
    score *= (1 - risk)
    # Confidence should refine ranking, not dominate it through region size.
    score *= (0.92 + 0.08 * confidence)
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

    enriched_regions = copy.deepcopy(REGIONS_DB)

    def compute_region_score(region, user_req: UserRequest):
        tariff = region.get("economy", {}).get("industrial_electricity_tariff_rub_kwh", 5.0)
        power_capacity = region.get("network_infrastructure", {}).get("available_electrical_capacity_kva", 0)
        avg_salary = region.get("economy", {}).get("average_monthly_salary_rub", 50000)
        
        # Интеграция новых социальных полей на уровне региона
        soc_infra = region.get("social_infrastructure", {})
        kindergarten = soc_infra.get("kindergarten_availability_per_100_children", 50)
        urban_index = soc_infra.get("urban_environment_index", 180)
        rent_price = soc_infra.get("average_1room_apartment_rent_rub", 25000)
        colleges = soc_infra.get("profile_colleges_budget_places", 1000)
        
        region_benefits = region.get("economy", {}).get("benefits", [])
        has_benefits = len(region_benefits) > 0

        places = region.get("places", []) or []
        gas_count = 0
        if places:
            ds = [float(p.get("min_dist_km_to_metallurgical_factory", 500)) for p in places if p.get("min_dist_km_to_metallurgical_factory") is not None]
            di = [float(p.get("min_dist_km_to_insulation_factory", 500)) for p in places if p.get("min_dist_km_to_insulation_factory") is not None]
            avg_dist_steel = statistics.median(ds) if ds else 500
            avg_dist_insulation = statistics.median(di) if di else 500
            # Считаем количество участков с газом
            gas_count = sum(1 for p in places if p.get("infrastructure", {}).get("has_gas", False))
        else:
            avg_dist_steel = 500
            avg_dist_insulation = 500

        rail_support = 0.0
        highway_support = 0.0
        if places:
            rail_flags = []
            highway_flags = []
            for p in places:
                dist_railway = p.get("distance_to_the_nearest_railway_station_km")
                has_railway = p.get("has_railway")
                if has_railway is True:
                    rail_flags.append(1.0)
                elif dist_railway is not None:
                    try:
                        rail_flags.append(1.0 if float(dist_railway) <= 25 else 0.0)
                    except (ValueError, TypeError):
                        rail_flags.append(0.0)
                else:
                    rail_flags.append(0.0)

                dist_highway = p.get("distance_to_the_nearest_federal_highway_km", p.get("distance_to_highway_km", None))
                if dist_highway is not None:
                    try:
                        highway_flags.append(1.0 if float(dist_highway) <= user_req.maxDistanceToHighwayKm else 0.0)
                    except (ValueError, TypeError):
                        highway_flags.append(0.0)
                else:
                    highway_flags.append(0.0)

            rail_support = sum(rail_flags) / len(rail_flags) if rail_flags else 0.0
            highway_support = sum(highway_flags) / len(highway_flags) if highway_flags else 0.0

        # Region-level logistics: exponential decay to reduce saturation
        lam = 0.005
        rs = math.exp(-lam * max(0.0, avg_dist_steel))
        ri = math.exp(-lam * max(0.0, avg_dist_insulation))
        base_logistics = (rs + ri) / 2.0
        scenario = build_scenario_profile(user_req, None)
        weights = scenario["weights"]
        pressures = scenario["pressures"]

        logistics_score = (
            base_logistics * (1.0 + pressures["volume"] * 0.20)
            + 0.12 * rail_support
            + 0.06 * highway_support
        )
        logistics_score = max(0.0, min(0.98, logistics_score))
        if user_req.railwayRequired and rail_support < 0.5:
            logistics_score *= 0.75

        # Бонус к энергетике региона за уровень газификации промзон
        tariff_score = 1.0 - normalize(tariff, 3.0, 8.0)
        energy_score = (tariff_score + normalize(power_capacity, 5000, 20000)) / 2
        gas_ratio = (gas_count / len(places)) if places else 0.0
        energy_score = min(1.0, energy_score + (0.1 * gas_ratio) + (0.06 * pressures["volume"]))

        # Новый расчет labor_score на уровне региона
        salary_factor = 1.0 - normalize(avg_salary, 30000, 120000)
        rent_factor = 1.0 - normalize(rent_price, 15000, 50000)
        colleges_factor = normalize(colleges, 500, 5000)
        labor_score = (salary_factor * 0.5) + (rent_factor * 0.2) + (colleges_factor * 0.3)
        labor_score = max(0.0, min(1.0, labor_score * (1.0 + pressures["labor"] * 0.2) + (0.05 * pressures["housing"])))
        
        # Новый расчет social_score на уровне региона
        urban_factor = normalize(urban_index, 150, 300)
        social_score = (normalize(kindergarten, 50, 100) * 0.6) + (urban_factor * 0.4)
        social_score = max(0.0, min(1.0, social_score + (0.08 * pressures["childcare"]) + (0.05 * pressures["housing"])))

        conn_fee_raw = region.get("network_infrastructure", {}).get("technological_connection_fee_rub_kw")
        conn_fee = float(conn_fee_raw) if conn_fee_raw is not None else 10000.0
        
        prices = []
        for p in places:
            pr = p.get("price_rub", p.get("price", None))
            try:
                pr_mln = float(pr) / 1_000_000.0 if pr is not None else 0.0
            except (ValueError, TypeError):
                pr_mln = 0.0
                
            infra = p.get("infrastructure", {})
            p_conn_fee = infra.get("connection_cost_per_kw")
            p_conn_fee = float(p_conn_fee) if p_conn_fee is not None else conn_fee
            
            p_dist_power = infra.get("distance_to_substation_km", 10)
            p_dist_power = float(p_dist_power) if p_dist_power is not None else 10.0
            p_distance_penalty = 1.0 if p_dist_power <= 5 else (1.0 + (p_dist_power * 0.02))

            conn_cost_mln = (500 * p_conn_fee * p_distance_penalty) / 1_000_000.0
            prices.append(pr_mln + conn_cost_mln)
            
        region_total_cost_mln = statistics.median(prices) if prices else REF_RANGES["capex"][1]

        region_features = {"tariff": tariff, "salary": avg_salary, "has_benefits": has_benefits}
        econ = compute_economy_score(region_features, user_req, region_total_cost_mln)
        economy_score = econ.get("final", 0.0)

        pros, cons, risks_list = [], [], []
        for ex in econ.get("explain", []):
            text = ex.get("text", "") if isinstance(ex, dict) else str(ex)
            polarity = ex.get("type", "positive") if isinstance(ex, dict) else ("negative" if any(k in text.lower() for k in NEGATIVE_KEYWORDS) else "positive")
            (cons if polarity == "negative" else pros).append(text)

        budget = float(user_req.budgetMillionRub or 0)
        budget_pressure = 0.0
        if budget > 0:
            budget_pressure = clamp01((region_total_cost_mln - budget) / max(1.0, budget))

        if budget_pressure > 0:
            economy_score = max(0.0, economy_score * math.exp(-4.0 * budget_pressure))
            cons.append(f"Сценарий выходит за бюджет на {round(region_total_cost_mln - budget, 2)} млн руб")

        if user_req.railwayRequired and rail_support < 0.5:
            cons.append("Слабая железнодорожная поддержка по региону")

        weighted_sum = (
            weights["logistics"] * logistics_score +
            weights["energy"] * energy_score +
            weights["labor"] * labor_score +
            weights["social"] * social_score +
            weights["economy"] * economy_score
        )
        score = weighted_sum ** 1.08

        scenario_penalty = 1.0
        if user_req.railwayRequired:
            scenario_penalty *= (0.35 + 0.65 * rail_support)
        scenario_penalty *= (0.70 + 0.30 * highway_support)
        score *= scenario_penalty

        risk = ECO_MAP.get(region.get("economy", {}).get("ecological_class_iza", "Средний"), 0.05)
        confidence = max(0.0, min(1.0, 1.0 - (risk + 0.05)))

        breakdown = {
            "logistics": round(logistics_score, 3), "energy": round(energy_score, 3),
            "labor": round(labor_score, 3), "social": round(social_score, 3), "economy": round(economy_score, 3),
        }

        if has_benefits: pros.append("Налоговые льготы региона")
        if avg_dist_steel < 200: pros.append("Близость к поставщику стали")
        if power_capacity < 1000: cons.append("Низкая доступная мощность по региону")

        top_factor = max(breakdown, key=breakdown.get)

        return {
            "total_score": round(max(0.0, min(1.0, score)), 3),
            "confidence": round(confidence, 2),
            "breakdown": breakdown,
            "why": {"top_factor": top_factor, "pros": pros, "cons": cons, "risks": risks_list},
        }

    region_rankings = []
    
    for region in enriched_regions:
        original_places = region.get("places", []) or []
        valid_places = []
        for p in original_places:
            square_ha = p.get("square_ha", p.get("square", 0))
            try:
                p["square_m2"] = float(square_ha) * 10000
            except (ValueError, TypeError):
                p["square_m2"] = 0
                
            if passes_filters(p, request):
                valid_places.append(p)
                
        region["places"] = valid_places

        if not valid_places:
            # Keep a narrow fallback so a region is not fully removed when
            # strict filters eliminate every place; the score penalties still
            # push weak regions down.
            if not original_places:
                continue
            fallback_places = sorted(
                original_places,
                key=lambda p: float(p.get("square_m2", 0) or 0),
                reverse=True,
            )[:2]
            region["places"] = fallback_places
        else:
            region["places"] = valid_places

        rscore = compute_region_score(region, request)
        base_region_score = rscore["total_score"]
        
        n_places = len(region["places"])
        
        for place in region["places"]:
            features = compute_features(region, place)
            score_data = compute_score(features, request, n_places)
            # Skip places that received a zero total score
            if score_data.get("total_score", 0.0) <= 0.0:
                continue

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
            place["_full_score"] = score_data
            
        # Keep only places that were assigned a full score (filter out zero-scored ones)
        scored_places = [p for p in region["places"] if p.get("_full_score")]
        region_places_sorted = sorted(
            scored_places,
            key=lambda p: p.get("_full_score", {}).get("total_score", 0) * p.get("_full_score", {}).get("confidence", 1),
            reverse=True
        )
        region["places"] = region_places_sorted
        if not region_places_sorted:
            continue

        top_3_places = region_places_sorted[:3]
        top_3_scores = [p["_full_score"]["total_score"] for p in top_3_places]
        
        median_top3 = statistics.median(top_3_scores) if top_3_scores else 0.0
        
        final_region_score = (0.5 * base_region_score) + (0.5 * median_top3)
        
        rscore["total_score"] = round(final_region_score, 3)

        region_rankings.append({"region": region, "score": rscore})

    top_regions = sorted(region_rankings, key=lambda x: x["score"]["total_score"], reverse=True)[:3]

    if not top_regions:
        # Instead of returning 404 (which breaks gateway/form flow), return an empty list
        # with no error so the gateway can present a user-friendly message.
        return []

    results = []
    for rr in top_regions:
        region = rr["region"]
        region_score = rr["score"]
        best_place = region.get("places", [])[0] if region.get("places", []) else None
        
        results.append({
            "region_name": region.get("region_name"),
            "place_name": best_place.get("place_name", "Неизвестно") if best_place else region.get("region_name"),
            "score": region_score["total_score"],
            "confidence": region_score["confidence"],
            "breakdown": region_score["breakdown"],
            "why": region_score["why"],
            "region_info": region,
        })

    for res in results:
        for p in res["region_info"].get("places", []):
            p.pop("_full_score", None)
    
    return results

@app.get("/health")
async def health_check():
    return {"status": "ok"}