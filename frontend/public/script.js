let currentUser = null;
let allPosts = [];
let currentTab = 'searching';
let searchQuery = '';
let categoriesCache = [];
/** Сбрасывает устаревшие ответы при быстром переключении вкладок */
let announcementsFetchGeneration = 0;

function sameUserCreator(ann, user) {
  if (!user || ann.user_creator_id == null) return false;
  return Number(ann.user_creator_id) === Number(user.id);
}

const api = window.LF_API;

function profileHref() {
  return window.location.protocol === 'file:' ? 'profile.html' : '/profile';
}

let adminRoleIdCache = null;
async function getAdminRoleId() {
  if (adminRoleIdCache != null) return adminRoleIdCache;
  const res = await api.request('/api/roles', { skipAuth: true });
  if (!res.ok) return null;
  const roles = await res.json();
  const a = roles.find((r) => r.role_name === 'admin');
  adminRoleIdCache = a ? a.id : null;
  return adminRoleIdCache;
}

const authButtonsDiv = document.querySelector('.auth-buttons');
const postsContainer = document.getElementById('postsContainer');
const createPostBtn = document.getElementById('createPostBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const postsSearchInput = document.getElementById('postsSearchInput');
const searchingTabBtn = document.getElementById('searchingTabBtn');
const mineTabBtn = document.getElementById('mineTabBtn');
const foundTabBtn = document.getElementById('foundTabBtn');
const createPostModal = document.getElementById('createPostModal');
const authModal = document.getElementById('authModal');
const adminModal = document.getElementById('adminModal');
const respondModal = document.getElementById('respondModal');
const repliesModal = document.getElementById('repliesModal');
const reportModal = document.getElementById('reportModal');
const respondForm = document.getElementById('respondForm');
const respondAnnouncementId = document.getElementById('respondAnnouncementId');
const respondMessage = document.getElementById('respondMessage');
const repliesListContainer = document.getElementById('repliesListContainer');
const reportForm = document.getElementById('reportForm');
const reportAnnouncementId = document.getElementById('reportAnnouncementId');
const reportMessage = document.getElementById('reportMessage');

const lightThemeOption = document.getElementById('lightThemeOption');
const darkThemeOption = document.getElementById('darkThemeOption');
const themeSlider = document.getElementById('themeSlider');

function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
    lightThemeOption.classList.remove('active');
    darkThemeOption.classList.add('active');
    themeSlider.classList.remove('light');
    themeSlider.classList.add('dark');
  } else {
    document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
    darkThemeOption.classList.remove('active');
    lightThemeOption.classList.add('active');
    themeSlider.classList.remove('dark');
    themeSlider.classList.add('light');
  }
}

lightThemeOption.addEventListener('click', () => setTheme('light'));
darkThemeOption.addEventListener('click', () => setTheme('dark'));
setTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

const rewardRadios = document.querySelectorAll('input[name="rewardType"]');
const rewardInputContainer = document.getElementById('rewardInputContainer');
rewardRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    rewardInputContainer.style.display =
      e.target.value === 'money' ? 'block' : 'none';
  });
});

function annImageUrl(a) {
  if (a.ann_pic && a.ann_pic_mime) {
    const raw = a.ann_pic.startsWith('data:')
      ? a.ann_pic.split(',')[1]
      : a.ann_pic;
    return `data:${a.ann_pic_mime};base64,${raw}`;
  }
  return 'https://via.placeholder.com/400x280/f8f9fa/6c757d?text=NO+PHOTO';
}

function annToPost(a) {
  const loc = [a.district_name, a.city_name, a.region_name]
    .filter(Boolean)
    .join(', ');
  return {
    id: a.id,
    title: a.ann_name,
    description: a.ann_description,
    image: annImageUrl(a),
    location: loc || '—',
    userId: a.user_creator_id,
    authorNickname: a.author_nickname || '—',
    rewardType:
      a.ann_reward != null && a.ann_reward > 0 ? 'money' : 'voluntary',
    reward: a.ann_reward,
    status: a.status != null && a.status !== '' ? String(a.status) : '',
    publishInFound: !!a.publish_in_found,
    responseCount: a.response_count != null ? Number(a.response_count) : null,
  };
}

function formatErrorDetail(detail) {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join('; ');
  if (typeof detail === 'object' && detail.message != null)
    return String(detail.message);
  return typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
}

