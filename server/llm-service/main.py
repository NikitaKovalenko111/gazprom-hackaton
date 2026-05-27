import json
import logging
import os
import time
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from google import genai

from api_keys import keys, keys_pptx

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
    return f"""
На основе предоставленных данных о регионе напиши аналитическую справку. При генерации аналитической справки делай упор на входные данные. Ответ должен быть с html тегами(так как это будет загружаться на сайт, завернутый в блок). 3 пункт нужно в виде таблицы 
Сгенерируй только следующие 3 раздела:
1. План благоустройства (учитывая культурный код, архитектурные стили, цвета и материалы из данных)
2. Рекомендации по удержанию персонала (обязательно учитывая социальную инфраструктуру: жильё, сады, колледжи, а также транспорт: если удаленность от важных узлов или жилья >15 км, упомянуть служебные автобусы)
3. Риски (проанализируй логистику сырья, экологию, инфраструктурные ограничения и другие возможные риски на основе данных)

Данные региона:
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
Презентация должна иметь фиксированную альбомную верстку для каждого слайда, чтобы её можно было легко и красиво конвертировать в PDF (через печать страницы). 

### ТРЕБОВАНИЯ К ОФОРМЛЕНИЮ (HTML/CSS):
1. Верни ПОЛНЫЙ валидный HTML-код (начиная с <!DOCTYPE html> и включая теги <html>, <head>, <body>).
2. НЕ используй блоки разметки markdown (```html ... ```). Выведи только чистый HTML-текст.
3. Вся презентация должна состоять из 6 блоков <div class="slide">...</div>.
4. В CSS добавь правило для разделения страниц при печати в PDF: `.slide {{ page-break-after: always; width: 297mm; height: 210mm; padding: 20mm; box-sizing: border-box; background: white; font-family: Arial, sans-serif; position: relative; overflow: hidden; }}`.
5. Используй цветовую палитру региона для элементов интерфейса (заголовки, плашки, границы, акценты):
   - Основной цвет (Primary): {primary_color}
   - Фоновый/Вторичный цвет (Secondary): {secondary_color}
   - Акцентный цвет (Accent): {accent_color}
6. Дизайн должен быть строгим, административным, с понятной инфографикой, таблицами и списками. Никаких интерактивных кнопок, скриптов или внешних тяжелых зависимостей.

### СТРУКТУРА ПРЕЗЕНТАЦИИ (Обязательно 6 слайдов):

Слайд 1: Титул
- Крупный заголовок: Инвестиционный проект развития площадок. Регион: {data.get('region_name', 'Не указан')}
- Подзаголовок: Презентация для администрации
- Визуальные элементы в цветах региона.

Слайд 2: Параметры проекта + рабочие места
- Сводные данные по доступным площадкам (общее количество площадок: {len(data.get('places', []))}, общая площадь кв.м).
- Информация о создании рабочих мест, среднем уровне заработной платы в регионе ({data.get('economy', {}).get('average_monthly_salary_rub', '—')} руб.) и кадровом потенциале (профильные колледжи: {data.get('social_infrastructure', {}).get('profile_colleges_budget_places', '—')} бюджетных мест).

Слайд 3: 4 рендера (2х2)
- Сделай красивую двухколоночную сетку (grid/flex 2x2).
- Вместо картинок создай 4 стилизованных блока (div с границами основного цвета и легким фоном), внутри которых крупно напиши названия рендеров:
  1. "Рендер 1: Общий вид производственного комплекса и благоустроенной территории"
  2. "Рендер 2: Главный фасад в эко-технологическом стиле с башкирским орнаментом"
  3. "Рендер 3: Внутреннее зонирование цеха и логистические проезды"
  4. "Рендер 4: Административно-бытовой корпус и рекреационная зона"

Слайд 4: План участка с соц. объектами (сад, спорт, столовая)
- План интеграции с социальной инфраструктурой региона.
- Отрази доступность детских садов ({data.get('social_infrastructure', {}).get('kindergarten_availability_per_100_children', '—')}%).
- Пропиши текстовые блоки для объектов на участке: корпоративный детский сад/комната, спортивная зона для сотрудников, столовая здорового питания.

Слайд 5: Соответствие нормативам + доступность сетей (газ, мощность)
- Технические параметры сетей из данных: Доступная эл. мощность: {data.get('network_infrastructure', {}).get('available_electrical_capacity_kva', '—')} кВА, плата за техприсоединение: {data.get('network_infrastructure', {}).get('technological_connection_fee_rub_kw', '—')} руб.
- Краткий анализ близости к сетям на основе списка мест (упомяни площадки с минимальным расстоянием до газовых и электрических подстанций в 1-2 км, и укажи ограничения для удаленных площадок).

Слайд 6: Экономика + льготы + социальные выгоды для региона
- Экономические преференции: {data.get('economy', {}).get('tax_incentives_description', 'Нет налоговых льгот')}.
- Снижение страховых взносов: {'Да' if data.get('economy', {}).get('has_reduced_insurance_contributions') else 'Нет'}.
- Тариф на электроэнергию: {data.get('economy', {}).get('industrial_electricity_tariff_rub_kwh', '—')} руб./кВтч.
- Социальный эффект для региона: налоги, индекс городской среды ({data.get('social_infrastructure', {}).get('urban_environment_index', '—')}), экологический класс региона ({data.get('economy', {}).get('ecological_class_iza', '—')}).

Данные региона для точной генерации:
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

        try:
            response = generate_with_key_rotation(prompt, keys, retries_per_key=3, retry_delay=5)
        except ValueError as error:
            return jsonify({"ok": False, "error": "no_api_keys", "details": str(error)}), 503
        except Exception as error:
            logger.exception("Не удалось получить ответ от модели: %s", error)
            return jsonify({"ok": False, "error": "generation_failed", "details": str(error)}), 502

        result_text = _extract_response_text(response)
        token_count = None
        if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
            token_count = getattr(response.usage_metadata, "total_token_count", None)
        return jsonify(
            {
                "ok": True,
                "model": MODEL_NAME,
                "result": result_text,
                "usage_tokens": token_count,
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

        try:
            response = generate_with_key_rotation(prompt, keys_pptx, retries_per_key=3, retry_delay=5)
        except ValueError as error:
            return jsonify({"ok": False, "error": "no_api_keys", "details": str(error)}), 503
        except Exception as error:
            logger.exception("Не удалось получить ответ от модели при генерации презентации: %s", error)
            return jsonify({"ok": False, "error": "generation_failed", "details": str(error)}), 502

        result_text = _extract_response_text(response)

        # Очистка markdown-тегов, если модель проигнорировала системные указания
        if result_text.startswith("```html"):
            result_text = result_text.split("```html", 1)[1]
        if result_text.endswith("```"):
            result_text = result_text.rsplit("```", 1)[0]
        result_text = result_text.strip()

        token_count = None
        if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
            token_count = getattr(response.usage_metadata, "total_token_count", None)

        return jsonify(
            {
                "ok": True,
                "model": MODEL_NAME,
                "result": result_text,
                "usage_tokens": token_count,
            }
        )

    return app



app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3003"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
