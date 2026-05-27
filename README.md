# Gazprom Hackaton

Проект состоит из фронтенда и набора бэкенд-сервисов для подбора и анализа площадок под размещение завода. Все запросы от клиента идут в `gateway-service`, который связывает фронтенд с `data-service` и `llm-service`.

## Функциональные блоки

- Фронтенд: форма ввода параметров, список топ-регионов, страница региона с картой, площадками, 3D-визуализацией, рендерами, LLM-рекомендацией и HTML-презентацией.
- `gateway-service`: единая точка входа для клиента, проксирование запросов к сервисам данных и LLM.
- `data-service`: расчет скоринга, ранжирование регионов и площадок, формирование объяснений и рекомендаций.
- `llm-service`: генерация HTML-ответов для аналитики и презентации.

## Стек

- Frontend: React, TypeScript, Vite, Redux, Redux Saga, React Router, Leaflet, Three.js, Sass.
- Backend: Go, Fiber.
- Services: Python, FastAPI, Flask.
- Infrastructure: Docker, Docker Compose.

## Запуск

Фронтенд:

```bash
cd client
npm install
npm run dev
```

Бэкенд:

```bash
cd server
docker compose up --build
```