async function parseError(res) {
  try {
    const j = await res.json();
    if (j.detail) {
      const formatted = formatErrorDetail(j.detail);
      if (formatted) return formatted;
    }
    return j.error || j.message || `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

async function loadUser() {
  try {
    const res = await api.request('/api/auth/me');
    if (res.ok) {
      const u = await res.json();
      if (!u) {
        currentUser = null;
      } else {
        currentUser = {
          id: u.id,
          nickname: u.nickname,
          email: u.email,
          role: u.role_name,
          region_id: u.region_id,
          city_id: u.city_id,
        };
      }
      updateAuthUI();
    } else {
      currentUser = null;
      updateAuthUI();
    }
  } catch {
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  if (currentUser) {
    authButtonsDiv.innerHTML = `
            <span class="auth-btn" style="background: linear-gradient(135deg, #6c757d, #5a6268);">${escapeHtml(currentUser.nickname)}</span>
            <button id="profileBtn" class="auth-btn">ПРОФИЛЬ</button>
            <button id="logoutBtn" class="auth-btn">ВЫЙТИ</button>
        `;
    document.getElementById('profileBtn').addEventListener('click', () => {
      window.location.href = profileHref();
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    createPostBtn.style.display = 'inline-block';
    adminPanelBtn.style.display =
      currentUser.role === 'admin' ? 'inline-block' : 'none';
  } else {
    authButtonsDiv.innerHTML = `<button id="loginShowBtn" class="auth-btn">ВХОД / РЕГИСТРАЦИЯ</button>`;
    document.getElementById('loginShowBtn').addEventListener('click', () => {
      openAuthModal();
    });
    createPostBtn.style.display = 'none';
    adminPanelBtn.style.display = 'none';
  }
}

async function logout() {
  const rt = api.getRefresh();
  if (rt) {
    await api.request('/api/auth/logout', {
      method: 'POST',
      json: { refresh_token: rt },
    });
  }
  api.clearTokens();
  currentUser = null;
  updateAuthUI();
  loadPosts();
}

/**
 * Вкладки:
 * — «В поиске»: searching; чужие — «Откликнуться»; свои — «Отклики».
 * — «Мои объявления»: все ваши записи; у опубликованных — «Найдено» (в раздел «Найдено»).
 * — «Найдено»: found.
 */
function announcementsFetchOptions() {
  if (currentTab === 'mine') return {};
  if (api.getAccess()) return {};
  return { skipAuth: true };
}

async function loadAnnouncements() {
  const gen = ++announcementsFetchGeneration;
  const opts = announcementsFetchOptions();
  let res;
  if (currentTab === 'mine') {
    const params = new URLSearchParams({
      limit: '100',
      page: '1',
      mine: 'true',
    });
    res = await api.request(`/api/announcements?${params}`, {});
  } else {
    const stateByTab = {
      searching: 'searching',
      found: 'found',
    };
    const state = stateByTab[currentTab] || 'searching';
    const params = new URLSearchParams({ limit: '100', page: '1', state });
    res = await api.request(`/api/announcements?${params}`, opts);
  }
  if (gen !== announcementsFetchGeneration) return;
  if (!res.ok) {
    allPosts = [];
    const needAuth = res.status === 401 && currentTab === 'mine';
    renderPosts(
      needAuth
        ? 'ВОЙДИТЕ, ЧТОБЫ ВИДЕТЬ СВОИ ОБЪЯВЛЕНИЯ'
        : 'НЕ УДАЛОСЬ ЗАГРУЗИТЬ ОБЪЯВЛЕНИЯ',
    );
    return;
  }
  const data = await res.json();
  if (gen !== announcementsFetchGeneration) return;
  let items = data.items || [];
  const normStatus = (a) => String(a.status || '').toLowerCase();
  if (currentTab === 'mine') {
    /* сервер уже отфильтровал по mine */
  } else if (currentTab === 'searching') {
    items = items.filter((a) => normStatus(a) === 'searching');
  } else if (currentTab === 'found') {
    items = items.filter((a) => normStatus(a) === 'found');
  }
  allPosts = items.map(annToPost);
  renderPosts(getTabEmptyMessage());
}

async function loadPosts() {
  if (currentTab === 'mine' && !currentUser) {
    allPosts = [];
    renderPosts(getTabEmptyMessage());
    return;
  }
  await loadAnnouncements();
}

function statusBadgeHtml(post) {
  const s = String(post.status || '').toLowerCase();
  if (s === 'pending') {
    return '<div class="post-moderation-status">НА МОДЕРАЦИИ</div>';
  }
  if (s === 'rejected') {
    return '<div class="post-moderation-status rejected">ОТКЛОНЕНО</div>';
  }
  if (s === 'searching') {
    return '<div class="post-status-pill searching">В ПОИСКЕ</div>';
  }
  if (s === 'found') {
    return '<div class="post-status-pill found">НАЙДЕНО</div>';
  }
  return '';
}

function renderPosts(emptyMessage) {
  const filteredPosts = filterPostsBySearch(allPosts, searchQuery);

  if (filteredPosts.length === 0) {
    const hasQuery = searchQuery.trim().length > 0;
    const message = hasQuery
      ? 'ПО ВАШЕМУ ЗАПРОСУ НИЧЕГО НЕ НАЙДЕНО'
      : emptyMessage || 'НЕТ ОБЪЯВЛЕНИЙ';
    postsContainer.innerHTML = `<div style="position: fixed; top: 50%; left: 50%; translate: -50% -50%; text-align: center; padding: 60px; color: #6c757d;">${escapeHtml(message)}</div>`;
    return;
  }

  postsContainer.innerHTML = '';
  filteredPosts.forEach((post) => {
    const card = document.createElement('div');
    card.className = 'post-card';

    const rewardHtml =
      post.rewardType === 'money'
        ? `<div class="post-reward money">ВОЗНАГРАЖДЕНИЕ: ${post.reward} ₽</div>`
        : `<div class="post-reward voluntary">ДОБРОВОЛЬНАЯ ПОМОЩЬ</div>`;

    const showStatusBadge = currentTab === 'mine';
    const modBadge = showStatusBadge ? statusBadgeHtml(post) : '';

    const isOwner =
      currentUser &&
      post.userId != null &&
      Number(post.userId) === Number(currentUser.id);
    const ns = String(post.status || '').toLowerCase();

    let buttonsHtml = '<div class="card-buttons">';
    if (isOwner) {
      buttonsHtml += `<button type="button" class="delete-btn" data-id="${post.id}">УДАЛИТЬ</button>`;
    }
    if (currentTab === 'mine' && isOwner && ns === 'searching') {
      buttonsHtml += `<button type="button" class="mark-found-btn" data-id="${post.id}">НАЙДЕНО</button>`;
    }
    if (
      currentTab === 'searching' &&
      currentUser &&
      !isOwner &&
      ns === 'searching'
    ) {
      buttonsHtml += `<button type="button" class="respond-btn" data-id="${post.id}">ОТКЛИКНУТЬСЯ</button>`;
    }
    if (
      (currentTab === 'searching' || currentTab === 'found') &&
      currentUser &&
      !isOwner &&
      (ns === 'searching' || ns === 'found')
    ) {
      buttonsHtml += `<button type="button" class="report-btn" data-id="${post.id}">ПОЖАЛОВАТЬСЯ</button>`;
    }
    if (
      currentUser &&
      isOwner &&
      (ns === 'searching' || ns === 'found') &&
      (currentTab === 'searching' ||
        currentTab === 'found' ||
        currentTab === 'mine')
    ) {
      const n = post.responseCount != null ? post.responseCount : 0;
      buttonsHtml += `<button type="button" class="view-responses-btn" data-id="${post.id}">ОТКЛИКИ (${n})</button>`;
    }
    buttonsHtml += '</div>';

    card.innerHTML = `
            <img src="${post.image}" class="post-image" alt="Фото ${escapeHtml(post.title)}">
            <div class="post-title">${escapeHtml(post.title)}</div>
            <div class="post-description">${escapeHtml(post.description)}</div>
            <div class="post-meta">${escapeHtml(post.location)} | ${escapeHtml(post.authorNickname)}</div>
            ${modBadge}
            ${rewardHtml}
            ${buttonsHtml}
        `;
    postsContainer.appendChild(card);
  });
}

function getTabEmptyMessage() {
  if (currentTab === 'mine' && !currentUser)
    return 'ВОЙДИТЕ, ЧТОБЫ ВИДЕТЬ СВОИ ОБЪЯВЛЕНИЯ';
  if (currentTab === 'mine') return 'У ВАС ПОКА НЕТ ОБЪЯВЛЕНИЙ';
  if (currentTab === 'found') return 'НЕТ ОБЪЯВЛЕНИЙ В РАЗДЕЛЕ «НАЙДЕНО»';
  return 'НЕТ ОБЪЯВЛЕНИЙ В РАЗДЕЛЕ «В ПОИСКЕ»';
}

function filterPostsBySearch(posts, query) {
  const tokens = (query || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return posts;
  return posts.filter((post) => {
    const title = (post.title || '').toLowerCase();
    const description = (post.description || '').toLowerCase();
    const searchable = `${title} ${description}`;
    return tokens.every((token) => searchable.includes(token));
  });
}

async function markFoundByAuthor(postId) {
  if (
    !confirm(
      'Отметить как найденное? Объявление уйдёт из «В поиске» в раздел «Найдено».',
    )
  ) {
    return;
  }
  const id = Number(postId);
  if (!Number.isFinite(id)) return;
  const res = await api.request(`/api/announcements/${id}/mark-found`, {
    method: 'POST',
  });
  if (res.ok) await loadPosts();
  else alert(await parseError(res));
}

async function deletePost(postId) {
  if (!confirm('Удалить объявление?')) return;
  const id = Number(postId);
  if (!Number.isFinite(id)) return;
  const btn = postsContainer.querySelector(`.delete-btn[data-id="${id}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '…';
  }
  try {
    const res = await api.request(`/api/announcements/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await loadPosts();
    else {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'УДАЛИТЬ';
      }
      alert(await parseError(res));
    }
  } catch {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'УДАЛИТЬ';
    }
    alert('Не удалось удалить объявление');
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s !== 'string') {
        reject(new Error('read'));
        return;
      }
      const i = s.indexOf(',');
      resolve({
        base64: i >= 0 ? s.slice(i + 1) : s,
        mime: file.type || 'application/octet-stream',
      });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function fillGeoSelects() {
  const regSel = document.getElementById('createRegionSelect');
  const citySel = document.getElementById('createCitySelect');
  const distSel = document.getElementById('createDistrictSelect');
  const catSel = document.getElementById('createCategorySelect');
  if (!regSel) return;

  const [regionsRes, catRes] = await Promise.all([
    api.request('/api/regions', { skipAuth: true }),
    api.request('/api/categories', { skipAuth: true }),
  ]);
  const regions = regionsRes.ok ? await regionsRes.json() : [];
  categoriesCache = catRes.ok ? await catRes.json() : [];

  regSel.innerHTML = regions
    .map((r) => `<option value="${r.id}">${escapeHtml(r.region_name)}</option>`)
    .join('');
  catSel.innerHTML = categoriesCache
    .map(
      (c) => `<option value="${c.id}">${escapeHtml(c.category_name)}</option>`,
    )
    .join('');

  async function loadCities(regionId) {
    if (!regionId) {
      citySel.innerHTML = '';
      distSel.innerHTML = '';
      return;
    }
    const res = await api.request(`/api/cities?region_id=${regionId}`, {
      skipAuth: true,
    });
    const cities = res.ok ? await res.json() : [];
    citySel.innerHTML = cities
      .map((c) => `<option value="${c.id}">${escapeHtml(c.city_name)}</option>`)
      .join('');
    await loadDistricts(citySel.value);
  }

  async function loadDistricts(cityId) {
    if (!cityId) {
      distSel.innerHTML = '';
      return;
    }
    const res = await api.request(`/api/districts?city_id=${cityId}`, {
      skipAuth: true,
    });
    const ds = res.ok ? await res.json() : [];
    distSel.innerHTML = ds
      .map((d) => `<option value="${d.id}">${escapeHtml(d.district)}</option>`)
      .join('');
  }

  regSel.onchange = () => loadCities(regSel.value);
  citySel.onchange = () => loadDistricts(citySel.value);

  if (regions.length) {
    regSel.value = String(regions[0].id);
    await loadCities(regSel.value);
  }
}

document
  .getElementById('createPostForm')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const rewardType = form.rewardType.value;
    const rewardRaw = form.reward?.value;
    const ann_reward =
      rewardType === 'money' && rewardRaw ? parseInt(rewardRaw, 10) : null;
    const regionId = parseInt(
      document.getElementById('createRegionSelect').value,
      10,
    );
    const cityId = parseInt(
      document.getElementById('createCitySelect').value,
      10,
    );
    const districtId = parseInt(
      document.getElementById('createDistrictSelect').value,
      10,
    );
    const categoryId = parseInt(
      document.getElementById('createCategorySelect').value,
      10,
    );
    const fileInput = form.image;
    const file = fileInput.files && fileInput.files[0];

    let ann_pic = null;
    let ann_pic_mime = null;
    if (file) {
      try {
        const { base64, mime } = await readFileAsBase64(file);
        ann_pic = base64;
        ann_pic_mime = mime;
      } catch {
        alert('Не удалось прочитать файл изображения');
        return;
      }
    }

    const publishInFoundEl = document.getElementById('publishInFoundCheckbox');
    const publish_in_found = !!(publishInFoundEl && publishInFoundEl.checked);

    const body = {
      ann_name: title,
      ann_description: description,
      ann_reward: Number.isFinite(ann_reward) ? ann_reward : null,
      ann_region_id: regionId,
      ann_city_id: cityId,
      ann_district_id: districtId,
      category_ids: [categoryId],
      ann_pic,
      ann_pic_mime,
      publish_in_found,
    };

    const res = await api.request('/api/announcements', {
      method: 'POST',
      json: body,
    });
    if (res.ok) {
      createPostModal.style.display = 'none';
      form.reset();
      rewardInputContainer.style.display = 'none';
      if (publishInFoundEl) publishInFoundEl.checked = false;
      await fillGeoSelects();
      setActiveTab('mine');
      loadPosts();
    } else {
      alert(await parseError(res));
    }
  });

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const res = await api.request('/api/auth/login', {
    method: 'POST',
    json: { email, password },
    skipAuth: true,
  });
  if (res.ok) {
    const data = await res.json();
    api.setTokens(data.access_token, data.refresh_token);
    authModal.style.display = 'none';
    document.getElementById('loginForm').reset();
    await loadUser();
    loadPosts();
  } else {
    alert(await parseError(res));
  }
});

async function fillRegisterGeo() {
  const regSel = document.getElementById('regRegionSelect');
  const citySel = document.getElementById('regCitySelect');
  if (!regSel || !citySel) return;

  regSel.disabled = true;
  citySel.disabled = true;
  regSel.innerHTML = '<option value="">Загрузка регионов…</option>';
  citySel.innerHTML = '<option value="">—</option>';

  const res = await api.request('/api/regions', { skipAuth: true });
  const regions = res.ok ? await res.json() : [];

  if (!regions.length) {
    regSel.innerHTML =
      '<option value="">Нет данных (проверьте API /api/regions)</option>';
    citySel.innerHTML = '<option value="">—</option>';
    regSel.disabled = false;
    citySel.disabled = true;
    return;
  }

  regSel.innerHTML = regions
    .map((r) => `<option value="${r.id}">${escapeHtml(r.region_name)}</option>`)
    .join('');

  async function citiesFor(rid) {
    if (!rid) return;
    citySel.disabled = true;
    citySel.innerHTML = '<option value="">Загрузка городов…</option>';
    const r2 = await api.request(
      `/api/cities?region_id=${encodeURIComponent(rid)}`,
      {
        skipAuth: true,
      },
    );
    const cities = r2.ok ? await r2.json() : [];
    if (!cities.length) {
      citySel.innerHTML = '<option value="">Нет городов для региона</option>';
    } else {
      citySel.innerHTML = cities
        .map(
          (c) => `<option value="${c.id}">${escapeHtml(c.city_name)}</option>`,
        )
        .join('');
    }
    citySel.disabled = false;
  }

  regSel.onchange = () => citiesFor(regSel.value);
  regSel.disabled = false;
  regSel.value = String(regions[0].id);
  await citiesFor(regSel.value);
}

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-lf-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Не удалось загрузить Google Sign-In')),
      );
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.lfGoogleGsi = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Не удалось загрузить Google Sign-In'));
    document.head.appendChild(s);
  });
}

let googleSignInPrepared = false;
let googleGsiInitialized = false;

async function prepareGoogleSignIn() {
  const wrapL = document.getElementById('googleSignInWrapLogin');
  const wrapR = document.getElementById('googleSignInWrapRegister');
  const hostL = document.getElementById('googleBtnLogin');
  const hostR = document.getElementById('googleBtnRegister');
  if (!wrapL || !wrapR || !hostL || !hostR) return;

  const res = await api.request('/api/auth/google-client-id', {
    skipAuth: true,
  });
  if (!res.ok) return;
  const { client_id: clientId } = await res.json();
  if (!clientId) return;

  try {
    await loadGoogleIdentityScript();
  } catch (e) {
    console.warn(e);
    return;
  }

  if (!googleGsiInitialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleGsiInitialized = true;
  }

  const btnOpts = {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'ru',
    logo_alignment: 'left',
    width: 300,
  };

  if (!googleSignInPrepared) {
    hostL.replaceChildren();
    hostR.replaceChildren();
    window.google.accounts.id.renderButton(hostL, btnOpts);
    window.google.accounts.id.renderButton(hostR, btnOpts);
    googleSignInPrepared = true;
  }

  wrapL.style.display = 'block';
  wrapR.style.display = 'block';
}

async function onGoogleCredential(response) {
  if (!response?.credential) return;

  const registerTab = document.getElementById('registerTab');
  const isRegister = registerTab?.classList.contains('active') ?? false;
  const payload = { id_token: response.credential };

  if (isRegister) {
    const nickname = document.getElementById('regNickname').value.trim();
    const region_id = parseInt(
      document.getElementById('regRegionSelect').value,
      10,
    );
    const city_id = parseInt(
      document.getElementById('regCitySelect').value,
      10,
    );
    if (!Number.isFinite(region_id) || !Number.isFinite(city_id)) {
      alert(
        'Выберите регион и город, затем снова нажмите «Войти через Google».',
      );
      return;
    }
    Object.assign(payload, { region_id, city_id });
    if (nickname) payload.nickname = nickname;
  }

  const res = await api.request('/api/auth/google', {
    method: 'POST',
    json: payload,
    skipAuth: true,
  });

  if (res.ok) {
    const data = await res.json();
    api.setTokens(data.access_token, data.refresh_token);
    authModal.style.display = 'none';
    document.getElementById('loginForm')?.reset();
    document.getElementById('registerForm')?.reset();
    await fillRegisterGeo();
    await loadUser();
    loadPosts();
    return;
  }

  let body;
  try {
    body = await res.json();
  } catch {
    alert(`Ошибка ${res.status}`);
    return;
  }

  if (res.status === 400 && body.detail?.code === 'google_profile_required') {
    alert(
      `${body.detail.message || 'Заполните профиль'}\n\nОткройте вкладку «Регистрация», выберите регион и город, при необходимости укажите никнейм, затем снова нажмите кнопку Google.`,
    );
    return;
  }

  alert(
    formatErrorDetail(body.detail) || body.message || `Ошибка ${res.status}`,
  );
}

async function openAuthModal() {
  authModal.style.display = 'block';
  await fillRegisterGeo();
  prepareGoogleSignIn();
}

document
  .getElementById('registerForm')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('regNickname').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const region_id = parseInt(
      document.getElementById('regRegionSelect').value,
      10,
    );
    const city_id = parseInt(
      document.getElementById('regCitySelect').value,
      10,
    );

    const res = await api.request('/api/auth/register', {
      method: 'POST',
      json: { nickname, email, password, region_id, city_id },
      skipAuth: true,
    });

    if (res.ok) {
      const loginRes = await api.request('/api/auth/login', {
        method: 'POST',
        json: { email, password },
        skipAuth: true,
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        api.setTokens(data.access_token, data.refresh_token);
      }
      authModal.style.display = 'none';
      document.getElementById('registerForm').reset();
      await fillRegisterGeo();
      await loadUser();
      loadPosts();
    } else {
      alert(await parseError(res));
    }
  });

let currentAdminType = 'users';
let currentAdminStatus = 'active';

async function loadActiveUsers() {
  const res = await api.request('/api/users?limit=200&page=1');
  if (!res.ok) return;
  const data = await res.json();
  const users = (data.items || []).filter((u) => !u.is_blocked);
  const adminRid = await getAdminRoleId();
  const container = document.getElementById('activeUsersList');
  document.getElementById('activeUsersCount').textContent = users.length;

  container.innerHTML = users
    .map((user) => {
      const isAdmin = adminRid != null && user.role_id === adminRid;
      const actions = isAdmin
        ? '<span style="color: #6c757d; font-weight: 700;">АДМИН</span>'
        : `<button class="admin-ban-btn" data-id="${user.id}" data-name="${escapeHtml(user.nickname)}">ЗАБЛОКИРОВАТЬ</button>`;
      return `
        <div class="admin-card">
            <div class="admin-card-info">
                <div class="admin-card-name">
                    ${escapeHtml(user.nickname)}
                </div>
                <div class="admin-card-email">${escapeHtml(user.email)}</div>
            </div>
            <div class="admin-card-actions">${actions}</div>
        </div>
    `;
    })
    .join('');

  document.querySelectorAll('.admin-ban-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      const userName = btn.dataset.name;
      if (!confirm(`Заблокировать пользователя «${userName}»?`)) return;
      const r = await api.request(`/api/users/${userId}/block`, {
        method: 'PATCH',
        json: { is_blocked: true },
      });
      if (r.ok) {
        await loadActiveUsers();
        await loadBannedUsers();
        await loadUser();
        loadPosts();
      } else alert(await parseError(r));
    });
  });
}

async function loadBannedUsers() {
  const res = await api.request('/api/users?limit=200&page=1');
  if (!res.ok) return;
  const data = await res.json();
  const users = (data.items || []).filter((u) => u.is_blocked);
  const container = document.getElementById('bannedUsersList');
  document.getElementById('bannedUsersCount').textContent = users.length;

  container.innerHTML = users
    .map(
      (user) => `
        <div class="admin-card">
            <div class="admin-card-info">
                <div class="admin-card-name">${escapeHtml(user.nickname)}</div>
                <div class="admin-card-email">${escapeHtml(user.email)}</div>
            </div>
            <div class="admin-card-actions">
                <button class="admin-unban-btn-card" data-id="${user.id}" data-name="${escapeHtml(user.nickname)}">РАЗБЛОКИРОВАТЬ</button>
            </div>
        </div>
    `,
    )
    .join('');

  document.querySelectorAll('.admin-unban-btn-card').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      const userName = btn.dataset.name;
      if (!confirm(`Разблокировать «${userName}»?`)) return;
      const r = await api.request(`/api/users/${userId}/block`, {
        method: 'PATCH',
        json: { is_blocked: false },
      });
      if (r.ok) {
        await loadActiveUsers();
        await loadBannedUsers();
        loadPosts();
      } else alert(await parseError(r));
    });
  });
}

function updateAdminContent() {
  document
    .querySelectorAll('.admin-content')
    .forEach((content) => content.classList.remove('active'));
  const statusSection = document.getElementById('adminStatusSection');
  if (statusSection) {
    statusSection.style.display = currentAdminType === 'reports' ? 'none' : '';
  }
  if (currentAdminType === 'reports') {
    const el = document.getElementById('reportsContent');
    if (el) el.classList.add('active');
    return;
  }
  const contentId = `${currentAdminType}${currentAdminStatus === 'active' ? 'Active' : 'Banned'}Content`;
  const activeContent = document.getElementById(contentId);
  if (activeContent) activeContent.classList.add('active');
}

document.querySelectorAll('.admin-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.admin-toggle-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentAdminType = btn.dataset.toggleType;
    updateAdminContent();
  });
});

document.querySelectorAll('.admin-status-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.admin-status-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentAdminStatus = btn.dataset.statusType;
    updateAdminContent();
  });
});

async function loadReportsList() {
  const list = document.getElementById('reportsList');
  const cnt = document.getElementById('reportsCount');
  const openOnlyEl = document.getElementById('reportsOpenOnly');
  if (!list || !cnt) return;
  const openOnly = openOnlyEl ? openOnlyEl.checked : false;
  const params = new URLSearchParams({
    limit: '50',
    page: '1',
    open_groups_only: openOnly ? 'true' : 'false',
  });
  const r = await api.request(`/api/announcements/reports?${params}`);
  if (!r.ok) {
    list.innerHTML = `<div class="info-message">${escapeHtml(await parseError(r))}</div>`;
    cnt.textContent = '0';
    return;
  }
  const data = await r.json();
  const groups = data.items || [];
  cnt.textContent = String(data.total != null ? data.total : groups.length);
  if (groups.length === 0) {
    list.innerHTML = '<div class="info-message">ЖАЛОБ ПОКА НЕТ</div>';
    return;
  }
  list.innerHTML = groups
    .map((g) => {
      const annSt = escapeHtml(g.announcement_status || '—');
      const ns = String(g.announcement_status || '').toLowerCase();
      const canReject = ['pending', 'searching', 'found'].includes(ns);
      const rejectBtn = canReject
        ? `<button type="button" class="admin-reject-from-reports-btn" data-aid="${g.announcement_id}">ОТКЛОНИТЬ ОБЪЯВЛЕНИЕ</button>`
        : '';
      const rows = (g.reports || [])
        .map((it) => {
          const resolved = String(it.status || '').toLowerCase() === 'resolved';
          const badge = resolved
            ? '<span class="report-status-badge resolved">обработана</span>'
            : '<span class="report-status-badge open">открыта</span>';
          const dt = escapeHtml(formatReplyDate(it.created_at));
          const resolveBtn = resolved
            ? ''
            : `<button type="button" class="admin-report-resolve-btn" data-rid="${it.id}">ОБРАБОТАНО</button>`;
          return `
            <div class="admin-report-row">
              <div class="admin-report-row-main">
                <div class="admin-report-row-top">
                  ${badge}
                </div>
                <span class="admin-report-meta">${escapeHtml(it.reporter_nickname)} (${escapeHtml(it.reporter_email)}) · ${dt}</span>
                <div class="admin-report-text">${escapeHtml(it.message)}</div>
              </div>
              <div class="admin-report-row-actions">${resolveBtn}</div>
            </div>`;
        })
        .join('');
      return `
        <div class="admin-card admin-card--report-group">
            <div class="admin-report-group-head">
                <div class="admin-card-info">
                    <div class="admin-card-name">${escapeHtml(g.ann_name)}</div>
                    <div class="admin-card-email">Объявление #${g.announcement_id} · ${annSt}</div>
                </div>
                <div class="admin-report-group-actions">${rejectBtn}</div>
            </div>
            <div class="admin-report-rows">${rows}</div>
        </div>`;
    })
    .join('');

  list.querySelectorAll('.admin-report-resolve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const rid = btn.getAttribute('data-rid');
      if (!rid) return;
      const res = await api.request(`/api/announcements/reports/${rid}`, {
        method: 'PATCH',
        json: { status: 'resolved' },
      });
      if (res.ok) await loadReportsList();
      else alert(await parseError(res));
    });
  });
  list.querySelectorAll('.admin-reject-from-reports-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const aid = btn.getAttribute('data-aid');
      if (!aid) return;
      if (
        !confirm(
          'Отклонить объявление? Оно пропадёт из ленты, все открытые жалобы будут помечены обработанными.',
        )
      )
        return;
      const res = await api.request(`/api/announcements/${aid}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadReportsList();
        loadPosts();
      } else alert(await parseError(res));
    });
  });
}

