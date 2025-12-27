/**
 * Parse duration strings like "10m", "2h", "3d" into milliseconds
 * @param duration - Duration string (e.g., "10m", "2h", "3d")
 * @returns Duration in milliseconds or null if invalid
 */
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 0);
}

/**
 * Format milliseconds into a human-readable string
 * @param ms - Milliseconds
 * @returns Formatted string (e.g., "10m", "2h", "3d")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Validate if a duration is within allowed range
 * @param ms - Duration in milliseconds
 * @param min - Minimum allowed duration in milliseconds
 * @param max - Maximum allowed duration in milliseconds
 * @returns True if valid, false otherwise
 */
export function isValidDuration(ms: number, min: number, max: number): boolean {
  return ms >= min && ms <= max;
}
