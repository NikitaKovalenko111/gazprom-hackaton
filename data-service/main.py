import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# --- 1. PYDANTIC МОДЕЛИ С НОВЫМИ ФИЧАМИ ---

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
    insulation_type: str = "ППУ"
    # Killer feature: Режим инвестора
    strategy: str = "balanced"  # Варианты: "balanced", "cheap", "fast_launch", "long_term"
    # Базовые веса (будут корректироваться стратегией)
    weight_logistics: float = 1.0
    weight_energy: float = 1.0
    weight_labor: float = 1.0
    weight_social: float = 1.0
    weight_economy: float = 1.0

class ScoreBreakdown(BaseModel):
    logistics: float
    energy: float
    labor: float
    social: float
    economy: float

class WhyInsights(BaseModel):
    top_factor: str  # Главный драйвер высокой оценки
    pros: List[str]
    cons: List[str]
    risks: List[str]

class ScoredPlace(BaseModel):
    region_name: str
    place_address: str
    score: float
    confidence: float
    breakdown: ScoreBreakdown
    why: WhyInsights

# --- 2. ИНИЦИАЛИЗАЦИЯ ---

app = FastAPI(title="Location Scoring Service - Enterprise Edition")

try:
    with open("example.json", "r", encoding="utf-8") as f:
        REGIONS_DB = json.load(f)
except FileNotFoundError:
    REGIONS_DB = []
    print("ВНИМАНИЕ: Файл example.json не найден!")

def normalize(value, min_val, max_val):
    if max_val == min_val: return 0.0
    if value <= min_val: return 0.0
    if value >= max_val: return 1.0
    return (value - min_val) / (max_val - min_val)

ECO_MAP = {"Низкий": 0.0, "Средний": 0.05, "Повышенный": 0.1}

# --- 3. ФИЛЬТРЫ И ФИЧИ ---

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
        "salary": region.get("economy", {}).get("average_monthly_salary_rub", 50000),
        "kindergarten": region.get("social_infrastructure", {}).get("kindergarten_availability_per_100_children", 50),
        "has_benefits": region.get("economy", {}).get("has_tax_incentives_tor_oez", False),
        "ecology_class": region.get("economy", {}).get("ecological_class_iza", "Средний"),
        # Достаем критичные параметры напрямую из площадки
        "has_railway": place.get("has_railway", None),
        "dist_highway": place.get("distance_to_highway_km", None)
    }

# --- 4. ЯДРО СКОРИНГА ---