document.getElementById('reportsOpenOnly')?.addEventListener('change', () => {
  loadReportsList();
});

async function loadAdminData() {
  await loadActiveUsers();
  await loadBannedUsers();
  await loadReportsList();
  const modList = document.getElementById('moderationPostsList');
  const banList = document.getElementById('bannedPostsList');
  if (modList) {
    const r = await api.request(
      '/api/announcements?state=moderation&moderation_scope=all&limit=100&page=1',
    );
    if (!r.ok) {
      modList.innerHTML = `<div class="info-message">${escapeHtml(await parseError(r))}</div>`;
      document.getElementById('moderationPostsCount').textContent = '0';
    } else {
      const data = await r.json();
      const items = data.items || [];
      document.getElementById('moderationPostsCount').textContent = String(
        items.length,
      );
      if (items.length === 0) {
        modList.innerHTML =
          '<div class="info-message">НЕТ ОБЪЯВЛЕНИЙ НА МОДЕРАЦИИ</div>';
      } else {
        modList.innerHTML = items
          .map((a) => {
            const hint = a.publish_in_found
              ? ' → после одобрения: «Найдено»'
              : ' → после одобрения: «В поиске»';
            return `
        <div class="admin-card">
            <div class="admin-card-info">
                <div class="admin-card-name">${escapeHtml(a.ann_name)}</div>
                <div class="admin-card-email">${escapeHtml((a.author_nickname || '—') + hint)}</div>
            </div>
            <div class="admin-card-actions">
                <button type="button" class="admin-approve-post-btn" data-id="${a.id}">ОДОБРИТЬ</button>
                <button type="button" class="admin-reject-post-btn" data-id="${a.id}">ОТКЛОНИТЬ</button>
                <button type="button" class="admin-delete-post-btn" data-id="${a.id}">УДАЛИТЬ</button>
            </div>
        </div>`;
          })
          .join('');
        modList.querySelectorAll('.admin-approve-post-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const resAp = await api.request(
              `/api/announcements/${id}/approve`,
              { method: 'POST' },
            );
            if (resAp.ok) {
              await loadAdminData();
              loadPosts();
            } else alert(await parseError(resAp));
          });
        });
        modList.querySelectorAll('.admin-reject-post-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!confirm('Отклонить объявление?')) return;
            const resRj = await api.request(`/api/announcements/${id}/reject`, {
              method: 'POST',
            });
            if (resRj.ok) {
              await loadAdminData();
              loadPosts();
            } else alert(await parseError(resRj));
          });
        });
        modList.querySelectorAll('.admin-delete-post-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!confirm('Удалить объявление безвозвратно?')) return;
            const resDel = await api.request(`/api/announcements/${id}`, {
              method: 'DELETE',
            });
            if (resDel.ok) {
              await loadAdminData();
              loadPosts();
            } else alert(await parseError(resDel));
          });
        });
      }
    }
  }
  if (banList) {
    const rb = await api.request(
      '/api/announcements?state=rejected&limit=100&page=1',
    );
    const bannedCountEl = document.getElementById('bannedPostsCount');
    if (!rb.ok) {
      banList.innerHTML = `<div class="info-message">${escapeHtml(await parseError(rb))}</div>`;
      if (bannedCountEl) bannedCountEl.textContent = '0';
    } else {
      const bd = await rb.json();
      const bitems = bd.items || [];
      if (bannedCountEl) {
        bannedCountEl.textContent = String(
          bd.total != null ? bd.total : bitems.length,
        );
      }
      if (bitems.length === 0) {
        banList.innerHTML =
          '<div class="info-message">НЕТ ОТКЛОНЁННЫХ ОБЪЯВЛЕНИЙ</div>';
      } else {
        banList.innerHTML = bitems
          .map(
            (a) => `
        <div class="admin-card admin-card-banned">
            <label class="admin-banned-select">
              <input type="checkbox" class="banned-post-cb" data-id="${a.id}" aria-label="Выбрать объявление" />
            </label>
            <div class="admin-card-info">
                <div class="admin-card-name">${escapeHtml(a.ann_name)}</div>
                <div class="admin-card-email">${escapeHtml((a.author_nickname || '—') + ' · отклонено')}</div>
            </div>
            <div class="admin-card-actions">
                <button type="button" class="admin-unban-post-btn" data-id="${a.id}">ВЕРНУТЬ</button>
                <button type="button" class="admin-delete-banned-post-btn" data-id="${a.id}">УДАЛИТЬ</button>
            </div>
        </div>`,
          )
          .join('');
        banList.querySelectorAll('.admin-unban-post-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const resAp = await api.request(
              `/api/announcements/${id}/approve`,
              {
                method: 'POST',
              },
            );
            if (resAp.ok) {
              await loadAdminData();
              loadPosts();
            } else alert(await parseError(resAp));
          });
        });
        banList
          .querySelectorAll('.admin-delete-banned-post-btn')
          .forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = btn.dataset.id;
              if (!confirm('Удалить объявление безвозвратно?')) return;
              const resDel = await api.request(`/api/announcements/${id}`, {
                method: 'DELETE',
              });
              if (resDel.ok) {
                await loadAdminData();
                loadPosts();
              } else alert(await parseError(resDel));
            });
          });
      }
    }
  }
}

