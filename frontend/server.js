const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const BASE_PORT = 3000;
const REJECTED_POST_TTL_MS = 24 * 60 * 60 * 1000;

/** Встроенный mock API (сессии, /api/login). Иначе /api проксируется на Python (FastAPI). */
const USE_MOCK_API = process.env.USE_MOCK_API === '1';
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ||
  process.env.BACKEND_URL ||
  'http://127.0.0.1:8001';

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(__dirname, 'uploads');

function staticGetOnly(mw) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    return mw(req, res, next);
  };
}

// Статика только для GET/HEAD — иначе POST /api/* может обрабатываться serve-static и не дойти до прокси.
// Прокси до body-parser: тело POST не должно читать express.json до пересылки на FastAPI.
app.use(staticGetOnly(express.static(publicDir)));
app.use('/uploads', staticGetOnly(express.static(uploadsDir)));

app.get('/profile', (req, res) => {
  res.sendFile(path.join(publicDir, 'profile.html'));
});

if (!USE_MOCK_API) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  // Express снимает префикс /api с req.url → на бэкенд уходило /auth/login вместо /api/auth/login (404).
  app.use(
    '/api',
    createProxyMiddleware({
      target: API_PROXY_TARGET,
      changeOrigin: true,
      timeout: 60_000,
      proxyTimeout: 60_000,
      pathRewrite: (path) => {
        if (path.startsWith('/api')) return path;
        return '/api' + (path.startsWith('/') ? path : `/${path}`);
      },
      on: {
        proxyReq: (proxyReq, req) => {
          const auth = req.headers.authorization;
          if (auth) {
            proxyReq.setHeader('Authorization', auth);
          }
        },
        error: (err, req, res) => {
          console.error('[api proxy]', API_PROXY_TARGET, err.message);
          if (!res.headersSent) {
            res.status(502).json({
              detail: `Прокси: бэкенд недоступен (${API_PROXY_TARGET}). Запустите API (Docker/Uvicorn).`,
            });
          }
        },
      },
    }),
  );
}

if (USE_MOCK_API) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}