def compute_score(features, user_req: UserRequest):
    pros, cons, risks_list = [], [], []
    missing_data_points = 0

    # Трекинг missing data для Confidence (Пункт 4)
    if features["power_capacity"] == 0: missing_data_points += 1
    if features["salary"] == 50000: missing_data_points += 1

    # KILLER FEATURE: Режим инвестора
    w_logistics = user_req.weight_logistics
    w_energy = user_req.weight_energy
    w_labor = user_req.weight_labor
    w_social = user_req.weight_social
    w_economy = user_req.weight_economy

    if user_req.strategy == "cheap":
        w_economy *= 1.5
        w_labor *= 1.5
    elif user_req.strategy == "fast_launch":
        w_logistics *= 1.5
        w_energy *= 1.5
    elif user_req.strategy == "long_term":
        w_social *= 1.5
        w_economy *= 1.2

    # 1. Логистика (Усилена объемами - Пункт 3)
    base_logistics = ((1 / (1 + features["dist_steel"] / 50)) + (1 / (1 + features["dist_insulation"] / 50))) / 2
    # Объем выпуска 100-1000 тыс. м2 [cite: 28]
    vol_factor = normalize(user_req.productionVolume, 100, 1000) 
    logistics_score = base_logistics * (1 + vol_factor * 0.2) # Чем выше объем, тем сильнее влияет близость
    logistics_score = min(1.0, logistics_score)
    
    if features["dist_steel"] < 50:
        pros.append(f"Близость к поставщику стали ({features['dist_steel']} км)")

    # 2. Энергия
    tariff_score = 1.0 - normalize(features["tariff"], 3.0, 8.0)
    energy_score = (tariff_score + normalize(features["power_capacity"], 5000, 20000)) / 2

    # 3. Труд
    labor_score = 1.0 - normalize(features["salary"], 30000, 120000)

    # 4. Социалка (GAP-анализ - Пункт 2)
    social_score = normalize(features["kindergarten"], 50, 100)
    # Если запрашиваем больше мест, чем регион может комфортно дать
    gap = user_req.kindergartenPlacesPer100 - (features["kindergarten"] * 0.5) 
    if gap > 0:
        social_score -= normalize(gap, 0, 50)
        risks_list.append("Дефицит мест в детских садах региона (нагрузка на инвестора)")
    social_score = max(0.0, min(1.0, social_score))

    # 5. Экономика
    economy_score = 1.0 if features["has_benefits"] else 0.2
    if features["has_benefits"]:
        pros.append("Налоговые льготы (ОЭЗ/ТОР)")

    # Учет критичных параметров (ЖД и Трасса - Пункт 5) [cite: 31]
    if user_req.railwayRequired:
        if features["has_railway"] is False:
            cons.append("Нет ЖД ветки (критично для ТЗ)")
            logistics_score *= 0.5
        elif features["has_railway"] is None:
            risks_list.append("Неизвестно наличие ЖД ветки")
            missing_data_points += 1
            logistics_score *= 0.8
            
    if features["dist_highway"] is None:
        missing_data_points += 1
    elif features["dist_highway"] > user_req.maxDistanceToHighwayKm:
        cons.append(f"Удаленность от трассы ({features['dist_highway']} км > {user_req.maxDistanceToHighwayKm} км)")
        logistics_score *= 0.7

    # 6. Взвешенная сумма с честными весами
    total_weight = sum([w_logistics, w_energy, w_labor, w_social, w_economy]) or 1.0
    weighted_sum = (
        w_logistics * logistics_score +
        w_energy * energy_score +
        w_labor * labor_score +
        w_social * social_score +
        w_economy * economy_score
    ) / total_weight

    score = weighted_sum ** 1.1

    # 7. Бонусы и штрафы как мультипликаторы (Защита от инфляции - Пункт 1)
    min_required_square = user_req.productionVolume * 10
    size_bonus = normalize(features["square"], min_required_square, min_required_square * 5) * 0.05
    score *= (1 + size_bonus)
    if size_bonus > 0.03: pros.append("Масштаб участка позволяет кратно расширить производство")

    if user_req.architecturePriority == "authentic":
        score *= 1.03
        pros.append("Культурный код региона совпадает с бизнес-запросом")

    # 8. Explainability (Пункт 6)
    breakdown_dict = {
        "Логистика": logistics_score, "Энергетика": energy_score,
        "Кадры": labor_score, "Социальная среда": social_score, "Экономика": economy_score
    }
    top_factor = max(breakdown_dict, key=breakdown_dict.get)

    # 9. Истинный Confidence (Пункт 4)
    risk = ECO_MAP.get(features["ecology_class"], 0.05)
    confidence = max(0.0, min(1.0, 1.0 - (risk + (missing_data_points * 0.15))))
    score *= (1 - risk) # Риск сжигает итоговый скор

    score = max(0.0, min(1.0, score))

    return {
        "total_score": round(score, 3),
        "confidence": round(confidence, 2),
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
        }
    }

# --- 5. ENDPOINT ---

@app.post("/score", response_model=List[ScoredPlace])
def rank_places(request: UserRequest):
    if not REGIONS_DB:
        raise HTTPException(status_code=500, detail="База не загружена")

    results = []
    for region_data in REGIONS_DB:
        for place in region_data.get("places", []):
            if not passes_filters(place, request):
                continue
            
            features = compute_features(region_data, place)
            score_data = compute_score(features, request)
            
            results.append({
                "region_name": region_data["region_name"],
                "place_address": place["place_address"],
                "score": score_data["total_score"],
                "confidence": score_data["confidence"],
                "breakdown": score_data["breakdown"],
                "why": score_data["why"]
            })

    if not results:
        raise HTTPException(status_code=404, detail="Нет участков под эти фильтры")

    # Умная сортировка: Сначала по скору, при равенстве - по уверенности (Пункт 7)
    sorted_results = sorted(results, key=lambda x: (x["score"], x["confidence"]), reverse=True)[:3]
    
    return sorted_results