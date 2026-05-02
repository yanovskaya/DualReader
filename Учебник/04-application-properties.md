# Глава 04. `application.properties`

> **Зачем эта глава:** разобраться, как настроить порт, БД, лимиты и логи без изменения кода.
> **Файл проекта:** `artifacts/api-server/src/main/resources/application.properties`

## Что это такое

`application.properties` — текстовый файл с настройками приложения в формате `ключ=значение`. Spring Boot **автоматически** загружает его при старте, если он лежит в `src/main/resources/`.

Альтернативно можно использовать `application.yml` (тот же смысл, но в формате YAML). Оба варианта работают одинаково.

## Полный разбор нашего файла

```properties
server.port=${PORT:8080}
server.servlet.context-path=/api

spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.open-in-view=false

spring.servlet.multipart.enabled=true
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB

management.endpoints.web.base-path=/actuator
management.endpoint.health.enabled=true

logging.level.com.lingua=INFO
logging.level.org.hibernate.SQL=WARN
```

Разберём блоки.

### Блок 1: HTTP-сервер

```properties
server.port=${PORT:8080}
```
На каком порту слушать. Конструкция `${PORT:8080}` — мощная: «возьми переменную окружения `PORT`; если её нет — используй `8080`». Это удобно для деплоя в облако: облако передаёт `PORT` через окружение, локально работает порт по умолчанию.

```properties
server.servlet.context-path=/api
```
Префикс ко **всем** URL. Если контроллер пишет `@GetMapping("/books")`, реальный путь будет `/api/books`. Это позволяет монтировать API под общий префикс одной строкой.

### Блок 2: JPA / Hibernate

```properties
spring.jpa.hibernate.ddl-auto=none
```
Самая важная настройка. Hibernate умеет автоматически создавать/изменять таблицы в БД. Возможные значения:
- `none` — ничего не делать (наш выбор).
- `validate` — проверить, что таблицы соответствуют моделям.
- `update` — добавить недостающие колонки (опасно).
- `create` — пересоздать таблицы при каждом старте (УНИЧТОЖИТ ДАННЫЕ).
- `create-drop` — то же, плюс удалить при остановке.

В продакшене **всегда** ставь `none` или `validate`. Схему меняем через миграции (у нас — Drizzle).

```properties
spring.jpa.show-sql=false
```
Не печатать каждый SQL-запрос в консоль. Включи для отладки, но в обычной жизни оставь `false`.

```properties
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```
Говорим Hibernate: «работаем с PostgreSQL» — он будет использовать PG-специфичный синтаксис.

```properties
spring.jpa.open-in-view=false
```
Это важно. По умолчанию Hibernate держит соединение с БД открытым на всё время рендеринга ответа. Звучит удобно, но на практике это **источник медленных запросов и багов** (т.н. N+1 проблема). Всегда выключай.

### Блок 3: Загрузка файлов

```properties
spring.servlet.multipart.enabled=true
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```
- Включаем поддержку multipart-запросов (загрузка файлов).
- Максимум 50 МБ на один файл.
- Максимум 50 МБ на весь запрос (если несколько файлов разом).

Если пользователь попробует загрузить файл больше — Spring сам вернёт 413 Payload Too Large.

### Блок 4: Actuator (мониторинг)

```properties
management.endpoints.web.base-path=/actuator
management.endpoint.health.enabled=true
```
Включаем эндпоинт `/actuator/health` для проверки «жив ли сервис». Удобно для платформ типа Kubernetes — они дёргают этот URL, чтобы понять, не пора ли перезапустить контейнер.

### Блок 5: Логи

```properties
logging.level.com.lingua=INFO
logging.level.org.hibernate.SQL=WARN
```

Уровни логов от подробного к скудному:
1. `TRACE` — мельчайшие детали.
2. `DEBUG` — отладочные сообщения.
3. `INFO` — нормальные события («сервер стартовал», «запрос обработан»).
4. `WARN` — предупреждения.
5. `ERROR` — ошибки.

`logging.level.<пакет>=<уровень>` означает: «для классов из этого пакета показывай ЭТОТ уровень и выше».
- Для нашего кода (`com.lingua`) показываем `INFO`+.
- Для Hibernate — только `WARN`+ (иначе он завалит логи запросами).

Когда отлаживаешь — поставь `logging.level.com.lingua=DEBUG`.

## Где взять список всех возможных настроек

Огромная таблица — в официальной документации:
https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html

Самые часто используемые:
- `server.port`
- `server.servlet.context-path`
- `spring.datasource.url`, `spring.datasource.username`, `spring.datasource.password` (если не делать DataSource вручную)
- `spring.jpa.hibernate.ddl-auto`
- `spring.servlet.multipart.max-file-size`
- `logging.level.<package>`

## Контрольные вопросы

1. Что значит `${PORT:8080}`?
2. Что делает `server.servlet.context-path=/api`?
3. Почему `ddl-auto=none` в продакшене лучше, чем `update`?
4. Какой уровень логов установить, чтобы видеть отладочные сообщения?
5. Что произойдёт, если пользователь загрузит файл 100 МБ?

## Мини-упражнение

1. Поменяй временно `logging.level.com.lingua` на `DEBUG`, перезапусти сервер (через workflow), сделай несколько запросов и посмотри, как изменились логи.
2. Верни обратно `INFO`.
3. Попробуй понять: что произойдёт, если изменить `server.servlet.context-path` на `/v1` и перезапустить? Какие URL будут работать?

## Что дальше

Готовы — открываем самый главный файл, который запускает всё приложение: **[Глава 05 — Точка входа →](05-точка-входа.md)**
