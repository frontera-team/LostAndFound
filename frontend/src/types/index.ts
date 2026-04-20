export interface Me {
  id: number;
  nickname: string;
  email: string;
  role_name: string;
  region_id: number | null;
  city_id: number | null;
}

export interface CurrentUser {
  id: number;
  nickname: string;
  email: string;
  role: string;
  region_id: number | null;
  city_id: number | null;
}

export interface Region {
  id: number;
  region_name: string;
}

export interface City {
  id: number;
  city_name: string;
}

export interface District {
  id: number;
  district: string;
}

export interface Category {
  id: number;
  category_name: string;
}

export interface Role {
  id: number;
  role_name: string;
}

/** Сырой объект объявления, как его отдаёт FastAPI. */
export interface AnnouncementDto {
  id: number;
  ann_name: string;
  ann_description: string;
  ann_pic: string | null;
  ann_pic_mime: string | null;
  ann_reward: number | null;
  status: string;
  publish_in_found: boolean;
  user_creator_id: number | null;
  author_nickname: string | null;
  region_name?: string | null;
  city_name?: string | null;
  district_name?: string | null;
  response_count?: number | null;
}

export type RewardType = 'money' | 'voluntary';

/** Объявление, приведённое к виду, удобному для отображения карточек. */
export interface Post {
  id: number;
  title: string;
  description: string;
  image: string;
  location: string;
  userId: number | null;
  authorNickname: string;
  rewardType: RewardType;
  reward: number | null;
  status: string;
  publishInFound: boolean;
  responseCount: number | null;
}

export interface Paginated<T> {
  items: T[];
  total?: number;
}

export interface Reply {
  id: number;
  nickname: string;
  message: string;
  created_at: string;
}

export interface ReportItem {
  id: number;
  reporter_nickname: string;
  reporter_email: string;
  message: string;
  created_at: string;
  status: string;
}

export interface ReportGroup {
  announcement_id: number;
  ann_name: string;
  announcement_status: string;
  reports: ReportItem[];
}

export interface AdminUser {
  id: number;
  nickname: string;
  email: string;
  region: string;
  role_id: number;
  role_name?: string;
  is_blocked: boolean;
}

export interface ProfileDto {
  nickname: string;
  email: string;
  region_id: number | null;
  city_id: number | null;
  region_name?: string | null;
  city_name?: string | null;
  avatar?: string | null;
  avatar_mime?: string | null;
}

export type TabKey = 'searching' | 'mine' | 'found';

export type AdminType = 'users' | 'posts' | 'reports';
export type AdminStatus = 'active' | 'banned';