// Сессии и mock-данные (только при USE_MOCK_API=1)
if (USE_MOCK_API) {
  app.use(
    session({
      secret: 'poteryashki_secret_key_2024',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    }),
  );

  // Настройка multer для загрузки картинок
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = './uploads';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() +
        '-' +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname);
      cb(null, uniqueName);
    },
  });

  const upload = multer({ storage: storage });

  // ---------- Имитация базы данных ----------
  let users = [
    {
      id: 1,
      nickname: 'admin',
      password: 'admin123',
      email: 'admin@example.com',
      region: 'Москва',
      city: 'Москва',
      street: 'Тверская улица',
      role: 'admin',
      avatar: null,
      banned: false,
    },
    {
      id: 2,
      nickname: 'Анна',
      password: 'anna123',
      email: 'anna@example.com',
      region: 'Санкт-Петербург',
      city: 'Санкт-Петербург',
      street: 'Невский проспект',
      role: 'user',
      avatar: null,
      banned: false,
    },
    {
      id: 3,
      nickname: 'Дмитрий',
      password: 'dima123',
      email: 'dima@example.com',
      region: 'Москва',
      city: 'Москва',
      street: 'Арбат',
      role: 'user',
      avatar: null,
      banned: false,
    },
  ];

  let posts = [
    {
      id: 1,
      userId: 2,
      title: 'Потерян рюкзак',
      image: 'uploads/7178454836.jpg',
      description: 'Черный рюкзак с ноутбуком внутри и важными документами',
      location: 'Метро Площадь Восстания',
      reward: 5000,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 2,
      userId: 3,
      title: 'Пропали ключи от квартиры',
      image: './uploads/keys.jpg',
      description: 'Связка из трех ключей с красным брелоком в виде сердца',
      location: 'Парк Горького',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 3,
      userId: 2,
      title: 'Найдена банковская карта',
      image: './uploads/kredit_card.webp',
      description: 'Карта на имя Ирина С., найдена рядом с кассой супермаркета',
      location: 'ТЦ Галерея',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 4,
      userId: 3,
      title: 'Потеряны очки в черной оправе',
      image: './uploads/glasses.webp',
      description: 'Диоптрии минус 2, лежали в мягком сером футляре',
      location: 'Автобус №24',
      reward: 1500,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 5,
      userId: 2,
      title: 'Утерян студенческий билет',
      image: './uploads/студак.webp',
      description:
        'Студенческий билет МГТУ, может быть в синей папке с документами',
      location: 'Станция Бауманская',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 6,
      userId: 3,
      title: 'Потерян серебряный браслет',
      image: './uploads/браслет.jpg',
      description: 'Тонкий серебряный браслет с маленькой подвеской-луной',
      location: 'Кофейня на Арбате',
      reward: 2500,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 7,
      userId: 2,
      title: 'Потеряна беспроводная наушник',
      image: './uploads/наушники.webp',
      description:
        'Белый правый наушник в силиконовом чехле, мог выпасть в транспорте',
      location: 'Трамвай №3',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 8,
      userId: 3,
      title: 'Найдены детские варежки',
      image: './uploads/варежки.webp',
      description: 'Красные варежки с узором снежинки, лежали на скамейке',
      location: 'Сквер у ДК',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 9,
      userId: 2,
      title: 'Потеряна флешка 64GB',
      image: './uploads/флешка.webp',
      description: 'Черная флешка с наклейкой "Курсовая", очень важные файлы',
      location: 'Библиотека МГТУ',
      reward: 2000,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 10,
      userId: 3,
      title: 'Утерян зонт-трость',
      image: './uploads/зонт.webp',
      description: 'Темно-синий зонт с деревянной ручкой, оставлен у входа',
      location: 'БЦ Сириус',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 11,
      userId: 2,
      title: 'Потерян фитнес-браслет',
      image: './uploads/фитнес_браслет.jpg',
      description: 'Черный браслет Xiaomi с потертым ремешком',
      location: 'Фитнес-клуб Энергия',
      reward: 1800,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 12,
      userId: 3,
      title: 'Найдена папка с документами',
      image: './uploads/папка с документами.avif',
      description: 'Синяя папка формата А4, внутри копии паспортных документов',
      location: 'Остановка Центральный рынок',
      reward: null,
      rewardType: 'voluntary',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 13,
      userId: 2,
      title: 'Пропала кошка в переноске',
      image: './uploads/кошка в переноске.jpg',
      description:
        'Серая переноска с рыжим котом, потеряна при пересадке между автобусами',
      location: 'Автовокзал Южный',
      reward: 7000,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
    {
      id: 14,
      userId: 3,
      title: 'Потеряна спортивная сумка',
      image: './uploads/спортивная сумка.webp',
      description: 'Черная сумка Adidas с формой и кроссовками 43 размера',
      location: 'Стадион Локомотив',
      reward: 3000,
      rewardType: 'money',
      status: 'searching',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    },
  ];

  let nextUserId = 4;
  let nextPostId = 15;

  function cleanupExpiredRejectedPosts() {
    const now = Date.now();
    posts = posts.filter((post) => {
      if (post.status !== 'rejected') return true;
      if (!post.expiresAt) return false;
      return new Date(post.expiresAt).getTime() > now;
    });
  }

  // Поддерживаем актуальное состояние отклоненных объявлений на всех API-запросах.
  if (USE_MOCK_API) {
    app.use('/api', (req, res, next) => {
      cleanupExpiredRejectedPosts();
      next();
    });

    // Фоновая очистка, чтобы посты удалялись даже без внешних запросов.
    setInterval(cleanupExpiredRejectedPosts, 60 * 1000);
  }

  // Middleware для проверки авторизации
  const isAuth = (req, res, next) => {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Необходима авторизация' });
  };

  const isAdmin = (req, res, next) => {
    const user = users.find((u) => u.id === req.session.userId);
    if (user && user.role === 'admin') return next();
    res.status(403).json({ error: 'Доступ запрещен' });
  };

  // ---------- API (mock, только при USE_MOCK_API=1) ----------

  // Получить текущего пользователя
  app.get('/api/me', (req, res) => {
    if (req.session.userId) {
      const user = users.find((u) => u.id === req.session.userId);
      if (user && !user.banned) {
        res.json({
          id: user.id,
          nickname: user.nickname,
          role: user.role,
          email: user.email,
          region: user.region,
          city: user.city || '',
          street: user.street || '',
          avatar: user.avatar || null,
        });
      } else {
        req.session.destroy();
        res.status(401).json({ error: 'Пользователь забанен' });
      }
    } else {
      res.status(401).json({ error: 'Не авторизован' });
    }
  });

  // Регистрация
  app.post('/api/register', (req, res) => {
    const { nickname, password, email, region } = req.body;
    if (users.find((u) => u.email === email)) {
      return res.status(400).json({ error: 'Email уже используется' });
    }
    const newUser = {
      id: nextUserId++,
      nickname,
      password,
      email,
      region,
      city: '',
      street: '',
      role: 'user',
      avatar: null,
      banned: false,
    };
    users.push(newUser);
    req.session.userId = newUser.id;
    res.json({
      id: newUser.id,
      nickname: newUser.nickname,
      role: newUser.role,
    });
  });

  // Вход
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(
      (u) => u.email === email && u.password === password,
    );
    if (user && !user.banned) {
      req.session.userId = user.id;
      res.json({ id: user.id, nickname: user.nickname, role: user.role });
    } else {
      res
        .status(401)
        .json({ error: 'Неверные данные или аккаунт заблокирован' });
    }
  });

  // Выход
  app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
  });

  // Обновить профиль
  app.patch('/api/profile', isAuth, upload.single('avatar'), (req, res) => {
    const user = users.find((u) => u.id === req.session.userId);
    if (!user || user.banned) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const nickname =
      typeof req.body.nickname === 'string' ? req.body.nickname.trim() : '';
    if (nickname) {
      const duplicateNickname = users.find(
        (u) =>
          u.nickname.toLowerCase() === nickname.toLowerCase() &&
          u.id !== user.id,
      );
      if (duplicateNickname) {
        return res.status(400).json({ error: 'Никнейм уже используется' });
      }
      user.nickname = nickname;
    }

    if (typeof req.body.region === 'string') {
      user.region = req.body.region.trim();
    }
    if (typeof req.body.city === 'string') {
      user.city = req.body.city.trim();
    }
    if (typeof req.body.street === 'string') {
      user.street = req.body.street.trim();
    }

    if (req.file) {
      user.avatar = `/uploads/${req.file.filename}`;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        region: user.region,
        city: user.city || '',
        street: user.street || '',
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  });

  // Получить объявления в поиске
  app.get('/api/posts/searching', (req, res) => {
    let filtered = posts.filter((p) => !p.banned && p.status === 'searching');
    if (req.session.userId) {
      filtered = filtered.filter(
        (post) =>
          !post.responses.some(
            (response) => response.userId === req.session.userId,
          ),
      );
    }
    const postsWithAuthor = filtered.map((post) => {
      const author = users.find((u) => u.id === post.userId);
      return { ...post, authorNickname: author ? author.nickname : 'Unknown' };
    });
    res.json(postsWithAuthor);
  });

  // Получить найденные объявления
  app.get('/api/posts/found', (req, res) => {
    let filtered = posts.filter((p) => !p.banned && p.status === 'found');
    if (req.session.userId) {
      filtered = filtered.filter(
        (post) =>
          !post.responses.some(
            (response) => response.userId === req.session.userId,
          ),
      );
    }
    const postsWithAuthor = filtered.map((post) => {
      const author = users.find((u) => u.id === post.userId);
      return { ...post, authorNickname: author ? author.nickname : 'Unknown' };
    });
    res.json(postsWithAuthor);
  });

  // Получить объявления на модерации
  app.get('/api/posts/pending', isAuth, (req, res) => {
    const currentUser = users.find((u) => u.id === req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const filtered = posts.filter((post) => {
      if (post.banned) return false;

      if (currentUser.role === 'admin') {
        return post.status === 'pending';
      }

      return (
        post.userId === req.session.userId &&
        (post.status === 'pending' || post.status === 'rejected')
      );
    });

    const postsWithAuthor = filtered.map((post) => {
      const author = users.find((u) => u.id === post.userId);
      return { ...post, authorNickname: author ? author.nickname : 'Unknown' };
    });

    res.json(postsWithAuthor);
  });

  // Создать объявление
  app.post('/api/posts', isAuth, upload.single('image'), (req, res) => {
    const { title, description, location, reward, rewardType } = req.body;
    const publishInFound =
      req.body.keepInFound === 'on' ||
      req.body.keepInFound === 'true' ||
      req.body.keepInFound === true;
    let imageUrl = 'https://placehold.co/300x200/f8f9fa/6c757d/png';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    const newPost = {
      id: nextPostId++,
      userId: req.session.userId,
      title,
      image: imageUrl,
      description,
      location,
      reward: rewardType === 'money' ? parseFloat(reward) : null,
      rewardType: rewardType || 'voluntary',
      publishInFound,
      status: 'pending',
      rejectedAt: null,
      expiresAt: null,
      banned: false,
      responses: [],
    };
    posts.push(newPost);
    res.json(newPost);
  });

  // Обновить статус объявления
  app.patch('/api/posts/:id/status', isAuth, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: 'Объявление не найдено' });
    if (post.userId !== req.session.userId)
      return res.status(403).json({ error: 'Не ваше объявление' });

    const allowedStatuses = ['searching', 'found'];
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }
    if (post.status === 'pending') {
      return res.status(400).json({ error: 'Объявление еще на модерации' });
    }
    if (post.status === 'rejected') {
      return res.status(400).json({
        error: 'Отклоненное объявление нельзя изменить через эту операцию',
      });
    }

    post.status = req.body.status;
    res.json(post);
  });

  // Удалить объявление
  app.delete('/api/posts/:id', isAuth, (req, res) => {
    const postIndex = posts.findIndex((p) => p.id === parseInt(req.params.id));
    if (postIndex === -1)
      return res.status(404).json({ error: 'Объявление не найдено' });
    if (posts[postIndex].userId !== req.session.userId)
      return res.status(403).json({ error: 'Не ваше объявление' });
    posts.splice(postIndex, 1);
    res.json({ success: true });
  });

  // Добавить отклик
  app.post('/api/posts/:id/respond', isAuth, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: 'Объявление не найдено' });
    if (post.userId === req.session.userId)
      return res
        .status(403)
        .json({ error: 'Нельзя откликнуться на своё объявление' });

    const { message, foundLocation, contact } = req.body;
    const user = users.find((u) => u.id === req.session.userId);
    const response = {
      id: Date.now(),
      userId: req.session.userId,
      userNickname: user.nickname,
      message,
      foundLocation,
      contact,
      createdAt: new Date().toISOString(),
    };
    post.responses.push(response);
    res.json(response);
  });

  // Получить отклики к объявлению (только автор объявления)
  app.get('/api/posts/:id/responses', isAuth, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: 'Объявление не найдено' });
    if (post.userId !== req.session.userId) {
      return res
        .status(403)
        .json({ error: 'Доступ к откликам есть только у автора объявления' });
    }
    res.json(post.responses);
  });

  // Объявления, на которые пользователь откликнулся
  app.get('/api/profile/found-by-me', isAuth, (req, res) => {
    const respondedPosts = posts
      .filter(
        (post) =>
          !post.banned &&
          post.responses.some(
            (response) => response.userId === req.session.userId,
          ),
      )
      .map((post) => {
        const author = users.find((u) => u.id === post.userId);
        const myResponse =
          post.responses
            .filter((response) => response.userId === req.session.userId)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0] || null;

        return {
          id: post.id,
          title: post.title,
          location: post.location,
          status: post.status,
          authorNickname: author ? author.nickname : 'Unknown',
          myResponse,
        };
      });

    res.json(respondedPosts);
  });

  // ---------- Админские методы ----------

  // Получить активных пользователей
  app.get('/api/admin/active-users', isAuth, isAdmin, (req, res) => {
    const activeUsers = users
      .filter((u) => !u.banned)
      .map((u) => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        region: u.region,
        role: u.role,
        banned: u.banned,
      }));
    res.json(activeUsers);
  });

  // Получить забаненных пользователей
  app.get('/api/admin/banned-users', isAuth, isAdmin, (req, res) => {
    const bannedUsers = users
      .filter((u) => u.banned)
      .map((u) => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        region: u.region,
        role: u.role,
        banned: u.banned,
      }));
    res.json(bannedUsers);
  });

  // Забанить пользователя
  app.post('/api/admin/users/:id/ban', isAuth, isAdmin, (req, res) => {
    const user = users.find((u) => u.id === parseInt(req.params.id));
    if (user && user.role !== 'admin') {
      user.banned = true;
      if (req.session.userId === user.id) {
        req.session.destroy();
      }
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Нельзя забанить администратора' });
    }
  });

  // Разбанить пользователя
  app.post('/api/admin/users/:id/unban', isAuth, isAdmin, (req, res) => {
    const user = users.find((u) => u.id === parseInt(req.params.id));
    if (user) {
      user.banned = false;
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  });

  // Получить забаненные объявления
  app.get('/api/admin/banned-posts', isAuth, isAdmin, (req, res) => {
    const banned = posts.filter((p) => p.banned);
    res.json(banned);
  });

  // Получить объявления на модерации (для админа)
  app.get('/api/admin/moderation-posts', isAuth, isAdmin, (req, res) => {
    const pendingPosts = posts
      .filter((p) => !p.banned && p.status === 'pending')
      .map((post) => {
        const author = users.find((u) => u.id === post.userId);
        return {
          ...post,
          authorNickname: author ? author.nickname : 'Unknown',
        };
      });

    res.json(pendingPosts);
  });

  // Принять объявление после модерации
  app.post('/api/admin/posts/:id/approve', isAuth, isAdmin, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) {
      return res.status(404).json({ error: 'Объявление не найдено' });
    }
    if (post.banned) {
      return res
        .status(400)
        .json({ error: 'Заблокированное объявление нельзя опубликовать' });
    }
    if (post.status !== 'pending') {
      return res
        .status(400)
        .json({ error: 'Можно принять только объявление на модерации' });
    }

    post.status = post.publishInFound ? 'found' : 'searching';
    post.rejectedAt = null;
    post.expiresAt = null;
    res.json({ success: true, post });
  });

  // Отклонить объявление после модерации
  app.post('/api/admin/posts/:id/reject', isAuth, isAdmin, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) {
      return res.status(404).json({ error: 'Объявление не найдено' });
    }
    if (post.status !== 'pending') {
      return res
        .status(400)
        .json({ error: 'Можно отклонить только объявление на модерации' });
    }

    const rejectedAt = new Date();
    post.status = 'rejected';
    post.rejectedAt = rejectedAt.toISOString();
    post.expiresAt = new Date(
      rejectedAt.getTime() + REJECTED_POST_TTL_MS,
    ).toISOString();
    res.json({ success: true, post });
  });

  // Забанить объявление
  app.post('/api/admin/posts/:id/ban', isAuth, isAdmin, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (post) {
      post.banned = true;
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Объявление не найдено' });
    }
  });

  // Разбанить объявление
  app.post('/api/admin/posts/:id/unban', isAuth, isAdmin, (req, res) => {
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (post) {
      post.banned = false;
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Объявление не найдено' });
    }
  });
} // USE_MOCK_API (сессии, in-memory API)