adminPanelBtn.addEventListener('click', async () => {
  await loadAdminData();
  adminModal.style.display = 'block';
});

function setActiveTab(tab) {
  currentTab = tab;
  searchingTabBtn.classList.toggle('active', tab === 'searching');
  mineTabBtn.classList.toggle('active', tab === 'mine');
  foundTabBtn.classList.toggle('active', tab === 'found');
  loadPosts();
}

searchingTabBtn.addEventListener('click', () => setActiveTab('searching'));
mineTabBtn.addEventListener('click', () => setActiveTab('mine'));
foundTabBtn.addEventListener('click', () => setActiveTab('found'));

postsSearchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value || '';
  renderPosts(getTabEmptyMessage());
});

function formatReplyDate(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(iso || '');
  }
}

function openRespondModal(announcementId) {
  if (!respondModal || !respondAnnouncementId || !respondMessage) return;
  respondAnnouncementId.value = String(announcementId);
  respondMessage.value = '';
  respondModal.style.display = 'block';
  respondMessage.focus();
}

function openReportModal(announcementId) {
  if (!reportModal || !reportAnnouncementId || !reportMessage) return;
  reportAnnouncementId.value = String(announcementId);
  reportMessage.value = '';
  reportModal.style.display = 'block';
  reportMessage.focus();
}

