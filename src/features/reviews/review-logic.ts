/**
 * Review helpers: validation, the Firestore document shape and the rating summary.
 */
import { LIMITS, type Rating, type Review } from '@/types/model';

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Didn’t like it',
  2: 'It was OK',
  3: 'Liked it',
  4: 'Really liked it',
  5: 'Loved it',
};

export function isRating(value: number): value is Rating {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Returns an error message, or null when the review can be saved. */
export function validateReview(rating: number, text: string): string | null {
  if (!isRating(rating)) return 'Pick a star rating.';
  if (text.trim().length > LIMITS.reviewText)
    return `Keep it under ${LIMITS.reviewText} characters.`;
  return null;
}

/**
 * Fields written to `reviews/{workId}_{uid}` (timestamps are added by the caller:
 * `createdAt` only on create, `updatedAt` always).
 */
export function reviewFields(input: {
  workId: string;
  uid: string;
  authorName: string;
  rating: Rating;
  text: string;
}): Pick<Review, 'workId' | 'authorId' | 'authorName' | 'rating' | 'text'> {
  const text = input.text.trim();
  return {
    workId: input.workId,
    authorId: input.uid,
    authorName: input.authorName.trim().slice(0, LIMITS.profileName) || 'Reader',
    rating: input.rating,
    text: text ? text : null,
  };
}

/** Count of reviews per star (index 0 = 1 star … index 4 = 5 stars). */
export function ratingDistribution(reviews: readonly Pick<Review, 'rating'>[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    if (isRating(r.rating)) counts[r.rating - 1]! += 1;
  }
  return counts;
}

/** Star fill for a display value, e.g. 3.6 → [1, 1, 1, 0.5, 0] (rounded to the nearest half). */
export function starFills(value: number): number[] {
  const half = Math.round(value * 2) / 2;
  return [1, 2, 3, 4, 5].map((n) => (half >= n ? 1 : half >= n - 0.5 ? 0.5 : 0));
}
