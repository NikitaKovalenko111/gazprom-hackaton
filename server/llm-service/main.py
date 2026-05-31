import json
import logging
import os
import time
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from google import genai

from api_keys import keys, keys_pptx
# Импортируем резервные функции из нашего модуля fallbacks
from reserve_pptx_shablon import render_fallback_report, render_fallback_pptx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "models/gemini-3.5-flash"


def _is_quota_or_rate_limit_error(error: Exception) -> bool:
    message = str(error).lower()
    keywords = (
        "quota",
        "rate limit",
        "too many requests",
        "429",
        "resource exhausted",
        "requests per minute",
        "rpm",
        "tokens",
        "token",
        "exceeded",
    )
    return any(keyword in message for keyword in keywords)


def build_prompt(data: Dict[str, Any]) -> str:
    # Извлекаем профиль цветов региона для единого стиля
    color_profile = data.get("cultural_code", {}).get("color_profile", {})
    primary_color = color_profile.get("primary", "#009B77")
    secondary_color = color_profile.get("secondary", "#FFFFFF")
    accent_color = color_profile.get("accent", "#F7D117")

    return f"""
На основе предоставленных данных о регионе напиши аналитическую справку для инвестора. 
Делай упор на входные данные и жестко следуй указанным формулам расчета сметы и нормативам из ТЗ.

ОТВЕТ ДОЛЖЕН БЫТЬ В ВИДЕ ЧИСТОГО HTML (БЕЗ разметки ```html и ```, только готовый для вставки код внутри контейнера div).

### ТРЕБОВАНИЯ К ДИЗАЙНУ И СТИЛИЗАЦИИ:
1. Используй цветовую палитру региона для элементов:
   - Основной цвет (Primary): {primary_color}
   - Фоновый цвет плашек: rgba(0, 155, 119, 0.04) (или твой primary с низкой прозрачностью)
   - Акцентный цвет (Accent): {accent_color}
2. Верстка должна быть адаптивной и современной:
   - Карточки с `border-radius: 12px;`, мягкими тенями `box-shadow: 0 4px 12px rgba(0,0,0,0.05);`
   - Таблицы с тонкими границами, стильным `thead` (фоновый цвет - Primary, текст белый).
   - Четкие визуальные иконки или маркеры списков.

### СТРУКТУРА СПРАВКИ (Сгенерируй ровно эти разделы):

1. <div class="section-block">
   <h2>1. План благоустройства территории</h2>
   Опиши интеграцию завода в ландшафт. Учти:
   - Доминирующие стили: {data.get('cultural_code', {}).get('dominant_architectural_styles', [])}
   - Цвета и материалы: {data.get('cultural_code', {}).get('traditional_materials_ornaments', [])}
   - Создай стильное описание рекреационных зон (аллеи, скверы, арт-объекты с использованием национальных паттернов).
   </div>

2. <div class="section-block">
   <h2>2. Рекомендации по привлечению и удержанию персонала</h2>
    - Анализ социального паспорта: жилье (аренда {data.get('social_infrastructure', {}).get('average_1room_apartment_rent_rub', '—')} руб., детские сады {round(float(data.get('social_infrastructure', {}).get('kindergarten_availability_per_100_children', 0)))}%).
   - Кадровый потенциал: колледжи ({data.get('social_infrastructure', {}).get('profile_colleges_budget_places', '—')} бюджетных мест), средняя зарплата в регионе ({data.get('economy', {}).get('average_monthly_salary_rub', '—')} руб.).
   - Специфика транспорта: Если удаленность площадок от жилья/узлов >15 км (проанализируй координаты и расстояния), обязательно предложи запуск корпоративных автобусов.
   </div>

3. <div class="section-block">
   <h2>3. Логистические, экологические и инфраструктурные риски (Таблица)</h2>
   Создай аккуратную HTML-таблицу. Проанализируй:
   - Риски доставки сырья (расстояние до стали: { [p.get('distance_to_the_supplier_of_rolled_steel_km') for p in data.get('places', [])] } км, до утеплителя: { [p.get('distance_to_the_insulation_supplier_km') for p in data.get('places', [])] } км).
   - Экологический класс: {data.get('economy', {}).get('ecological_class_iza', '—')}.
   - Доступность сетей (электричество, газ, ТУ).
   - Выводы по минимизации рисков.
   </div>

4. <div class="section-block">
   <h2>4. Предварительный расчет площадей и сметы строительства</h2>
   Выведи понятный блок с расчетами (используй формулы из ТЗ):
   - Площадь цеха (0.4 кв.м на тыс. кв.м панелей в год), склада (цех * 0.35), АБК (цех * 0.02), дорог, жилья.
   - Итоговая укрупненная стоимость по нормативам (Цех/склад: 35 000 руб/м², АБК: 55 000 руб/м², дороги/парковки: 5000 руб/м²).
   - Оформи расчеты в виде аккуратного финансового резюме с акцентными цифрами основного цвета.
   </div>

Данные для генерации:
{json.dumps(data, ensure_ascii=False, indent=2)}
"""


