import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

# --- 1. PYDANTIC МОДЕЛИ ДЛЯ ВАЛИДАЦИИ ВХОДНЫХ ДАННЫХ ---

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
    # Добавляем веса и скрытые параметры для гибкости (можно передавать с фронта или задавать жестко)
    insulation_type: str = "ППУ" # По ТЗ не вводится юзером, но влияет на логику
    weight_logistics: float = 1.0
    weight_energy: float = 1.0
    weight_labor: float = 1.0
    weight_social: float = 1.0
    weight_economy: float = 1.0

# Вспомогательные структуры для ответа
class ScoreBreakdown(BaseModel):
    logistics: float
    energy: float
    labor: float
    social: float
    economy: float

class ScoredPlace(BaseModel):
    region_name: str
    place_address: str
    score: float
    breakdown: ScoreBreakdown
    why: List[str]

# --- 2. ИНИЦИАЛИЗАЦИЯ FASTAPI И ЗАГРУЗКА БАЗЫ ---

app = FastAPI(title="Location Scoring Service")

# Загружаем базу регионов при старте приложения
try:
    with open("example.json", "r", encoding="utf-8") as f:
        REGIONS_DB = json.load(f)
except FileNotFoundError:
    REGIONS_DB = []
    print("ВНИМАНИЕ: Файл example.json не найден!")

# --- 3. ФУНКЦИИ СКОРИНГА ---

def normalize(value, min_val, max_val):
    """Нормализация значения к диапазону 0-1."""
    if value <= min_val:
        return 0.0
    if value >= max_val:
        return 1.0
    return (value - min_val) / (max_val - min_val)

def passes_filters(region, place, user_req: UserRequest) -> bool:
    """Жесткие фильтры (например, по бюджету или специфичным требованиям)."""
    # Здесь можно добавить проверку railwayRequired, если бы это поле было в place
    # Пока оставим базовую заглушку, чтобы пропускать все участки на этап скоринга
    return True

def compute_features(region, place):
    """Извлечение нужных признаков из вложенных JSON."""
    return {
        "dist_steel": place.get("distance_to_the_supplier_of_rolled_steel_km", 100),
        "dist_insulation": place.get("distance_to_the_insulation_supplier_km", 100),
        "dist_power": place.get("distance_to_the_nearest_electric_substation_km", 10),
        "tariff": region["economy"].get("industrial_electricity_tariff_rub_kwh", 5.0),
        "power_capacity": region["network_infrastructure"].get("available_electrical_capacity_kva", 0),
        "salary": region["economy"].get("average_monthly_salary_rub", 50000),
        "kindergarten": region["social_infrastructure"].get("kindergarten_availability_per_100_children", 50),
        "has_benefits": region["economy"].get("has_tax_incentives_tor_oez", False),
        "ecology_class": region["economy"].get("ecological_class_iza", "Средний")
    }

def compute_score(features, user_req: UserRequest):
    """Ядро эвристической модели."""
    reasons = []

    # 1. Логистика: Чем ближе, тем лучше. Штрафуем за расстояния больше 50 км.
    logistics_score = (
        (1 / (1 + features["dist_steel"] / 50)) +
        (1 / (1 + features["dist_insulation"] / 50))
    ) / 2
    if logistics_score > 0.7: reasons.append("Отличная логистика сырья")

    # 2. Энергия: Дешевый тариф и наличие мощности
    energy_score = (
        (1 / (features["tariff"] / 3.0)) + # предполагаем идеальный тариф 3.0
        normalize(features["power_capacity"], 5000, 20000)
    ) / 2
    if energy_score > 0.7: reasons.append("Выгодные тарифы на э/э")

    # 3. Труд: Выше зарплата -> ниже балл (дороже ФОТ)
    # Инвертируем нормализацию: чем выше ЗП, тем хуже для инвестора
    labor_score = 1.0 - normalize(features["salary"], 30000, 120000)
    
    # 4. Социалка: Обеспеченность садами (важно для удержания)
    social_score = normalize(features["kindergarten"], 50, 100)

    # 5. Экономика: Наличие льгот
    economy_score = 1.0 if features["has_benefits"] else 0.2
    if economy_score == 1.0: reasons.append("Действуют налоговые льготы (ОЭЗ/ТОР)")

    # 6. Взвешенная сумма
    weighted_sum = (
        user_req.weight_logistics * logistics_score +
        user_req.weight_energy * energy_score +
        user_req.weight_labor * labor_score +
        user_req.weight_social * social_score +
        user_req.weight_economy * economy_score
    ) / 5.0 # Нормируем обратно к ~1.0

    # 7. Нелинейность
    score = weighted_sum ** 1.1

    # 8. Пороговые штрафы (Threshold penalties)
    if logistics_score < 0.3:
        score *= 0.6
        reasons.append("Внимание: дорогая логистика")
    if energy_score < 0.3:
        score *= 0.7

    # 9. Risk penalty
    risk = 0.0
    if features["ecology_class"] == "Повышенный":
        risk += 0.1
        reasons.append("Риск: высокие экологические требования")
    if features["dist_power"] > 20:
        risk += 0.1
        reasons.append("Риск: дорогое тех. присоединение (>20 км)")
    
    score -= risk

    # 10. Контекст (фишка)
    if user_req.insulation_type == "ППУ":
        score += energy_score * 0.1 # Для ППУ критичнее энергетика
    
    # Не даем скору уйти в минус
    score = max(0.0, score)

    return {
        "total_score": round(score, 3),
        "breakdown": {
            "logistics": round(logistics_score, 3),
            "energy": round(energy_score, 3),
            "labor": round(labor_score, 3),
            "social": round(social_score, 3),
            "economy": round(economy_score, 3)
        },
        "why": reasons
    }

# --- 4. ENDPOINTS ---

@app.post("/score", response_model=List[ScoredPlace])
def rank_places(request: UserRequest):
    """
    Эндпоинт, принимающий параметры инвестора и возвращающий ТОП-3 площадок.
    """
    if not REGIONS_DB:
        raise HTTPException(status_code=500, detail="База регионов не загружена")

    results = []

    for region_data in REGIONS_DB:
        for place in region_data.get("places", []):
            
            # Пропускаем, если не прошел жесткие фильтры
            if not passes_filters(region_data, place, request):
                continue
            
            features = compute_features(region_data, place)
            score_data = compute_score(features, request)
            
            results.append({
                "region_name": region_data["region_name"],
                "place_address": place["place_address"],
                "score": score_data["total_score"],
                "breakdown": score_data["breakdown"],
                "why": score_data["why"]
            })

    # Сортируем по убыванию скора и берем ТОП-3
    sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)[:3]
    
    return sorted_results