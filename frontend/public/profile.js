const api = window.LF_API;

function homeHref() {
  return window.location.protocol === 'file:' ? 'index.html' : '/';
}

const profileForm = document.getElementById('profileForm');
const nicknameInput = document.getElementById('nicknameInput');
const regionSelect = document.getElementById('regionSelect');
const citySelect = document.getElementById('citySelect');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const emailValue = document.getElementById('emailValue');
const regionValue = document.getElementById('regionValue');
const cityValue = document.getElementById('cityValue');
const logoutBtn = document.getElementById('logoutBtn');
const homeLink = document.querySelector('a.secondary-btn');
const profileInfoTabBtn = document.getElementById('profileInfoTabBtn');
const foundByMeTabBtn = document.getElementById('foundByMeTabBtn');
const adminModerationTabBtn = document.getElementById('adminModerationTabBtn');
const profileInfoTab = document.getElementById('profileInfoTab');
const foundByMeTab = document.getElementById('foundByMeTab');
const adminModerationTab = document.getElementById('adminModerationTab');
const foundByMeList = document.getElementById('foundByMeList');
const profileCard = document.getElementById('profileCard');
const profileModerationList = document.getElementById('profileModerationList');
const profileModCount = document.getElementById('profileModCount');

let currentAvatar = '';
let activeProfileTab = 'info';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function isAdminModerationTabAvailable() {
  return adminModerationTabBtn && !adminModerationTabBtn.hidden;
}

function setActiveProfileTab(tab) {
  if (tab === 'moderation' && !isAdminModerationTabAvailable()) {
    tab = 'info';
  }
  activeProfileTab = tab;
  profileInfoTabBtn.classList.toggle('active', tab === 'info');
  foundByMeTabBtn.classList.toggle('active', tab === 'found-by-me');
  if (adminModerationTabBtn) {
    adminModerationTabBtn.classList.toggle('active', tab === 'moderation');
  }
  profileInfoTab.classList.toggle('active', tab === 'info');
  foundByMeTab.classList.toggle('active', tab === 'found-by-me');
  if (adminModerationTab) {
    adminModerationTab.classList.toggle('active', tab === 'moderation');
  }
  if (tab === 'found-by-me') {
    showFoundByMePlaceholder();
  }
  if (tab === 'moderation') {
    loadProfileModeration();
  }
}

async function syncAdminTabVisibility() {
  if (!adminModerationTabBtn || !profileCard) return;
  const r = await api.request('/api/auth/me');
  let isAdmin = false;
  if (r.ok) {
    const me = await r.json();
    isAdmin = !!(me && me.role_name === 'admin');
  }
  adminModerationTabBtn.hidden = !isAdmin;
  profileCard.classList.toggle('profile-card--admin', isAdmin);
  if (!isAdmin && activeProfileTab === 'moderation') {
    setActiveProfileTab('info');
  }
}

async function loadProfileModeration() {
  if (!profileModerationList || !profileModCount) return;
  if (!isAdminModerationTabAvailable()) return;
  profileModerationList.innerHTML =
    '<div class="profile-empty">ЗАГРУЗКА…</div>';
  const r = await api.request(
    '/api/announcements?state=moderation&moderation_scope=all&limit=100&page=1',
  );
  if (!r.ok) {
    profileModerationList.innerHTML = `<div class="profile-empty">${escapeHtml(await parseError(r))}</div>`;
    profileModCount.textContent = '0';
    return;
  }
  const data = await r.json();
  const items = data.items || [];
  profileModCount.textContent = String(items.length);
  if (items.length === 0) {
    profileModerationList.innerHTML =
      '<div class="profile-empty">НЕТ ОБЪЯВЛЕНИЙ НА МОДЕРАЦИИ</div>';
    return;
  }
  profileModerationList.innerHTML = items
    .map((a) => {
      const hint = a.publish_in_found
        ? 'После публикации: раздел «Найдено»'
        : 'После публикации: «В поиске»';
      return `
        <div class="profile-mod-card" data-announcement-id="${a.id}">
            <div class="profile-mod-card-info">
                <div class="profile-mod-title">${escapeHtml(a.ann_name)}</div>
                <div class="profile-mod-meta">${escapeHtml(a.author_nickname || '—')} · ${escapeHtml(hint)}</div>
            </div>
            <div class="profile-mod-actions">
                <button type="button" class="profile-mod-btn profile-mod-btn--approve" data-mod-action="approve" data-id="${a.id}">ПРОПУСТИТЬ</button>
                <button type="button" class="profile-mod-btn profile-mod-btn--reject" data-mod-action="reject" data-id="${a.id}">ОТКЛОНИТЬ</button>
                <button type="button" class="profile-mod-btn profile-mod-btn--delete" data-mod-action="delete" data-id="${a.id}">УДАЛИТЬ</button>
            </div>
        </div>`;
    })
    .join('');
}