def build_promt_pptx(data: Dict[str, Any]) -> str:
    # Извлекаем профиль цветов для передачи в промпт, чтобы верстка соответствовала бренду
    color_profile = data.get("cultural_code", {}).get("color_profile", {})
    primary_color = color_profile.get("primary", "#009B77")
    secondary_color = color_profile.get("secondary", "#FFFFFF")
    accent_color = color_profile.get("accent", "#F7D117")

    return f"""
На основе предоставленных данных о регионе сгенерируй презентацию для администрации из 6 слайдов в формате единого HTML-документа.
Презентация должна иметь жесткую фиксированную альбомную верстку (A4 Landscape), чтобы её можно было идеально конвертировать в PDF (через печать страницы) без смещения элементов.

### ТРЕБОВАНИЯ К ОФОРМЛЕНИЮ И CSS (КРИТИЧНО ДЛЯ ПЕЧАТИ В PDF):
1. Верни ПОЛНЫЙ валидный HTML-код (начиная с <!DOCTYPE html>).
2. НЕ используй блоки разметки markdown (```html ... ```). Выведи только чистый HTML-код.
3. Обязательно включи следующий блок стилей в <head>, ничего из него не удаляя:
   <style>
     /* Настройки принтера/PDF */
     @page {{ size: A4 landscape; margin: 0; }}
     * {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }}
     
     body {{ margin: 0; padding: 0; background-color: #e0e0e0; font-family: 'Segoe UI', Arial, sans-serif; }}
     
     /* Общий контейнер для предпросмотра на экране */
     .presentation {{ display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px 0; }}
     
     /* Стили для печати: убираем фон страницы, отступы и тени */
     @media print {{
       body {{ background-color: white; }}
       .presentation {{ display: block; padding: 0; gap: 0; }}
       .slide {{ box-shadow: none !important; margin: 0 !important; page-break-after: always; page-break-inside: avoid; }}
     }}
     
     /* Жесткие размеры слайда A4 */
     .slide {{
       width: 297mm; height: 210mm;
       background: white;
       padding: 15mm 20mm;
       position: relative;
       overflow: hidden;
       box-shadow: 0 4px 15px rgba(0,0,0,0.2);
       display: flex;
       flex-direction: column;
     }}
     
     /* Типографика и сетка */
     .slide-header {{ border-bottom: 3px solid {primary_color}; padding-bottom: 10px; margin-bottom: 20px; }}
     .slide-header h2 {{ margin: 0; color: {primary_color}; font-size: 26pt; text-transform: uppercase; }}
     .slide-content {{ flex: 1; display: flex; flex-direction: column; font-size: 16pt; color: #333; line-height: 1.5; }}
     
     .grid-2x2 {{ display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px; height: 100%; }}
     .render-card {{ background: {secondary_color}; border: 2px dashed {primary_color}; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; font-weight: bold; color: {primary_color}; font-size: 18pt; }}
     
     .data-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14pt; }}
     .data-table th {{ background-color: {primary_color}; color: white; padding: 12px; text-align: left; }}
     .data-table td {{ border-bottom: 1px solid #ddd; padding: 12px; }}
     
     .title-slide {{ align-items: center; justify-content: center; text-align: center; background-color: {primary_color}; color: white; }}
     .title-slide h1 {{ font-size: 42pt; margin-bottom: 20px; }}
     .title-slide h3 {{ font-size: 24pt; font-weight: normal; color: {accent_color}; }}
   </style>

4. Вся презентация должна быть обернута в <div class="presentation">.
5. Каждый из 6 слайдов должен быть обернут в <div class="slide"> (для первого слайда используй <div class="slide title-slide">).
6. Используй flexbox и CSS-grid. Не используй теги <br> для выравнивания высоты, верстка должна тянуться сама за счет flex.

### СТРУКТУРА ПРЕЗЕНТАЦИИ (Обязательно 6 слайдов):

Слайд 1: Титул (Используй класс .slide.title-slide, без .slide-header)
- Крупный заголовок <h1>: Инвестиционный проект развития площадок. Регион: {data.get('region_name', 'Не указан')}
- Подзаголовок <h3>: Презентация для администрации муниципалитета

Слайд 2: Параметры проекта + рабочие места (Используй .slide-header и .slide-content)
- Сводные данные по площадкам (общее количество: {len(data.get('places', []))}).
- Информация о создании рабочих мест, средняя зарплата в регионе ({data.get('economy', {}).get('average_monthly_salary_rub', '—')} руб.).
- Кадровый потенциал (профильные колледжи: {data.get('social_infrastructure', {}).get('profile_colleges_budget_places', '—')} бюджетных мест).

Слайд 3: 4 рендера (2х2)
- Используй блок <div class="grid-2x2"> внутри .slide-content.
- Создай 4 блока <div class="render-card"> с текстами:
  1. "Рендер 1: Общий вид производственного комплекса и территории"
  2. "Рендер 2: Главный фасад в региональном стиле"
  3. "Рендер 3: Внутреннее зонирование цеха"
  4. "Рендер 4: Административно-бытовой корпус"

Слайд 4: План участка с соц. объектами
- Сверстай в виде красивого маркированного списка или таблицы.
- Укажи доступность детских садов ({round(float(data.get('social_infrastructure', {}).get('kindergarten_availability_per_100_children', 0)))}%).
- Перечисли объекты инфраструктуры: корпоративный детский сад, спортивная зона, столовая.

Слайд 5: Соответствие нормативам + доступность сетей
- Сделай акцент на технических параметрах.
- Эл. мощность: {data.get('network_infrastructure', {}).get('available_electrical_capacity_kva', '—')} кВА.
- Плата за техприсоединение: {data.get('network_infrastructure', {}).get('technological_connection_fee_rub_kw', '—')} руб/кВт.

Слайд 6: Экономика + льготы + социальные выгоды для региона
- Оформи в виде таблицы (.data-table).
- Льготы: {data.get('economy', {}).get('tax_incentives_description', 'Нет налоговых льгот')}.
- Снижение страховых взносов: {'Да' if data.get('economy', {}).get('has_reduced_insurance_contributions') else 'Нет'}.
- Тариф на электроэнергию: {data.get('economy', {}).get('industrial_electricity_tariff_rub_kwh', '—')} руб./кВтч.
- Индекс городской среды: {data.get('social_infrastructure', {}).get('urban_environment_index', '—')}.
- Экологический класс: {data.get('economy', {}).get('ecological_class_iza', '—')}.

Данные региона:
{json.dumps(data, ensure_ascii=False, indent=2)}
"""


