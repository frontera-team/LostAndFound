import { ref } from 'vue';

import { api } from '@/api/client';
import type { City, District, Region } from '@/types';

/** Каскад регион → город → район, используется в форме объявления, регистрации и профиле. */
export function useGeoCascade() {
  const regions = ref<Region[]>([]);
  const cities = ref<City[]>([]);
  const districts = ref<District[]>([]);

  const regionId = ref<number | null>(null);
  const cityId = ref<number | null>(null);
  const districtId = ref<number | null>(null);

  async function loadRegions(): Promise<Region[]> {
    const res = await api.request('/api/regions', { skipAuth: true });
    regions.value = res.ok ? await res.json() : [];
    return regions.value;
  }

  async function loadCities(regionIdValue: number | null, preferCityId?: number | null): Promise<void> {
    if (!regionIdValue) {
      cities.value = [];
      cityId.value = null;
      return;
    }
    const res = await api.request(`/api/cities?region_id=${regionIdValue}`, { skipAuth: true });
    cities.value = res.ok ? await res.json() : [];
    if (preferCityId != null && cities.value.some((c) => c.id === preferCityId)) {
      cityId.value = preferCityId;
    } else {
      cityId.value = cities.value[0]?.id ?? null;
    }
  }

  async function loadDistricts(cityIdValue: number | null): Promise<void> {
    if (!cityIdValue) {
      districts.value = [];
      districtId.value = null;
      return;
    }
    const res = await api.request(`/api/districts?city_id=${cityIdValue}`, { skipAuth: true });
    districts.value = res.ok ? await res.json() : [];
    districtId.value = districts.value[0]?.id ?? null;
  }

  /** Загружает регионы и раскрывает каскад до переданных region/city (или до первого региона). */
  async function init(preferRegionId?: number | null, preferCityId?: number | null, withDistricts = false): Promise<void> {
    await loadRegions();
    const rid = preferRegionId != null && regions.value.some((r) => r.id === preferRegionId) ? preferRegionId : regions.value[0]?.id ?? null;
    regionId.value = rid;
    await loadCities(rid, preferCityId);
    if (withDistricts) await loadDistricts(cityId.value);
  }

  async function onRegionChange(withDistricts = false): Promise<void> {
    await loadCities(regionId.value);
    if (withDistricts) await loadDistricts(cityId.value);
  }

  async function onCityChange(): Promise<void> {
    await loadDistricts(cityId.value);
  }

  return {
    regions,
    cities,
    districts,
    regionId,
    cityId,
    districtId,
    loadRegions,
    loadCities,
    loadDistricts,
    init,
    onRegionChange,
    onCityChange,
  };
}
