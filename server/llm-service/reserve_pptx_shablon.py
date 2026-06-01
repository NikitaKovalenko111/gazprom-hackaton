import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def _get_place_val(place, *keys, default=0):
    """Try multiple key paths for backward compatibility with different payload shapes."""
    for k in keys:
        # dotted path
        if isinstance(k, str) and "." in k:
            parts = k.split(".")
            cur = place
            ok = True
            for p in parts:
                if isinstance(cur, dict) and p in cur:
                    cur = cur[p]
                else:
                    ok = False
                    break
            if ok and cur is not None:
                return cur
        else:
            v = place.get(k) if isinstance(place, dict) else None
            if v is not None:
                return v
    return default


def _normalize_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize gateway payloads so fallback templates can read one common shape.

    Gateway sends a scored place with nested region_info, while some local tests
    use the raw region object. This helper makes both shapes look the same to
    the HTML renderers.
    """
    if not isinstance(data, dict):
        return {}

    region_info = data.get("region_info")
    if not isinstance(region_info, dict):
        return data

    normalized = dict(region_info)
    normalized.setdefault("region_name", data.get("region_name", "Не указан"))
    normalized.setdefault("places", region_info.get("places", []))
    normalized["scored_place"] = {
        "region_name": data.get("region_name"),
        "place_name": data.get("place_name"),
        "score": data.get("score"),
        "confidence": data.get("confidence"),
        "breakdown": data.get("breakdown"),
        "why": data.get("why"),
    }
    normalized["region_info"] = region_info
    return normalized


def _format_percent(value):
    if value in (None, "", "—"):
        return "—"
    try:
        return str(int(round(float(value))))
    except (TypeError, ValueError):
        return str(value)

def render_fallback_report(data: Dict[str, Any]) -> str:
    """Резервный генератор аналитической справки (HTML) в случае падения Gemini.
    Включает глубокий детальный анализ рисков согласно критериям ТЗ с современным дизайном.
    """
    logger.warning("Используется резервный генератор отчетов (Fallback HTML из модуля fallbacks)")

    data = _normalize_payload(data)

    # Извлекаем региональные цвета для брендирования отчета
    color_profile = data.get("cultural_code", {}).get("color_profile", {})
    primary_color = color_profile.get("primary", "#009B77")
    secondary_color = color_profile.get("secondary", "#FFFFFF")
    accent_color = color_profile.get("accent", "#F7D117")

    cultural_code = data.get("cultural_code", {})
    styles = ", ".join(cultural_code.get("dominant_architectural_styles", ["Современный стиль"]))
    materials = ", ".join(cultural_code.get("traditional_materials_ornaments", ["Стандартные материалы"]))

    social = data.get("social_infrastructure", {})
    kindergarten = _format_percent(social.get("kindergarten_availability_per_100_children", "—"))
    rent = social.get("average_1room_apartment_rent_rub", "—")
    colleges = social.get("profile_colleges_budget_places", "—")

    economy = data.get("economy", {})
    salary = economy.get("average_monthly_salary_rub", "—")
    iza = economy.get("ecological_class_iza", "Неизвестно")
    tariff = economy.get("industrial_electricity_tariff_rub_kwh", "—")

    places = data.get("places", [])

    # Use module-level _get_place_val for compatibility

    # Генерация детализированной таблицы рисков по площадкам
    table_rows = ""
    for idx, place in enumerate(places, 1):
        dist_steel = _get_place_val(place, "min_dist_km_to_metallurgical_factory", "min_dist_km_to_metallurgical_factory", "distance_to_the_supplier_of_rolled_steel_km", default=0)
        dist_insulation = _get_place_val(place, "min_dist_km_to_insulation_factory", "distance_to_the_insulation_supplier_km", default=0)
        # electric/gas distances may live under infrastructure
        dist_elec = _get_place_val(place, "infrastructure.distance_to_substation_km", "distance_to_the_nearest_electric_substation_km", default=0)
        dist_gas = _get_place_val(place, "infrastructure.distance_to_the_nearest_gas_substation_km", "infrastructure.distance_to_the_nearest_gas_substation_km", "infrastructure.gas_coordinates", default=0)
        # if gas distance missing but gas coord present, keep as 'nearby'
        if isinstance(dist_gas, dict):
            dist_gas = 0
        is_sez = place.get("special_economic_zone", place.get("is_sez", False))

        # Анализ транспортного плеча
        if dist_steel <= 30:
            steel_risk = f'<span style="color: #38a169; font-weight: 600;">Низкий ({dist_steel} км)</span><br><span style="font-size: 11pt; color: #718096;">Оптимально</span>'
        elif dist_steel <= 80:
            steel_risk = f'<span style="color: #dd6b20; font-weight: 600;">Средний ({dist_steel} км)</span><br><span style="font-size: 11pt; color: #718096;">Нужны авто</span>'
        else:
            steel_risk = f'<span style="color: #e53e3e; font-weight: 600;">Высокий ({dist_steel} км)</span><br><span style="font-size: 11pt; color: #718096;">Дорогое сырье!</span>'

        # Анализ утеплителя
        if dist_insulation <= 30:
            insulation_risk = f'<span style="color: #38a169; font-weight: 600;">Низкий ({dist_insulation} км)</span>'
        else:
            insulation_risk = f'<span style="color: #dd6b20; font-weight: 600;">Повышенный ({dist_insulation} км)</span>'

        # Анализ сетевых рисков
        infra_desc_list = []
        if dist_elec > 5:
            infra_desc_list.append(f"ЛЭП: {dist_elec} км")
        if dist_gas > 5:
            infra_desc_list.append(f"ГРС: {dist_gas} км")

        infra_risk = ", ".join(infra_desc_list) if infra_desc_list else '<span style="color: #38a169;">Минимальный (сети рядом)</span>'

        # Налоговые компенсаторы
        tax_status = "ОЭЗ/ТОСЭР" if is_sez else "Общий режим"

        table_rows += f"""
        <tr>
            <td>
                <strong>Площадка №{idx}</strong><br>
                <span style="font-size: 11pt; color: #718096;">{place.get("place_address", "")[:60]}...</span>
            </td>
            <td>{steel_risk}</td>
            <td>{insulation_risk}</td>
            <td>{infra_risk}</td>
            <td>
                <span style="background: {'rgba(0, 155, 119, 0.1)' if is_sez else '#edf2f7'}; 
                             color: {primary_color if is_sez else '#4a5568'}; 
                             padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11pt;">
                    {tax_status}
                </span>
            </td>
        </tr>
        """

    eco_analysis = ""
    if "повышен" in iza.lower() or "высокий" in iza.lower():
        eco_analysis = f"""
        <div class="alert-box" style="border-left-color: #e53e3e; background: #fff5f5;">
            <strong style="color: #e53e3e;">⚠️ ЭКОЛОГИЧЕСКИЙ ФАКТОР: Класс ИЗА региона — «{iza}»</strong>
            <p>Регион характеризуется повышенным уровнем загрязнения атмосферы. При проектировании линии производства сэндвич-панелей потребуются инвестиции в усиленные аспирационные системы и фильтры.</p>
        </div>
        """
    else:
        eco_analysis = f"""
        <div class="alert-box" style="border-left-color: {primary_color}; background: rgba(0, 155, 119, 0.04);">
            <strong style="color: {primary_color};">🍀 ЭКОЛОГИЧЕСКИЙ ФАКТОР: Класс ИЗА региона — «{iza}»</strong>
            <p>Благоприятная экологическая обстановка снижает риск наложения жестких лимитов на выбросы, но стандартные требования должны соблюдаться.</p>
        </div>
        """

    capacity = data.get("network_infrastructure", {}).get("available_electrical_capacity_kva", 0)
    if capacity < 800:
        power_risk_desc = f"Доступно всего <strong>{capacity} кВА</strong>. Мощности критически не хватает (норматив 300-800 кВА)."
    else:
        power_risk_desc = f"Доступно <strong>{capacity} кВА</strong>. Лимит электроснабжения достаточен для масштабирования производства."

    html = f"""
    <style>
        .report-fallback {{
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #2d3748;
            line-height: 1.6;
            background: #f8fafc;
            padding: 20px;
            border-radius: 16px;
        }}
        .report-fallback .section-card {{
            background: #ffffff;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.03);
            border: 1px solid #e2e8f0;
            border-top: 5px solid {primary_color};
        }}
        .report-fallback .section-card.accent {{
            border-top: 5px solid {accent_color};
        }}
        .report-fallback h2 {{
            color: {primary_color};
            margin-top: 0;
            font-size: 18pt;
            border-bottom: 2px solid #edf2f7;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }}
        .report-fallback ul {{
            padding-left: 20px;
            margin: 0;
        }}
        .report-fallback li {{
            margin-bottom: 10px;
            font-size: 14pt;
        }}
        .report-fallback .data-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 13pt;
        }}
        .report-fallback .data-table th {{
            background-color: {primary_color};
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }}
        .report-fallback .data-table th:first-child {{ border-top-left-radius: 8px; }}
        .report-fallback .data-table th:last-child {{ border-top-right-radius: 8px; }}
        .report-fallback .data-table td {{
            border-bottom: 2px solid #edf2f7;
            padding: 15px;
            color: #4a5568;
            vertical-align: top;
        }}
        .report-fallback .alert-box {{
            padding: 20px;
            border-radius: 8px;
            border-left: 6px solid;
            margin-top: 15px;
        }}
        .report-fallback .alert-box strong {{
            font-size: 14pt;
            display: block;
            margin-bottom: 8px;
        }}
        .report-fallback .alert-box p {{
            margin: 0;
            font-size: 13pt;
        }}
    </style>

    <div class="report-fallback">
        <div class="section-card">
            <h2>1. План благоустройства территории</h2>
            <p style="font-size: 14pt;">Адаптация промышленного объекта к локальному контексту:</p>
            <ul>
                <li><strong>Доминирующие архитектурные стили:</strong> {styles}</li>
                <li><strong>Материалы и орнаменты:</strong> {materials}</li>
            </ul>
        </div>
        
        <div class="section-card accent">
            <h2>2. Рекомендации по привлечению персонала</h2>
            <p style="font-size: 14pt; margin-bottom: 15px;">Для обеспечения завода кадрами (с учетом средних зарплат <strong>{salary} руб.</strong>) предлагается:</p>
            <ul>
                <li><strong>Жилье:</strong> Стоимость аренды ({rent} руб.) требует рассмотреть частичное субсидирование.</li>
                <li><strong>Детские сады:</strong> Обеспеченность {kindergarten}%. Рекомендуется корпоративная детская комната.</li>
                <li><strong>Образование:</strong> Использовать СПО ({colleges} бюджетных мест) для целевой подготовки операторов.</li>
            </ul>
        </div>
        
        <div class="section-card" style="border-top-color: #c53030;">
            <h2 style="color: #c53030;">3. Глубокий анализ рисков проекта</h2>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Локация</th>
                        <th>Сталь (60% с/с)</th>
                        <th>Утеплитель</th>
                        <th>Сети</th>
                        <th>Налоги/СЭЗ</th>
                    </tr>
                </thead>
                <tbody>{table_rows}</tbody>
            </table>
            
            {eco_analysis}
            
            <div class="alert-box" style="border-left-color: #3182ce; background: #ebf8ff;">
                <strong style="color: #2b6cb0;">🔌 ЭНЕРГЕТИЧЕСКИЙ БАЛАНС И СЕТИ</strong>
                <p style="color: #2c5282;">{power_risk_desc} Энерготариф установлен на уровне <strong>{tariff} руб./кВтч</strong>.</p>
            </div>
        </div>
    </div>
    """
    return html


def render_fallback_pptx(data: Dict[str, Any]) -> str:
    """Резервный генератор HTML-презентации.
    Объединяет строгую печатную верстку (A4) с красивым дизайном (градиенты, карточки).
    """
    logger.warning("Используется резервный генератор презентаций (Fallback PPTX)")

    data = _normalize_payload(data)

    color_profile = data.get("cultural_code", {}).get("color_profile", {})
    primary_color = color_profile.get("primary", "#009B77")
    secondary_color = color_profile.get("secondary", "#FFFFFF")
    accent_color = color_profile.get("accent", "#F7D117")

    region_name = data.get('region_name', 'Не указан')
    places = data.get('places', [])
    total_area = sum([p.get('square_m2', 0) for p in places])
    avg_salary = data.get('economy', {}).get('average_monthly_salary_rub', '—')
    colleges_budget = data.get('social_infrastructure', {}).get('profile_colleges_budget_places', '—')
    kindergarten = _format_percent(data.get('social_infrastructure', {}).get('kindergarten_availability_per_100_children', '—'))

    tax_desc = data.get('economy', {}).get('tax_incentives_description', 'Налоговые льготы согласно законодательству РФ')
    insurance = 'Да (сниженные тарифы)' if data.get('economy', {}).get('has_reduced_insurance_contributions') else 'Нет'
    tariff = data.get('economy', {}).get('industrial_electricity_tariff_rub_kwh', '—')
    urban_index = data.get('social_infrastructure', {}).get('urban_environment_index', '—')
    eco_class = data.get('economy', {}).get('ecological_class_iza', '—')

    capacity = data.get('network_infrastructure', {}).get('available_electrical_capacity_kva', '—')
    conn_fee = data.get('network_infrastructure', {}).get('technological_connection_fee_rub_kw', '—')

    place_analysis_html = ""
    for idx, p in enumerate(places[:3], 1):
        gas_dist = _get_place_val(p, "infrastructure.distance_to_substation_km", "distance_to_the_nearest_gas_substation_km", default='—')
        elec_dist = _get_place_val(p, "infrastructure.distance_to_substation_km", "distance_to_the_nearest_electric_substation_km", default='—')
        sez_flag = p.get('special_economic_zone', p.get('is_sez', False))
        place_analysis_html += f"""
        <div style="margin-bottom: 15px; padding: 15px; border-left: 5px solid {primary_color}; background: #f9f9f9; border-radius: 6px;">
            <strong style="font-size: 16pt; color: #333;">Площадка №{idx} ({p.get('square_m2', '—')} м²):</strong><br>
            <span style="font-size: 14pt; color: #555;">Газ: {gas_dist} км | Электричество: {elec_dist} км | ОЭЗ: {'Да' if sez_flag else 'Нет'}</span>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Инвестиционная презентация — {region_name}</title>
    <style>
        /* ЖЕСТКИЕ НАСТРОЙКИ ДЛЯ СТАБИЛЬНОСТИ PDF */
        @page {{ size: A4 landscape; margin: 0; }}
        * {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }}
        
        body {{ margin: 0; padding: 0; background: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; color: #2d3748; }}
        .presentation {{ display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px 0; }}
        
        @media print {{
            body {{ background: white; }}
            .presentation {{ padding: 0; gap: 0; display: block; }}
            .slide {{ box-shadow: none !important; margin: 0 !important; page-break-after: always; page-break-inside: avoid; }}
        }}
        
        /* КОНТЕЙНЕР СЛАЙДА A4 */
        .slide {{
            width: 297mm; height: 210mm;
            background: white;
            padding: 15mm 20mm;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
        }}
        
        /* КРАСИВЫЙ ДИЗАЙН И СЕТКА */
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid {primary_color}; padding-bottom: 12px; margin-bottom: 25px; }}
        .header h2 {{ margin: 0; color: {primary_color}; font-size: 26pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }}
        .header .region-badge {{ background: {primary_color}; color: #fff; padding: 8px 20px; border-radius: 25px; font-size: 14pt; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }}
        
        .content {{ flex-grow: 1; display: flex; flex-direction: column; font-size: 15pt; line-height: 1.6; }}
        
        /* ТИТУЛЬНЫЙ СЛАЙД (с градиентом) */
        .title-slide {{ padding: 0; background: linear-gradient(135deg, {primary_color} 0%, #1a202c 100%); color: white; justify-content: center; align-items: center; text-align: center; }}
        .title-slide h1 {{ font-size: 46pt; margin: 0 0 20px 0; font-weight: 900; line-height: 1.2; text-shadow: 0 4px 10px rgba(0,0,0,0.3); padding: 0 40px; }}
        .title-slide p {{ font-size: 22pt; margin: 0; opacity: 0.9; color: {secondary_color}; }}
        .title-slide .accent-bar {{ width: 150px; height: 8px; background-color: {accent_color}; margin: 40px auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }}
        
        /* ПЛИТКИ И КАРТОЧКИ СТАТИСТИКИ */
        .stats-container {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px; }}
        .stat-card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; border-top: 6px solid {accent_color}; box-shadow: 0 4px 10px rgba(0,0,0,0.04); text-align: center; }}
        .stat-card h3 {{ margin: 0 0 10px 0; font-size: 13pt; color: #718096; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }}
        .stat-card .value {{ font-size: 28pt; font-weight: 800; color: {primary_color}; line-height: 1; }}
        
        /* МАКЕТЫ */
        .cols-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: stretch; }}
        
        /* СЕТКА РЕНДЕРОВ */
        .grid-2x2 {{ display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px; flex-grow: 1; }}
        .render-box {{ border: 3px dashed {primary_color}; background: rgba(0, 155, 119, 0.04); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; text-align: center; position: relative; overflow: hidden; }}
        .render-box .r-title {{ font-size: 22pt; font-weight: 800; color: {primary_color}; margin-bottom: 12px; }}
        .render-box .r-desc {{ font-size: 14pt; font-weight: 500; color: #4a5568; line-height: 1.4; }}
        
        /* ИНФОБЛОКИ */
        .info-block {{ background: #f7fafc; padding: 20px; border-radius: 12px; border-left: 6px solid {primary_color}; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }}
        .info-block h4 {{ margin: 0 0 10px 0; font-size: 18pt; color: #2d3748; }}
        
        /* ТАБЛИЦЫ */
        .data-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 15pt; background: white; }}
        .data-table th {{ background-color: {primary_color}; color: white; padding: 15px; text-align: left; font-weight: 600; }}
        .data-table td {{ border-bottom: 2px solid #edf2f7; padding: 15px; color: #4a5568; }}
        .data-table tr:last-child td {{ border-bottom: none; }}
    </style>
</head>
<body>
    <div class="presentation">
    
        <!-- Слайд 1: Титул -->
        <div class="slide title-slide">
            <h1>Инвестиционный проект<br>развития площадок</h1>
            <p>Регион реализации: {region_name}</p>
            <div class="accent-bar"></div>
            <p style="font-size: 16pt; letter-spacing: 2px; text-transform: uppercase; color: {accent_color};">Презентация для администрации муниципалитета</p>
        </div>

        <!-- Слайд 2: Параметры проекта -->
        <div class="slide">
            <div class="header">
                <h2>Параметры проекта и кадровый потенциал</h2>
                <div class="region-badge">{region_name}</div>
            </div>
            <div class="content">
                <div class="stats-container">
                    <div class="stat-card">
                        <h3>Всего площадок</h3>
                        <div class="value">{len(places)} ед.</div>
                    </div>
                    <div class="stat-card">
                        <h3>Общая площадь</h3>
                        <div class="value">{total_area:,} м²</div>
                    </div>
                    <div class="stat-card">
                        <h3>Средняя зарплата</h3>
                        <div class="value">{avg_salary} ₽</div>
                    </div>
                </div>
                
                <div class="cols-2" style="grid-template-columns: 1.3fr 0.7fr; margin-top: 10px;">
                    <div>
                        <h3 style="color: {primary_color}; margin-top: 0; font-size: 20pt;">Кадровое обеспечение</h3>
                        <p>Проект ориентирован на использование местных квалифицированных кадров. Наличие в регионе <strong>{colleges_budget} бюджетных мест</strong> в профильных колледжах гарантирует регулярный приток специалистов.</p>
                        <p>Уровень оплаты труда планируется на уровне среднерыночных значений, что обеспечит высокую конкурентоспособность предприятия как работодателя.</p>
                    </div>
                    <div style="background: rgba(0, 155, 119, 0.06); padding: 25px; border-radius: 16px; border: 2px solid rgba(0, 155, 119, 0.2);">
                        <h4 style="margin: 0 0 15px 0; color: {primary_color}; font-size: 18pt;">Ключевой приоритет</h4>
                        <p style="margin: 0; font-size: 14pt; color: #4a5568;">Создание высокопроизводительных рабочих мест и партнерские программы стажировок с колледжами региона.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Слайд 3: 4 рендера -->
        <div class="slide">
            <div class="header">
                <h2>Архитектурный облик и визуализация</h2>
                <div class="region-badge">{region_name}</div>
            </div>
            <div class="content">
                <div class="grid-2x2">
                    <div class="render-box">
                        <div class="r-title">Рендер 1</div>
                        <div class="r-desc">Общий вид производственного комплекса и благоустроенной территории</div>
                    </div>
                    <div class="render-box">
                        <div class="r-title">Рендер 2</div>
                        <div class="r-desc">Главный фасад в эко-технологическом стиле с национальным орнаментом</div>
                    </div>
                    <div class="render-box">
                        <div class="r-title">Рендер 3</div>
                        <div class="r-desc">Внутреннее зонирование цеха и логистические проезды</div>
                    </div>
                    <div class="render-box">
                        <div class="r-title">Рендер 4</div>
                        <div class="r-desc">Административно-бытовой корпус и рекреационная зона сотрудников</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Слайд 4: План участка -->
        <div class="slide">
            <div class="header">
                <h2>План социальной инфраструктуры объекта</h2>
                <div class="region-badge">{region_name}</div>
            </div>
            <div class="content">
                <div class="cols-2">
                    <div>
                        <h3 style="color: {primary_color}; margin-top: 0; font-size: 20pt;">Интеграция с регионом</h3>
                        <p>Доступность дошкольных учреждений в регионе составляет <strong>{kindergarten}%</strong>. Для снижения нагрузки на муниципалитет проект предусматривает создание собственной экосистемы для сотрудников.</p>
                        <ul style="margin-top: 20px; padding-left: 20px;">
                            <li style="margin-bottom: 15px;"><strong>Корпоративный детский сад:</strong> временное пребывание детей с педагогами.</li>
                            <li><strong>Зона здорового питания:</strong> современная корпоративная столовая с дотационным меню.</li>
                        </ul>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <div class="info-block" style="border-left-color: {accent_color};">
                            <h4>Спортивный хаб</h4>
                            <p style="margin: 0;">Уличная воркаут-площадка для сотрудников и тренажерный зал внутри АБК для пропаганды активного образа жизни.</p>
                        </div>
                        <div class="info-block" style="border-left-color: {primary_color};">
                            <h4>Медицинский кабинет</h4>
                            <p style="margin: 0;">Пункт ежедневного контроля здоровья, оказания первой помощи и плановых осмотров.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Слайд 5: Сети -->
        <div class="slide">
            <div class="header">
                <h2>Доступность инженерных сетей и лимиты</h2>
                <div class="region-badge">{region_name}</div>
            </div>
            <div class="content">
                <div class="cols-2">
                    <div>
                        <h3 style="color: {primary_color}; margin-top:0; font-size: 20pt;">Сводные лимиты</h3>
                        <table class="data-table" style="margin-top: 20px;">
                            <tr>
                                <td>Доступная эл. мощность</td>
                                <td style="text-align: right;"><strong style="color: {primary_color}; font-size: 18pt;">{capacity} кВА</strong></td>
                            </tr>
                            <tr>
                                <td>Плата за тех. присоединение</td>
                                <td style="text-align: right;"><strong style="color: {primary_color}; font-size: 18pt;">{conn_fee} ₽/кВт</strong></td>
                            </tr>
                            <tr>
                                <td>Статус газоснабжения</td>
                                <td style="text-align: right;"><strong style="color: {primary_color}; font-size: 18pt;">Доступно</strong></td>
                            </tr>
                        </table>
                        <p style="font-size: 13pt; color: #718096; margin-top: 20px;">* Параметры соответствуют общим лимитам сетевых организаций региона для промышленных потребителей.</p>
                    </div>
                    <div>
                        <h3 style="color: {primary_color}; margin-top:0; font-size: 20pt;">Локальный анализ:</h3>
                        <div style="margin-top: 20px;">
                            {place_analysis_html}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Слайд 6: Экономика -->
        <div class="slide">
            <div class="header">
                <h2>Экономическая выгода и преференции</h2>
                <div class="region-badge">{region_name}</div>
            </div>
            <div class="content">
                <div class="stats-container">
                    <div class="stat-card" style="border-top-color: {primary_color};">
                        <h3>Индекс гор. среды</h3>
                        <div class="value" style="color: #2d3748;">{urban_index}</div>
                    </div>
                    <div class="stat-card" style="border-top-color: {primary_color};">
                        <h3>Тариф на эл/эн</h3>
                        <div class="value" style="color: #2d3748;">{tariff} ₽</div>
                    </div>
                    <div class="stat-card" style="border-top-color: {primary_color};">
                        <h3>Экология (ИЗА)</h3>
                        <div class="value" style="font-size: 20pt; color: #2d3748; padding-top: 10px;">{eco_class}</div>
                    </div>
                </div>
                
                <div class="cols-2" style="margin-top: 10px; grid-template-columns: 1fr 1fr;">
                    <div class="info-block" style="border-left-width: 0; border-top: 5px solid {primary_color}; background: white; border: 1px solid #e2e8f0; border-top: 5px solid {primary_color};">
                        <h4 style="color: {primary_color};">Налоговые льготы и ОЭЗ</h4>
                        <p style="margin: 0 0 10px 0;">{tax_desc}</p>
                        <p style="margin: 0;"><strong>Пониженные страховые взносы:</strong> {insurance}</p>
                    </div>
                    <div class="info-block" style="border-left-width: 0; background: white; border: 1px solid #e2e8f0; border-top: 5px solid {accent_color};">
                        <h4 style="color: #2d3748;">Социально-экономический эффект</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #4a5568;">
                            <li style="margin-bottom: 8px;">Стабильный источник налоговых поступлений.</li>
                            <li style="margin-bottom: 8px;">Устойчивая занятость населения.</li>
                            <li>Повышение инвестиционной привлекательности.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
    </div>
</body>
</html>
"""
    return html