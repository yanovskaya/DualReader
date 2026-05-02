# Глава 03. Maven и `pom.xml`

> **Зачем эта глава:** разобраться, откуда в Java-проекте берутся библиотеки и как описать свой проект.
> **Файл проекта:** `artifacts/api-server/pom.xml`

## Что такое Maven

**Maven** — инструмент для сборки Java-проектов. По сути выполняет три задачи:
1. **Скачивает библиотеки** из интернета (как `npm` в JavaScript или `pip` в Python).
2. **Компилирует** ваш код в `.class` файлы.
3. **Собирает** всё это в один запускаемый `.jar`-файл.

Конкурент Maven — **Gradle**. У нас Maven, потому что он стандарт для Spring Boot.

Все настройки Maven живут в одном файле — **`pom.xml`** (Project Object Model). Это XML, его не надо бояться: тегов мало, структура повторяется.

## Полный разбор нашего pom.xml

### 1. Шапка XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
    <modelVersion>4.0.0</modelVersion>
```
Просто формальности XML и Maven. Копируется во все pom.xml без изменений.

### 2. Родительский POM

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.5</version>
</parent>
```

Это магия. Мы говорим: «наш `pom.xml` наследуется от родительского `pom.xml` Spring Boot».

Что мы получаем бесплатно от родителя:
- **Согласованные версии библиотек.** Не нужно гадать, какая версия Hibernate работает с какой версией Jackson — родитель уже это сделал за нас.
- **Готовые настройки сборки** под Java + Spring Boot.
- Плагин для запуска приложения.

Без этого родителя нужно было бы вручную выписать версии 50+ библиотек.

### 3. Координаты НАШЕГО проекта

```xml
<groupId>com.lingua</groupId>
<artifactId>lingua-api-server</artifactId>
<version>0.0.1-SNAPSHOT</version>
<name>Lingua API Server</name>
```

В Maven любой проект (включая твой) однозначно описывается тройкой:
- **groupId** — группа/компания (обычно обратное доменное имя).
- **artifactId** — имя проекта.
- **version** — версия. `SNAPSHOT` означает «версия в разработке, может меняться».

Если ты опубликуешь свой проект в публичный репозиторий, другие смогут добавить его себе через эту тройку.

### 4. Properties — переменные

```xml
<properties>
    <java.version>17</java.version>
</properties>
```

Просто переменные. Эту используют родительский POM и плагин компиляции.

### 5. Зависимости

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    ...
</dependencies>
```

Каждая `<dependency>` — отдельная библиотека. Указываем `groupId` и `artifactId`, версия подтягивается из родительского POM.

Разберём каждую нашу зависимость:

#### `spring-boot-starter-web`
Это **starter** — пакет, который тянет за собой кучу связанных библиотек:
- встроенный веб-сервер **Tomcat**,
- **Spring MVC** (фреймворк HTTP-эндпоинтов),
- **Jackson** (превращение объектов в JSON и обратно),
- встроенная валидация.

Одна строка → веб-сервер с поддержкой JSON.

#### `spring-boot-starter-data-jpa`
Тянет:
- **JPA** (стандарт ORM),
- **Hibernate** (реализация JPA),
- **Spring Data JPA** (магические репозитории),
- **HikariCP** (пул соединений с БД).

#### `postgresql`
```xml
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```
JDBC-драйвер для PostgreSQL. `scope=runtime` означает: «не нужен при компиляции, нужен только при запуске». Smart: код напрямую не импортирует ничего из этой библиотеки — Spring сам её использует.

Если поменяем БД на MySQL — заменим эту строку на `mysql-connector-java`.

#### `spring-boot-starter-actuator`
Бесплатные эндпоинты для мониторинга: `/actuator/health`, `/actuator/metrics` и т.п.

#### `lombok`
```xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```
**Lombok** — генератор кода. С его аннотациями (`@Data`, `@RequiredArgsConstructor`) не нужно вручную писать геттеры, сеттеры, конструкторы. Lombok дописывает их во время компиляции.

`optional=true` означает: «если кто-то использует наш JAR как библиотеку — Lombok ему не нужен».

#### `jackson-databind`
Сама библиотека сериализации JSON. Уже идёт со starter-web, но мы выписали явно.

### 6. Build — как собирать

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <excludes>
                    <exclude>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
            </configuration>
        </plugin>
    </plugins>
</build>
```
Плагин Spring Boot, который умеет:
- запускать приложение командой `mvn spring-boot:run`,
- собирать **fat JAR** (один файл, в котором ваш код + ВСЕ зависимости + встроенный Tomcat) командой `mvn package`.

`excludes` говорит: «не клади Lombok внутрь готового JAR» (он не нужен в рантайме, нужен только при компиляции).

## Полезные команды Maven

Запускай из корня репозитория:

```bash
# Запустить приложение
mvn -f artifacts/api-server/pom.xml spring-boot:run

# Скомпилировать
mvn -f artifacts/api-server/pom.xml compile

# Собрать .jar (положит в target/)
mvn -f artifacts/api-server/pom.xml package

# Запустить тесты
mvn -f artifacts/api-server/pom.xml test

# Удалить target/ и пересобрать с нуля
mvn -f artifacts/api-server/pom.xml clean package
```

## Где Maven хранит скачанные библиотеки

В папке `~/.m2/repository/`. Скачиваются один раз — потом переиспользуются всеми Maven-проектами на компьютере.

## Контрольные вопросы

1. Что такое `groupId`, `artifactId`, `version`? Зачем эта тройка?
2. Что даёт «родительский POM» Spring Boot?
3. Что такое starter? Назови два примера.
4. Что значит `<scope>runtime</scope>`?
5. Какой командой запустить приложение?

## Мини-упражнение

Открой `pom.xml` нашего проекта и попробуй:
1. Найти зависимость `lombok` — какая у неё особенность по сравнению с другими?
2. Найти раздел `<build>` — что в нём?

Если хочешь поэкспериментировать (опционально) — добавь зависимость, например, `org.apache.commons:commons-lang3:3.14.0`, перезапусти проект, проверь, что всё ещё работает.

## Что дальше

Теперь — настройки самого приложения: **[Глава 04 — application.properties →](04-application-properties.md)**
