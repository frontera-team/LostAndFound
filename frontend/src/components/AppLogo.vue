<template>
  <div class="logo-container">
    <div class="logo-svg">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="url(#gradient)" />
        <path d="M20 12 L24 18 L20 24 L16 18 L20 12Z" fill="white" stroke="white" stroke-width="1.5" />
        <circle cx="20" cy="18" r="2" fill="#ff6b6b" />
        <path d="M14 26 L26 26" stroke="white" stroke-width="2" stroke-linecap="round" />
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ff6b6b" />
            <stop offset="1" stop-color="#ff8787" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <span class="site-title">Потеряшки</span>
  </div>
</template>

<style scoped>
.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-svg {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-svg svg {
  width: 100%;
  height: 100%;
  display: block;
}

.site-title {
  font-size: 1.5rem;
  font-weight: 1000;
  color: var(--lf-accent);
  letter-spacing: -0.5px;
}
</style>
