import json
import copy
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
    insulation_type: str = "ППУ"

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
        "ecology_class": region.get("economy", {}).get("ecological_class_iza", "Средний"),
        "has_railway": place.get("has_railway", None),
        "dist_highway": place.get("distance_to_highway_km", None)
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


# --- 5. ЯДРО СКОРИНГА ---

def compute_score(features, user_req: UserRequest):
    pros, cons, risks_list = [], [], []
    missing_data_points = 0

    if features["power_capacity"] == 0: missing_data_points += 1
    if features["salary"] == 50000: missing_data_points += 1

    # Валидация жестких фильтров для формирования cons
    min_required_square = user_req.productionVolume * 10
    if features["square"] < min_required_square:
        cons.append(f"Площадь участка ({features['square']} м²) меньше требуемой по ТЗ ({min_required_square} м²)")
    if features["dist_power"] > 100:
        cons.append(f"Критическое расстояние до подстанции ({features['dist_power']} км > 100 км)")

    # Смета считается строго на базе фичей текущей площадки!
    estimate = compute_estimate(features, user_req)
    total_cost_mln = estimate["total_mln_rub"]

    # 1. Логистика
    base_logistics = ((1 / (1 + features["dist_steel"] / 50)) + (1 / (1 + features["dist_insulation"] / 50))) / 2
    vol_factor = normalize(user_req.productionVolume, 100, 1000) 
    logistics_score = base_logistics * (1 + vol_factor * 0.2)
    logistics_score = min(1.0, logistics_score)
    
    if features["dist_steel"] < 50:
        pros.append(f"Близость к поставщику стали ({features['dist_steel']} км)")

    # 2. Энергия
    tariff_score = 1.0 - normalize(features["tariff"], 3.0, 8.0)
    energy_score = (tariff_score + normalize(features["power_capacity"], 5000, 20000)) / 2

    # 3. Труд
    labor_score = 1.0 - normalize(features["salary"], 30000, 120000)

    # 4. Социалка
    social_score = normalize(features["kindergarten"], 50, 100)
    gap = user_req.kindergartenPlacesPer100 - (features["kindergarten"] * 0.5) 
    if gap > 0:
        social_score -= normalize(gap, 0, 50)
        risks_list.append("Дефицит мест в детских садах региона")
    social_score = max(0.0, min(1.0, social_score))

    # 5. Экономика — ТЕПЕРЬ ОЦЕНИВАЕТ РЕАЛЬНУЮ СМЕТУ ЭТОЙ ПЛОЩАДКИ
    economy_score = 1.0 if features["has_benefits"] else 0.4
    
    if total_cost_mln > user_req.budgetMillionRub:
        economy_score *= 0.6
        cons.append(f"Индивидуальная смета площадки ({total_cost_mln} млн руб) превышает лимит инвестора ({user_req.budgetMillionRub} млн руб)")
    else:
        economy_score = min(1.0, economy_score + 0.2)
        pros.append(f"Площадка укладывается в бюджет инвестора (Смета: {total_cost_mln} млн руб)")

    if features["has_benefits"]:
        pros.append("Налоговые льготы (ОЭЗ/ТОР)")

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

    # 6. Равнозначная сумма
    weighted_sum = (logistics_score + energy_score + labor_score + social_score + economy_score) / 5.0
    score = weighted_sum ** 1.1

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
    confidence = max(0.0, min(1.0, 1.0 - (risk + (missing_data_points * 0.15))))
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
        }
    }


# --- 6. ENDPOINT ---

@app.post("/score", response_model=List[ScoredPlace])
def rank_places(request: UserRequest):
    if not REGIONS_DB:
        raise HTTPException(status_code=500, detail="База не загружена")

    # Делаем глубокую копию базы регионов, чтобы изолированно обогатить данные мест
    enriched_regions = copy.deepcopy(REGIONS_DB)
    results = []
    
    for region_data in enriched_regions:
        # Шаг 1: Пробегаемся абсолютно по всем площадкам региона и вшиваем ИНДИВИДУАЛЬНУЮ аналитику и смету
        for place in region_data.get("places", []):
            features = compute_features(region_data, place)
            score_data = compute_score(features, request)
            
            # Смета и инсайты теперь лежат прямо внутри объекта площадки (для карты и поп-апов на фронте)
            place["estimate"] = score_data["estimate"]
            place["insights"] = {
                "score": score_data["total_score"],
                "confidence": score_data["confidence"],
                "pros": score_data["why"]["pros"],
                "cons": score_data["why"]["cons"],
                "risks": score_data["why"]["risks"]
            }
            # Сохраняем полный скоринг во временную переменную, чтобы повторно не вычислять
            place["_full_score"] = score_data

        # Шаг 2: Фильтруем только те площадки, которые проходят жесткие критерии, чтобы сформировать ТОП-3
        for place in region_data.get("places", []):
            if not passes_filters(place, request):
                continue
            
            score_data = place["_full_score"]
            
            results.append({
                "region_name": region_data["region_name"],
                "place_address": place["place_address"],
                "score": score_data["total_score"],
                "confidence": score_data["confidence"],
                "breakdown": score_data["breakdown"],
                "why": score_data["why"],
                "region_info": region_data  # Отдаем регион с полностью размеченным массивом places внутри
            })

    if not results:
        raise HTTPException(status_code=404, detail="Нет участков под эти фильтры")

    # Глобальная умная сортировка ТОП-3
    sorted_results = sorted(results, key=lambda x: (x["score"], x["confidence"]), reverse=True)[:3]
    
    # Стираем технические временные ключи перед сериализацией ответа
    for res in sorted_results:
        for p in res["region_info"]["places"]:
            p.pop("_full_score", None)
    
    return sorted_results