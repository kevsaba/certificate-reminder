import { CertificateEntry } from '@/types';

export type ExpirationReason = 'DATE_BASED';

/**
 * Extracts the base category from a category string (e.g., "FICHA - 2025" -> "FICHA")
 * This groups certificates by their type, ignoring the year suffix
 * @param category Category string that may contain a year suffix
 * @returns Base category name (e.g., "FICHA", "EPIS", "TELEFORMACION")
 *
 * Examples:
 * - "FICHA - 2025" -> "FICHA"
 * - "EPIS - 2024" -> "EPIS"
 * - "TELEFORMACION  - 2023" -> "TELEFORMACION" (handles double space)
 * - "CONSENTIMIENTO - 2025" -> "CONSENTIMIENTO"
 * - "SAFETY" -> "SAFETY" (no year suffix)
 */
export function extractBaseCategory(category: string): string {
  // Match patterns like "CATEGORY - 2025" or "CATEGORY  - 2025" (with double space)
  // Remove the year suffix and trim whitespace
  const match = category.match(/^(.+?)\s*-\s*\d{4}/);
  let baseCategory = match ? match[1].trim() : category.trim();

  // Normalize category variations to group them together
  const normalized = baseCategory.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Map "FORMACION" (Spanish) to "TELEFORMACION" for consistency
  if (normalized === 'FORMACION' || normalized === 'TELEFORMACION') {
    return 'TELEFORMACION';
  }

  if (normalized === 'EPI') {
    return 'EPIS';
  }

  // Return original case for other categories
  return baseCategory;
}

/**
 * Filters certificate entries to only include the latest one for each person+category combination.
 * This prevents duplicate notifications and ensures we check the most recent certificate.
 * @param entries All certificate entries
 * @returns Filtered entries with only the latest certificate per person+base category
 *
 * Logic:
 * - Groups by email (person) + base category
 * - For each group, selects the certificate with the latest expiration date
 * - Returns only one certificate per group
 *
 * Example:
 * If a person has "FICHA - 2023", "FICHA - 2024", "FICHA - 2025"
 * Only "FICHA - 2025" (or whichever has the latest expiration date) is returned
 */
export function getLatestCertificatePerCategory(entries: CertificateEntry[]): CertificateEntry[] {
  // Map to store the latest certificate for each person+category group
  const latestMap = new Map<string, CertificateEntry>();

  for (const entry of entries) {
    const baseCategory = extractBaseCategory(entry.category);
    const groupKey = `${entry.dni}_${baseCategory}`;

    const existing = latestMap.get(groupKey);

    // If no entry exists for this group, or if current entry has a later expiration date
    if (!existing || entry.expirationDate > existing.expirationDate) {
      latestMap.set(groupKey, entry);
    }
  }

  // Return array of latest certificates
  return Array.from(latestMap.values());
}

export interface ExpirationStatus {
  expired: boolean;
  reason?: ExpirationReason;
  daysUntil?: number;
}

/**
 * Calculates the number of days until a given date
 * @param date Target date
 * @returns Number of days (positive for future, negative or zero for past)
 */
export function calculateDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Extracts the year from a category string (e.g., "FICHA - 2025" -> 2025)
 * @param category Category string that may contain a year
 * @returns Year number (defaults to current year if not found)
 */
export function extractYearFromCategory(category: string): number {
  const match = category.match(/(\d{4})/);
  return match ? parseInt(match[1]) : new Date().getFullYear();
}

/**
 * Checks if a certificate is expired based on year or date
 * @param entry Certificate entry to check
 * @returns True if certificate is expired
 */
export function isCertificateExpired(entry: CertificateEntry): boolean {
  const status = getExpirationStatus(entry);
  return status.expired;
}

/**
 * Gets detailed expiration status for a certificate
 * @param entry Certificate entry to check
 * @returns Expiration status with reason and details
 */
export function getExpirationStatus(entry: CertificateEntry): ExpirationStatus {
  const daysUntil = calculateDaysUntil(entry.expirationDate);

  // Only check the actual expiration date
  // The year in the category (e.g., "FICHA - 2025") is metadata about when the
  // certificate was issued, not when it expires. The expirationDate field is
  // the authoritative source for whether a certificate is expired.
  if (daysUntil <= 0) {
    return {
      expired: true,
      reason: 'DATE_BASED',
      daysUntil,
    };
  }

  // Not expired
  return {
    expired: false,
    daysUntil,
  };
}

/**
 * Checks if a certificate is expiring soon (within 30 days)
 * @param entry Certificate entry to check
 * @returns True if certificate expires within 30 days
 */
export function isCertificateExpiringSoon(entry: CertificateEntry): boolean {
  const status = getExpirationStatus(entry);
  if (status.expired) return false;

  const daysUntil = status.daysUntil ?? 0;
  return daysUntil <= 30 && daysUntil > 0;
}

/**
 * Gets a human-readable status text for a certificate
 * @param entry Certificate entry
 * @returns Status text
 */
export function getCertificateStatusText(entry: CertificateEntry): string {
  const status = getExpirationStatus(entry);

  if (status.expired) {
    return 'Expired';
  }

  const daysUntil = status.daysUntil ?? 0;

  if (daysUntil <= 30) {
    return `Expiring in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
  }

  return 'Valid';
}
