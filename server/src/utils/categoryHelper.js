import { ISSUE_CATEGORIES } from '../models/Issue.js';

/**
 * Normalizes user-submitted category labels to schema enum values
 */
export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return null;

  const raw = category.trim().toLowerCase();

  if (raw === 'infrastructure' || raw.includes('academic')) return 'infrastructure';
  if (raw === 'electrical' || raw.includes('power')) return 'electrical';
  if (raw === 'plumbing' || raw.includes('water')) return 'plumbing';
  if (
    raw === 'it_wifi' ||
    raw === 'it-wifi' ||
    raw === 'it & network' ||
    raw.includes('network') ||
    raw.includes('wifi')
  ) {
    return 'it_wifi';
  }
  if (raw === 'safety' || raw.includes('safety')) return 'safety';
  if (raw === 'sanitation' || raw.includes('hygiene') || raw.includes('cleanliness')) {
    return 'sanitation';
  }
  if (raw === 'other') return 'other';

  // If already an exact enum match, return it
  if (ISSUE_CATEGORIES.includes(raw)) {
    return raw;
  }

  return raw;
}
