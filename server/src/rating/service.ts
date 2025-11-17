import { MatchMode, PlayerRating } from '../types';

/**
 * Simple in-memory rating service stub.
 * For now, every player starts at 1200 Elo-equivalent rating.
 * This can later be replaced with a persistent Elo/Glicko/TrueSkill implementation.
 */

const DEFAULT_RATING = 1200;

const ratings = new Map<string, PlayerRating>();

function ratingKey(userId: string, mode: MatchMode): string {
  return `${mode}:${userId}`;
}

export function getPlayerRating(userId: string, mode: MatchMode): PlayerRating {
  const key = ratingKey(userId, mode);
  const existing = ratings.get(key);
  if (existing) {
    return existing;
  }
  const rating: PlayerRating = {
    mode,
    ratingValue: DEFAULT_RATING,
  };
  ratings.set(key, rating);
  return rating;
}

export function updatePlayerRating(
  userId: string,
  mode: MatchMode,
  newRatingValue: number,
  newUncertainty?: number,
): void {
  const key = ratingKey(userId, mode);
  ratings.set(key, {
    mode,
    ratingValue: newRatingValue,
    ratingUncertainty: newUncertainty,
  });
}