async function openRepliesModal(announcementId) {
  if (!repliesModal || !repliesListContainer) return;
  repliesListContainer.innerHTML = '<div class="info-message">ЗАГРУЗКА…</div>';
  repliesModal.style.display = 'block';
  const res = await api.request(`/api/announcements/${announcementId}/replies`);
  if (!res.ok) {
    repliesListContainer.innerHTML = `<div class="info-message">${escapeHtml(await parseError(res))}</div>`;
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) {
    repliesListContainer.innerHTML =
      '<div class="info-message">ПОКА НЕТ ОТКЛИКОВ</div>';
    return;
  }
  repliesListContainer.innerHTML = items
    .map(
      (r) => `
        <div class="reply-item">
            <div class="reply-item-header">
                <span>${escapeHtml(r.nickname)}</span>
                <span class="reply-item-meta">${escapeHtml(formatReplyDate(r.created_at))}</span>
            </div>
            <div class="reply-item-text">${escapeHtml(r.message)}</div>
        </div>`,
    )
    .join('');
}

postsContainer.addEventListener('click', (e) => {
  const del = e.target.closest('.delete-btn');
  if (del && postsContainer.contains(del)) {
    e.preventDefault();
    const raw = del.getAttribute('data-id');
    const id = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(id)) deletePost(id);
    return;
  }
  const resp = e.target.closest('.respond-btn');
  if (resp && postsContainer.contains(resp)) {
    e.preventDefault();
    const raw = resp.getAttribute('data-id');
    const id = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(id)) openRespondModal(id);
    return;
  }
  const vr = e.target.closest('.view-responses-btn');
  if (vr && postsContainer.contains(vr)) {
    e.preventDefault();
    const raw = vr.getAttribute('data-id');
    const id = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(id)) openRepliesModal(id);
    return;
  }
  const mf = e.target.closest('.mark-found-btn');
  if (mf && postsContainer.contains(mf)) {
    e.preventDefault();
    const raw = mf.getAttribute('data-id');
    const id = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(id)) markFoundByAuthor(id);
    return;
  }
  const rep = e.target.closest('.report-btn');
  if (rep && postsContainer.contains(rep)) {
    e.preventDefault();
    if (!currentUser) {
      openAuthModal();
      return;
    }
    const raw = rep.getAttribute('data-id');
    const id = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(id)) openReportModal(id);
  }
});