async function parseError(res) {
  try {
    const j = await res.json();
    if (j.detail) {
      if (Array.isArray(j.detail)) return j.detail.map((d) => d.msg || d).join('; ');
      return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    }
    return j.error || j.message || `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

async function fillRegionCitySelects(selectedRegionId, selectedCityId) {
  const res = await api.request('/api/regions', { skipAuth: true });
  const regions = res.ok ? await res.json() : [];
  regionSelect.innerHTML = regions
    .map((r) => `<option value="${r.id}">${escapeHtml(r.region_name)}</option>`)
    .join('');

  async function loadCities(rid, selectCity) {
    const r2 = await api.request(`/api/cities?region_id=${rid}`, { skipAuth: true });
    const cities = r2.ok ? await r2.json() : [];
    citySelect.innerHTML = cities
      .map((c) => `<option value="${c.id}">${escapeHtml(c.city_name)}</option>`)
      .join('');
    if (selectCity) {
      const hit = cities.some((c) => c.id === selectCity);
      if (hit) citySelect.value = String(selectCity);
    }
  }

  regionSelect.onchange = () => loadCities(regionSelect.value, null);

  if (selectedRegionId) {
    regionSelect.value = String(selectedRegionId);
    await loadCities(selectedRegionId, selectedCityId || null);
  } else if (regions.length) {
    regionSelect.value = String(regions[0].id);
    await loadCities(regions[0].id, null);
  }
}

function showFoundByMePlaceholder() {
  foundByMeList.innerHTML =
    '<div class="profile-empty">В API НЕТ СПИСКА ОТКЛИКОВ — РАЗДЕЛ ЗАРЕЗЕРВИРОВАН</div>';
}

async function loadProfile() {
  const res = await api.request('/api/profile');
  if (!res.ok) {
    window.location.href = homeHref();
    return;
  }

  const user = await res.json();
  nicknameInput.value = user.nickname || '';
  emailValue.textContent = user.email || '-';
  regionValue.textContent = user.region_name || '-';
  cityValue.textContent = user.city_name || '-';

  await fillRegionCitySelects(user.region_id, user.city_id);

  currentAvatar = user.avatar || '';
  const mime = user.avatar_mime || 'image/png';
  avatarPreview.src = currentAvatar
    ? currentAvatar.startsWith('data:')
      ? currentAvatar
      : `data:${mime};base64,${currentAvatar}`
    : 'https://via.placeholder.com/160x160/f8f9fa/6c757d?text=AVATAR';

  await syncAdminTabVisibility();
}

avatarInput.addEventListener('change', () => {
  const file = avatarInput.files?.[0];
  if (!file) {
    avatarPreview.src = currentAvatar
      ? currentAvatar.startsWith('data:')
        ? currentAvatar
        : `data:image/png;base64,${currentAvatar}`
      : 'https://via.placeholder.com/160x160/f8f9fa/6c757d?text=AVATAR';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.src = e.target?.result || '';
  };
  reader.readAsDataURL(file);
});

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nickname = nicknameInput.value.trim();
  const region_id = parseInt(regionSelect.value, 10);
  const city_id = parseInt(citySelect.value, 10);

  const res = await api.request('/api/profile', {
    method: 'PUT',
    json: {
      nickname,
      region_id: Number.isFinite(region_id) ? region_id : null,
      city_id: Number.isFinite(city_id) ? city_id : null,
    },
  });

  if (!res.ok) {
    alert(await parseError(res));
    return;
  }

  const file = avatarInput.files?.[0];
  if (file) {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (typeof dataUrl === 'string') {
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const mime = file.type || 'image/png';
      const ar = await api.request('/api/profile/avatar', {
        method: 'PUT',
        json: { avatar: base64, avatar_mime: mime },
      });
      if (!ar.ok) {
        alert(await parseError(ar));
        return;
      }
    }
  }

  avatarInput.value = '';
  await loadProfile();
  alert('Профиль обновлён');
});

logoutBtn.addEventListener('click', async () => {
  const rt = api.getRefresh();
  if (rt) {
    await api.request('/api/auth/logout', {
      method: 'POST',
      json: { refresh_token: rt },
    });
  }
  api.clearTokens();
  window.location.href = homeHref();
});

profileInfoTabBtn.addEventListener('click', () => setActiveProfileTab('info'));
foundByMeTabBtn.addEventListener('click', () => setActiveProfileTab('found-by-me'));
if (adminModerationTabBtn) {
  adminModerationTabBtn.addEventListener('click', () =>
    setActiveProfileTab('moderation'),
  );
}

if (profileModerationList) {
  profileModerationList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-mod-action][data-id]');
    if (!btn || !profileModerationList.contains(btn)) return;
    const action = btn.dataset.modAction;
    const id = btn.dataset.id;
    if (!id || !action) return;
    if (action === 'reject' && !confirm('Отклонить объявление?')) return;
    if (action === 'delete' && !confirm('Удалить объявление безвозвратно?')) return;
    const row = btn.closest('.profile-mod-card');
    const buttons = row ? row.querySelectorAll('.profile-mod-btn') : [];
    buttons.forEach((b) => {
      b.disabled = true;
    });
    try {
      let res;
      if (action === 'approve') {
        res = await api.request(`/api/announcements/${id}/approve`, {
          method: 'POST',
        });
      } else if (action === 'reject') {
        res = await api.request(`/api/announcements/${id}/reject`, {
          method: 'POST',
        });
      } else if (action === 'delete') {
        res = await api.request(`/api/announcements/${id}`, {
          method: 'DELETE',
        });
      } else {
        return;
      }
      if (res.ok) await loadProfileModeration();
      else {
        buttons.forEach((b) => {
          b.disabled = false;
        });
        alert(await parseError(res));
      }
    } catch {
      buttons.forEach((b) => {
        b.disabled = false;
      });
      alert('Не удалось выполнить действие');
    }
  });
}

if (homeLink) homeLink.setAttribute('href', homeHref());

loadProfile();
showFoundByMePlaceholder();
