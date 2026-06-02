export const AVATAR_COLORS = [
  '#E05252',
  '#E07A3A',
  '#C99A2E',
  '#3DAB76',
  '#3A9BBF',
  '#5B7FE8',
  '#8B5CF6',
  '#64748B',
]

// Returns inline style for an avatar circle.
// Falls back to the theme accent when no color is stored yet.
export function avatarStyle(color) {
  if (!color) {
    return {
      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
      color: 'var(--accent)',
    }
  }
  return {
    background: color + '26', // hex alpha ≈ 15% opacity
    color,
  }
}