def generate_with_key_rotation(prompt: str, keys: List[str], retries_per_key: int = 3, retry_delay: int = 5):
    """Отправляет запрос, повторяет обычную ошибку до 3 раз с паузой 5 секунд.

    Если ошибка похожа на исчерпание токенов / quota / rate limit,
    сразу переключается на следующий API-ключ.
    """
    if not keys:
        raise ValueError("Нет доступных API-ключей")

    key_index = 0
    total_keys = len(keys)

    while key_index < total_keys:
        api_key = keys[key_index]
        logger.info("Используем ключ %s (индекс %d)", api_key[-6:], key_index)
        client = genai.Client(api_key=api_key)

        attempt = 0
        while attempt < retries_per_key:
            attempt += 1
            try:
                return client.models.generate_content(model=MODEL_NAME, contents=prompt)
            except Exception as error:
                if _is_quota_or_rate_limit_error(error):
                    logger.warning("Ключ #%d исчерпан или превышен лимит запросов: %s", key_index, error)
                    key_index += 1
                    break

                if attempt < retries_per_key:
                    logger.warning(
                        "Ошибка при вызове модели (попытка %s/%s) на ключе #%d: %s. Повтор через %s сек.",
                        attempt,
                        retries_per_key,
                        key_index,
                        error,
                        retry_delay,
                    )
                    time.sleep(retry_delay)
                    continue

                logger.exception("Ошибка на ключе #%d после %s попыток: %s", key_index, retries_per_key, error)
                raise

        else:
            continue

    raise RuntimeError("Не удалось получить ответ: все API-ключи закончились или были ограничены")


