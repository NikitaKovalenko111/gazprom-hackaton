import json
import logging
import os
import time
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from google import genai

from api_keys import keys

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
                return client.models.generate_content(model="models/gemini-3.5-flash", contents=prompt)
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
        print(result_text)
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
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
