// Centralized leveling + badge milestone logic.
// Badges are assigned by reaching (or surpassing) a level milestone.
// The latest milestone badge always replaces the previous one.

export const MAX_LEVEL = 100;
export const LEVEL_XP_MULTIPLIER = 1000;

// Ordered by level asc. Feel free to tweak names/icons.
export const BADGE_MILESTONES = [
  { id: 'recruit',   level: 1,   name: 'Recruit',    icon: '🪖' },
  { id: 'soldier',   level: 10,  name: 'Soldier',    icon: '⚔️' },
  { id: 'gladiator', level: 20,  name: 'Gladiator',  icon: '🏟️' },
  { id: 'knight',    level: 35,  name: 'Knight',     icon: '🛡️' },
  { id: 'champion',  level: 50,  name: 'Champion',   icon: '🏆' },
  { id: 'warlord',   level: 70,  name: 'Warlord',    icon: '🔥' },
  { id: 'hero',      level: 85,  name: 'Hero',       icon: '✨' },
  { id: 'mythic',    level: 100, name: 'Mythic',     icon: '👑' }
];

/**
 * Avatar border milestones (cool/fancy borders unlocked by level).
 * Users may choose any unlocked border, but we keep track of the highest unlocked ("max") so we can
 * auto-assign when they level up (or when admins change levels).
 *
 * Each border has a `style` object:
 * - backgroundImage: CSS background-image for the outer ring
 * - className: optional Tailwind classes (e.g., animation)
 * - boxShadow: optional glow shadow
 * - sparkle: tiny sparkles overlay
 */
export const AVATAR_BORDER_MILESTONES = [
  {
    id: 'recruit_ring',
    level: 1,
    name: 'Recruit Ring',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06), rgba(255,255,255,0.18))',
      className: 'bg-black/20',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
      sparkle: false
    }
  },
  {
    id: 'soldier_bronze',
    level: 10,
    name: 'Soldier Bronze',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #b45309, #f59e0b, #b45309, #78350f, #b45309)',
      className: 'animate-[spin_9s_linear_infinite]',
      boxShadow: '0 0 14px rgba(245,158,11,0.25)',
      sparkle: false
    }
  },
  {
    id: 'gladiator_crimson',
    level: 20,
    name: 'Gladiator Crimson',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #ef4444, #fb7185, #a855f7, #ef4444)',
      className: 'animate-[spin_7s_linear_infinite]',
      boxShadow: '0 0 18px rgba(239,68,68,0.28)',
      sparkle: true
    }
  },
  {
    id: 'knight_steel',
    level: 35,
    name: 'Knight Steel',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #cbd5e1, #94a3b8, #e2e8f0, #64748b, #cbd5e1)',
      className: 'animate-[spin_10s_linear_infinite]',
      boxShadow: '0 0 16px rgba(226,232,240,0.20)',
      sparkle: false
    }
  },
  {
    id: 'champion_gold',
    level: 50,
    name: 'Champion Gold',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #fbbf24, #fde68a, #f59e0b, #fbbf24)',
      className: 'animate-[spin_6s_linear_infinite]',
      boxShadow: '0 0 22px rgba(251,191,36,0.30)',
      sparkle: true
    }
  },
  {
    id: 'warlord_ember',
    level: 70,
    name: 'Warlord Ember',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #f97316, #ef4444, #f59e0b, #f97316)',
      className: 'animate-[spin_5s_linear_infinite]',
      boxShadow: '0 0 26px rgba(249,115,22,0.32)',
      sparkle: true
    }
  },
  {
    id: 'hero_aurora',
    level: 85,
    name: 'Hero Aurora',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #22c55e, #06b6d4, #a855f7, #22c55e)',
      className: 'animate-[spin_8s_linear_infinite]',
      boxShadow: '0 0 28px rgba(34,197,94,0.22)',
      sparkle: true
    }
  },
  {
    id: 'mythic_cosmic',
    level: 100,
    name: 'Mythic Cosmic',
    style: {
      backgroundImage: 'conic-gradient(from 180deg, #60a5fa, #a78bfa, #f472b6, #facc15, #60a5fa)',
      className: 'animate-[spin_4.5s_linear_infinite]',
      boxShadow: '0 0 34px rgba(167,139,250,0.34)',
      sparkle: true
    }
  }
];

export function clampLevel(level = 1) {
  const lvl = Math.max(1, Number(level) || 1);
  return Math.min(MAX_LEVEL, lvl);
}

export function getNextLevelXp(level = 1) {
  const lvl = clampLevel(level);
  // No next level after MAX_LEVEL.
  if (lvl >= MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return lvl * LEVEL_XP_MULTIPLIER;
}

export function getBadgeForLevel(level = 1) {
  const lvl = clampLevel(level);
  let current = BADGE_MILESTONES[0];
  for (const b of BADGE_MILESTONES) {
    if (lvl >= b.level) current = b;
    else break;
  }
  return current;
}

export function normalizeBadge(badge) {
  if (!badge || typeof badge !== 'object') return null;
  const id = badge.id || badge.badgeId;
  if (!id) return null;
  return {
    id,
    level: Number(badge.level) || undefined,
    name: badge.name || undefined,
    icon: badge.icon || undefined
  };
}

export function getAvatarBorderForLevel(level = 1) {
  const lvl = clampLevel(level);
  let current = AVATAR_BORDER_MILESTONES[0];
  for (const b of AVATAR_BORDER_MILESTONES) {
    if (lvl >= b.level) current = b;
    else break;
  }
  return current;
}

export function getUnlockedAvatarBorders(level = 1) {
  const lvl = clampLevel(level);
  return AVATAR_BORDER_MILESTONES.filter(b => lvl >= b.level);
}

export function getAvatarBorderById(id) {
  if (!id) return AVATAR_BORDER_MILESTONES[0];
  return AVATAR_BORDER_MILESTONES.find(b => b.id === id) || AVATAR_BORDER_MILESTONES[0];
}
