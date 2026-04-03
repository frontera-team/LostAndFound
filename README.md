# LostAndFound

Сайт бюро находок.

## Backend (Docker + PostgreSQL)

Запуск API и БД:

```bash
docker compose up --build
```

API снаружи: **http://localhost:8001** (в контейнере порт 8000). Проверка: `GET http://localhost:8001/api/health`.

Чтобы **с того же порта 8001** открывалась главная из макета (папка `poteryashki_maket` рядом с этим репозиторием):

```bash
docker compose -f docker-compose.yml -f docker-compose.frontend.yml up --build
```

### Фронт через Node (порт 3000)

Из каталога `poteryashki_maket`:

```bash
npm start
```

Прокси по умолчанию: **http://127.0.0.1:8001** (как у `docker compose`). Иначе: `API_PROXY_TARGET=http://127.0.0.1:9000 npm start`.

### Демо-данные

При **пустой** таблице объявлений сид создаёт 14 объявлений из макета `poteryashki_maket/server.js` и пользователей **anna@example.com** / `anna123`, **dima@example.com** / `dima123` (как в mock-сервере). Фото подставляются из `poteryashki_maket/uploads` (переменная `SEED_UPLOADS_DIR`, в Docker — том в `docker-compose.yml`). Если объявления уже есть **без** картинок, при следующем старте API выполняется **дозаполнение** `ann_pic` по совпадению заголовка.

Если репозиторий макета не рядом с `LostAndFound`, закомментируйте у сервиса `api` блок `volumes` и строку `SEED_UPLOADS_DIR` в `docker-compose.yml`.

### Фронт на Node и логин

Запросы `POST /api/auth/login` и регистрация должны идти **на тот же хост**, что и страница (прокси на 3000 или напрямую API на 8001). Если Node запущен **внутри Docker**, а API на хосте, задайте `API_PROXY_TARGET=http://host.docker.internal:8001` (Windows/macOS Docker Desktop).