def _extract_response_text(response: Any) -> str:
    if hasattr(response, "text") and response.text:
        return response.text
    return str(response)


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/routes")
    def routes():
        # Отладочный endpoint: вернуть список зарегистрированных маршрутов
        rules = [r.rule for r in app.url_map.iter_rules()]
        return jsonify({"routes": sorted(rules)})

    @app.post("/echo")
    def echo():
        """Тестовый endpoint: возвращает и логирует пришедший JSON без вызова LLM."""
        try:
            payload = request.get_json(silent=False)
        except Exception:
            return jsonify({"ok": False, "error": "invalid_json"}), 400

        logger.info("/echo payload: %s", payload)
        return jsonify({"ok": True, "echo": payload})

    @app.post("/generate")
    def generate():
        try:
            payload = request.get_json(silent=False)
        except Exception:
            return jsonify({"ok": False, "error": "invalid_json"}), 400

        if payload is None:
            return jsonify({"ok": False, "error": "empty_json"}), 400

        if not isinstance(payload, dict):
            return jsonify({"ok": False, "error": "invalid_payload", "details": "Ожидается JSON-объект"}), 400

        data = payload.get("data", payload)
        if not isinstance(data, dict) or not data:
            return jsonify({"ok": False, "error": "empty_data", "details": "Поле data должно содержать непустой JSON-объект"}), 400

        prompt = build_prompt(data)

        # Безопасное выполнение запроса к ИИ с переходом на fallback в случае аварии
        try:
            response = generate_with_key_rotation(prompt, keys, retries_per_key=3, retry_delay=5)
            result_text = _extract_response_text(response)
            is_fallback = False
            token_count = None
            if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
                token_count = getattr(response.usage_metadata, "total_token_count", None)
        except Exception as error:
            logger.error("Все ключи API для отчета вышли из строя. Активирован fallback: %s", error)
            result_text = render_fallback_report(data)
            is_fallback = True
            token_count = 0

        return jsonify(
            {
                "ok": True,
                "model": "FallbackHTML" if is_fallback else MODEL_NAME,
                "result": result_text,
                "usage_tokens": token_count,
                "fallback_applied": is_fallback
            }
        )

    @app.post("/generate_pptx")
    def generate_pptx():
        try:
            payload = request.get_json(silent=False)
        except Exception:
            return jsonify({"ok": False, "error": "invalid_json"}), 400

        if payload is None:
            return jsonify({"ok": False, "error": "empty_json"}), 400

        if not isinstance(payload, dict):
            return jsonify({"ok": False, "error": "invalid_payload", "details": "Ожидается JSON-объект"}), 400

        data = payload.get("data", payload)
        if not isinstance(data, dict) or not data:
            return jsonify({"ok": False, "error": "empty_data", "details": "Поле data должно содержать непустой JSON-объект"}), 400

        prompt = build_promt_pptx(data)

        # Безопасное выполнение запроса к ИИ с переходом на fallback в случае аварии
        try:
            response = generate_with_key_rotation(prompt, keys_pptx, retries_per_key=3, retry_delay=5)
            result_text = _extract_response_text(response)

            # Очистка markdown-тегов, если модель проигнорировала системные указания
            if result_text.startswith("```html"):
                result_text = result_text.split("```html", 1)[1]
            if result_text.endswith("```"):
                result_text = result_text.rsplit("```", 1)[0]
            result_text = result_text.strip()

            is_fallback = False
            token_count = None
            if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
                token_count = getattr(response.usage_metadata, "total_token_count", None)
        except Exception as error:
            logger.error("Все API-ключи для генерации презентации упали! Активирован fallback: %s", error)
            result_text = render_fallback_pptx(data)
            is_fallback = True
            token_count = 0

        return jsonify(
            {
                "ok": True,
                "model": "FallbackPPTX" if is_fallback else MODEL_NAME,
                "result": result_text,
                "usage_tokens": token_count,
                "fallback_applied": is_fallback
            }
        )

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3003"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)