if (respondForm) {
  respondForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(respondAnnouncementId?.value);
    const message = (respondMessage?.value || '').trim();
    if (!Number.isFinite(id) || !message) return;
    const res = await api.request(`/api/announcements/${id}/replies`, {
      method: 'POST',
      json: { message },
    });
    if (res.ok) {
      respondModal.style.display = 'none';
      await loadPosts();
    } else {
      alert(await parseError(res));
    }
  });
}

if (reportForm) {
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(reportAnnouncementId?.value);
    const message = (reportMessage?.value || '').trim();
    if (!Number.isFinite(id) || !message) return;
    const res = await api.request(`/api/announcements/${id}/reports`, {
      method: 'POST',
      json: { message },
    });
    if (res.ok) {
      reportModal.style.display = 'none';
      alert('Жалоба отправлена');
    } else {
      alert(await parseError(res));
    }
  });
}

createPostBtn.addEventListener('click', async () => {
  await fillGeoSelects();
  createPostModal.style.display = 'block';
});

document.querySelectorAll('.auth-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const authTab = btn.dataset.authTab;
    document
      .querySelectorAll('.auth-tab-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document
      .querySelectorAll('.auth-tab-content')
      .forEach((c) => c.classList.remove('active'));
    document.getElementById(`${authTab}Tab`).classList.add('active');
    if (authTab === 'register') {
      fillRegisterGeo();
    }
  });
});

document.querySelectorAll('.close').forEach((el) => {
  el.addEventListener('click', () => {
    createPostModal.style.display = 'none';
    authModal.style.display = 'none';
    adminModal.style.display = 'none';
    if (respondModal) respondModal.style.display = 'none';
    if (repliesModal) repliesModal.style.display = 'none';
    if (reportModal) reportModal.style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

document
  .getElementById('unbanSelectedPostsBtn')
  ?.addEventListener('click', async (e) => {
    e.preventDefault();
    const list = document.getElementById('bannedPostsList');
    if (!list) return;
    const checked = list.querySelectorAll('.banned-post-cb:checked');
    if (checked.length === 0) {
      alert('Отметьте объявления галочками');
      return;
    }
    if (!confirm(`Вернуть в ленту объявлений: ${checked.length} шт.?`)) {
      return;
    }
    for (const cb of checked) {
      const id = cb.getAttribute('data-id');
      if (!id) continue;
      const res = await api.request(`/api/announcements/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        alert(await parseError(res));
        await loadAdminData();
        loadPosts();
        return;
      }
    }
    await loadAdminData();
    loadPosts();
  });

(async function initApp() {
  await loadUser();
  await loadPosts();
})();
