import type { AnnouncementDto, Post } from '@/types';

function annImageUrl(a: AnnouncementDto): string {
  if (a.ann_pic && a.ann_pic_mime) {
    const raw = a.ann_pic.startsWith('data:') ? a.ann_pic.split(',')[1] : a.ann_pic;
    return `data:${a.ann_pic_mime};base64,${raw}`;
  }
  return 'https://via.placeholder.com/400x280/f8f9fa/6c757d?text=NO+PHOTO';
}

export function annToPost(a: AnnouncementDto): Post {
  const loc = [a.district_name, a.city_name, a.region_name].filter(Boolean).join(', ');
  return {
    id: a.id,
    title: a.ann_name,
    description: a.ann_description,
    image: annImageUrl(a),
    location: loc || '—',
    userId: a.user_creator_id,
    authorNickname: a.author_nickname || '—',
    rewardType: a.ann_reward != null && a.ann_reward > 0 ? 'money' : 'voluntary',
    reward: a.ann_reward,
    status: a.status != null && a.status !== '' ? String(a.status) : '',
    publishInFound: !!a.publish_in_found,
    responseCount: a.response_count != null ? Number(a.response_count) : null,
  };
}

export function filterPostsBySearch(posts: Post[], query: string): Post[] {
  const tokens = (query || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return posts;
  return posts.filter((post) => {
    const searchable = `${post.title.toLowerCase()} ${post.description.toLowerCase()}`;
    return tokens.every((token) => searchable.includes(token));
  });
}
