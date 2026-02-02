import type { Achievement } from './types.js';

export const ACHIEVEMENTS: Achievement[] = [
  // Exploration
  {
    id: 'first_step',
    name: '첫 발걸음',
    description: '첫 셀을 공개합니다',
    emoji: '🏆',
    category: 'exploration',
    requirement: { type: 'cells_revealed', value: 1 },
  },
  {
    id: 'explorer_100',
    name: '탐험가',
    description: '100개의 셀을 공개합니다',
    emoji: '🗺️',
    category: 'exploration',
    requirement: { type: 'cells_revealed', value: 100 },
  },
  {
    id: 'explorer_1000',
    name: '대탐험가',
    description: '1,000개의 셀을 공개합니다',
    emoji: '🧭',
    category: 'exploration',
    requirement: { type: 'cells_revealed', value: 1000 },
  },
  {
    id: 'legendary_miner',
    name: '전설의 광부',
    description: '누적 10,000개의 셀을 공개합니다',
    emoji: '⛏️',
    category: 'exploration',
    requirement: { type: 'cells_revealed', value: 10000 },
    reward: { type: 'title', value: '전설의 광부' },
  },
  {
    id: 'chunk_conqueror',
    name: '영역 정복자',
    description: '한 청크의 50% 이상을 공개합니다',
    emoji: '👑',
    category: 'exploration',
    requirement: { type: 'chunk_domination', value: 50 },
  },

  // Accuracy
  {
    id: 'flag_novice',
    name: '깃발 초보',
    description: '10개의 깃발을 정확히 꽂습니다',
    emoji: '🚩',
    category: 'accuracy',
    requirement: { type: 'correct_flags', value: 10 },
  },
  {
    id: 'mine_detector',
    name: '지뢰 탐지견',
    description: '100개의 깃발을 정확히 꽂습니다',
    emoji: '🐕',
    category: 'accuracy',
    requirement: { type: 'correct_flags', value: 100 },
  },
  {
    id: 'bomb_expert',
    name: '폭탄 전문가',
    description: '폭탄 0개로 1,000개의 셀을 공개합니다',
    emoji: '💣',
    category: 'accuracy',
    requirement: { type: 'perfect_streak', value: 1000 },
    reward: { type: 'score', value: 500 },
  },
  {
    id: 'untouchable',
    name: '불사신',
    description: '한 세션에서 폭탄을 한 번도 터뜨리지 않고 500점 달성',
    emoji: '🛡️',
    category: 'accuracy',
    requirement: { type: 'perfect_session_score', value: 500 },
  },

  // Speed
  {
    id: 'speedrunner',
    name: '스피드러너',
    description: '1분에 100개의 셀을 공개합니다',
    emoji: '⚡',
    category: 'speed',
    requirement: { type: 'cells_per_minute', value: 100 },
  },
  {
    id: 'chain_master',
    name: '연쇄 마스터',
    description: '한 번의 클릭으로 50개의 셀을 공개합니다',
    emoji: '💥',
    category: 'speed',
    requirement: { type: 'chain_reveal', value: 50 },
  },
  {
    id: 'quick_starter',
    name: '빠른 시작',
    description: '세션 시작 1분 내에 50점을 획득합니다',
    emoji: '🏃',
    category: 'speed',
    requirement: { type: 'quick_score', value: 50 },
  },

  // Social
  {
    id: 'team_player',
    name: '팀 플레이어',
    description: '길드원과 함께 500개의 셀을 공개합니다',
    emoji: '🤝',
    category: 'social',
    requirement: { type: 'guild_cells_revealed', value: 500 },
  },
  {
    id: 'guild_founder',
    name: '길드 창립자',
    description: '길드를 생성합니다',
    emoji: '🏰',
    category: 'social',
    requirement: { type: 'guild_created', value: 1 },
  },
  {
    id: 'popular',
    name: '인기인',
    description: '10명이 있는 길드에 가입합니다',
    emoji: '⭐',
    category: 'social',
    requirement: { type: 'guild_members', value: 10 },
  },
  {
    id: 'communicator',
    name: '소통왕',
    description: '채팅 메시지를 100개 보냅니다',
    emoji: '💬',
    category: 'social',
    requirement: { type: 'chat_messages', value: 100 },
  },

  // Collection
  {
    id: 'item_finder',
    name: '아이템 파인더',
    description: '첫 아이템을 획득합니다',
    emoji: '🎁',
    category: 'collection',
    requirement: { type: 'items_collected', value: 1 },
  },
  {
    id: 'item_collector',
    name: '아이템 수집가',
    description: '모든 종류의 아이템을 획득합니다',
    emoji: '🏅',
    category: 'collection',
    requirement: { type: 'unique_items', value: 5 },
    reward: { type: 'score', value: 200 },
  },
  {
    id: 'lucky_one',
    name: '행운아',
    description: '유령 모드 아이템을 획득합니다',
    emoji: '🍀',
    category: 'collection',
    requirement: { type: 'rare_item', value: 1 },
  },
  {
    id: 'hoarder',
    name: '수집광',
    description: '50개의 아이템을 획득합니다',
    emoji: '📦',
    category: 'collection',
    requirement: { type: 'items_collected', value: 50 },
  },

  // Mastery
  {
    id: 'skill_user',
    name: '스킬 유저',
    description: '모든 스킬을 한 번씩 사용합니다',
    emoji: '✨',
    category: 'mastery',
    requirement: { type: 'unique_skills', value: 6 },
  },
  {
    id: 'zone_explorer',
    name: '존 탐험가',
    description: '모든 존에서 셀을 공개합니다',
    emoji: '🌍',
    category: 'mastery',
    requirement: { type: 'zones_visited', value: 6 },
  },
  {
    id: 'danger_seeker',
    name: '위험 추구자',
    description: '위험지대에서 100개의 셀을 공개합니다',
    emoji: '☠️',
    category: 'mastery',
    requirement: { type: 'danger_zone_cells', value: 100 },
    reward: { type: 'score', value: 300 },
  },
  {
    id: 'mystery_solver',
    name: '미스터리 해결사',
    description: '미스터리 존에서 50개의 셀을 공개합니다',
    emoji: '🔮',
    category: 'mastery',
    requirement: { type: 'mystery_zone_cells', value: 50 },
  },
  {
    id: 'veteran',
    name: '베테랑',
    description: '10개의 세션에 참여합니다',
    emoji: '🎖️',
    category: 'mastery',
    requirement: { type: 'sessions_played', value: 10 },
  },
  {
    id: 'champion',
    name: '챔피언',
    description: '세션 종료 시 1위를 달성합니다',
    emoji: '🏆',
    category: 'mastery',
    requirement: { type: 'session_rank', value: 1 },
    reward: { type: 'title', value: '챔피언' },
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENT_MAP.get(id);
}

export function getAchievementsByCategory(category: string): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