// Функция для поиска свободного порта
function findAvailablePort(startPort, callback) {
  const testApp = express();
  const server = testApp.listen(startPort, () => {
    server.close();
    callback(startPort);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Порт ${startPort} занят, пробую ${startPort + 1}...`);
      findAvailablePort(startPort + 1, callback);
    } else {
      console.error('Ошибка:', err);
    }
  });
}

// Запуск сервера на свободном порту
findAvailablePort(BASE_PORT, (port) => {
  app.listen(port, () => {
    console.log(
      '\n╔══════════════════════════════════════════════════════════╗',
    );
    console.log('║     🐾 ПОТЕРЯШКИ - Сервис поиска потерянных вещей 🐾     ║');
    console.log(
      '╚══════════════════════════════════════════════════════════╝\n',
    );
    console.log(`✅ Сервер успешно запущен!`);
    console.log(`📍 Локальный доступ: http://localhost:${port}`);
    if (!USE_MOCK_API) {
      console.log(`\n🔌 API /api → прокси на ${API_PROXY_TARGET}`);
      console.log(
        '   (запустите бэкенд FastAPI; иначе запросы к /api дадут 502)',
      );
    } else {
      console.log(`\n📝 Тестовые аккаунты (mock API):`);
      console.log(`   👑 Админ: admin@example.com / admin123`);
      console.log(`   👤 Пользователь: anna@example.com / anna123`);
      console.log(`   👤 Пользователь: dima@example.com / dima123`);
    }
    console.log(`\n✨ Потеряшки готовы к работе! ✨\n`);
  });
});
