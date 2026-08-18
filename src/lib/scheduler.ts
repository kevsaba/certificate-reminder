import { CertificateEntry, CheckResult, ReminderPayload, Template } from '@/types';
import { sendEmailNotifications } from './email';
import { matchTemplate, fillTemplate, extractNameFromEmail } from './word';
import { getExpirationStatus, calculateDaysUntil, extractBaseCategory } from './expiration';

export async function checkExpirations(
  entries: CertificateEntry[],
  templates: Template[],
  options: {
    channels?: {
      email?: boolean;
    };
  } = {}
): Promise<CheckResult> {
  const channels = options.channels || { email: true };

  // ========================================================================
  // BUSINESS LOGIC: Only send emails for categories where ALL certificates are expired
  //
  // If a person has ANY valid certificate in a category, don't send notifications
  // for that category at all.
  //
  // Example: If Kevin has CONSENTIMIENTO - 2024 (expired), -2025 (expired), -2026 (valid)
  // NO notification should be sent because there's a valid 2026 certificate
  //
  // SPECIAL CASE: CONSENTIMIENTO/RENUNCIA either-or logic
  // - These two categories are treated as a pair
  // - If person has both categories:
  //   * If BOTH have all expired certificates: Send only the one with later date
  //   * If BOTH have all expired with SAME date: Send only CONSENTIMIENTO
  //   * If one has all expired and the other has a valid certificate: Send NOTHING for either
  // ========================================================================

  // Step 1: Check ALL entries for expiration
  const allEntriesWithStatus = entries.map(entry => ({
    entry,
    expirationStatus: getExpirationStatus(entry),
    daysUntil: calculateDaysUntil(entry.expirationDate),
  }));

  // Step 2: Group ALL certificates by person+base category
  const allGroups = new Map<string, typeof allEntriesWithStatus>();

  for (const item of allEntriesWithStatus) {
    const baseCategory = extractBaseCategory(item.entry.category);
    const groupKey = `${item.entry.dni}_${baseCategory}`;

    if (!allGroups.has(groupKey)) {
      allGroups.set(groupKey, []);
    }
    allGroups.get(groupKey)!.push(item);
  }

  // Step 3: Check which groups are fully expired
  const fullyExpiredGroups = new Map<string, CertificateEntry>(); // groupKey -> latest entry

  console.log(`[Scheduler] Checking ${allGroups.size} groups for expiration status`);
  for (const [groupKey, groupItems] of allGroups) {
    // Check if any certificate in this group is valid (not expired)
    const hasValidCertificate = groupItems.some(item => !item.expirationStatus.expired);

    if (!hasValidCertificate) {
      // ALL certificates in this group are expired - get the latest one
      const entryToNotify = groupItems.reduce((latest, current) =>
        current.entry.expirationDate > latest.entry.expirationDate ? current : latest
      );
      fullyExpiredGroups.set(groupKey, entryToNotify.entry);
      console.log(`[Scheduler] Fully expired group: ${groupKey} (${entryToNotify.entry.category})`);
    } else {
      console.log(`[Scheduler] Group has valid certificates: ${groupKey}`);
    }
  }
  console.log(`[Scheduler] Total fully expired groups: ${fullyExpiredGroups.size}`);

  // Step 4: Handle CONSENTIMIENTO/RENUNCIA either-or logic BEFORE building notification list
  const entriesToNotify: CertificateEntry[] = [];

  // Group fully expired groups by person (DNI)
  const personGroups = new Map<string, Map<string, CertificateEntry>>();

  for (const [groupKey, entry] of fullyExpiredGroups) {
    const dni = entry.dni || entry.email;
    if (!personGroups.has(dni)) {
      personGroups.set(dni, new Map());
    }
    personGroups.get(dni)!.set(groupKey, entry);
  }

  // For each person, check CONSENTIMIENTO/RENUNCIA special case
  console.log(`[Scheduler] Processing ${personGroups.size} persons with expired certificates`);
  for (const [dni, groups] of personGroups) {
    const consentimientoKey = `${dni}_CONSENTIMIENTO`;
    const renunciaKey = `${dni}_RENUNCIA`;

    const hasConsentimiento = groups.has(consentimientoKey);
    const hasRenuncia = groups.has(renunciaKey);

    console.log(`[Scheduler] Processing ${dni}: hasConsentimiento=${hasConsentimiento}, hasRenuncia=${hasRenuncia}, totalGroups=${groups.size}`);
    console.log(`[Scheduler] Groups for ${dni}:`, Array.from(groups.keys()));

    if (hasConsentimiento && hasRenuncia) {
      // Both CONSENTIMIENTO and RENUNCIA are fully expired
      const consentimientoEntry = groups.get(consentimientoKey)!;
      const renunciaEntry = groups.get(renunciaKey)!;

      // Compare expiration dates
      const consentimientoDate = consentimientoEntry.expirationDate.getTime();
      const renunciaDate = renunciaEntry.expirationDate.getTime();

      if (consentimientoDate > renunciaDate) {
        // CONSENTIMIENTO expired later - notify only CONSENTIMIENTO
        entriesToNotify.push(consentimientoEntry);
      } else if (renunciaDate > consentimientoDate) {
        // RENUNCIA expired later - notify only RENUNCIA
        entriesToNotify.push(renunciaEntry);
      } else {
        // Same expiration date - notify only CONSENTIMIENTO
        entriesToNotify.push(consentimientoEntry);
      }

      // Add all other groups for this person (not CONSENTIMIENTO or RENUNCIA)
      for (const [groupKey, entry] of groups) {
        if (groupKey !== consentimientoKey && groupKey !== renunciaKey) {
          entriesToNotify.push(entry);
        }
      }
    } else if (hasConsentimiento || hasRenuncia) {
      // Only one of them exists in fully expired groups
      // Check if the OTHER one exists at all (may have valid certificates)
      const otherCategory = hasConsentimiento ? 'RENUNCIA' : 'CONSENTIMIENTO';
      const otherKey = `${dni}_${otherCategory}`;

      // Check if the other category exists in allGroups AND has any valid certificates
      const otherCategoryExists = allGroups.has(otherKey);
      let otherCategoryHasValid = false;

      if (otherCategoryExists) {
        // Check if any certificate in the other category is valid
        const otherGroupItems = allGroups.get(otherKey)!;
        otherCategoryHasValid = otherGroupItems.some(item => !item.expirationStatus.expired);
      }

      if (otherCategoryExists && otherCategoryHasValid) {
        // The other category exists and has valid certificates
        // According to the rule: if one is not expired, send NOTHING for either
        // So we DON'T add this one to entriesToNotify
        console.log(`[Scheduler] Skipping ${hasConsentimiento ? 'CONSENTIMIENTO' : 'RENUNCIA'} for ${dni} because ${otherCategory} has valid certificates`);
      } else {
        // The other category doesn't exist at all OR is also fully expired
        // Safe to notify about this one
        const entry = groups.get(hasConsentimiento ? consentimientoKey : renunciaKey)!;
        entriesToNotify.push(entry);
        console.log(`[Scheduler] Adding ${hasConsentimiento ? 'CONSENTIMIENTO' : 'RENUNCIA'} for ${dni} (other category ${otherCategoryExists ? 'also expired' : 'does not exist'})`);
      }

      // Add all other groups for this person (not CONSENTIMIENTO or RENUNCIA)
      for (const [groupKey, entry] of groups) {
        if (groupKey !== consentimientoKey && groupKey !== renunciaKey) {
          entriesToNotify.push(entry);
          console.log(`[Scheduler] Adding other category: ${groupKey} (${entry.category})`);
        }
      }
    } else {
      // Neither CONSENTIMIENTO nor RENUNCIA - add all groups for this person
      console.log(`[Scheduler] No CONSENTIMIENTO/RENUNCIA for ${dni}, adding all ${groups.size} groups to notifications`);
      for (const [groupKey, entry] of groups) {
        console.log(`[Scheduler] Adding to notifications: ${groupKey} (${entry.category})`);
        entriesToNotify.push(entry);
      }
    }
  }

  // Step 5: Build results
  const result: CheckResult = {
    timestamp: new Date(),
    checked: entries.length,
    remindersSent: 0,
    results: [],
  };

  const remindersToSend: ReminderPayload[] = [];

  // Process entries to notify
  for (const entry of entriesToNotify) {
    const daysUntil = calculateDaysUntil(entry.expirationDate);
    const baseCategory = extractBaseCategory(entry.category);
    const expirationStatus = getExpirationStatus(entry);

    // Use base category for template matching
    const template = matchTemplate(templates, baseCategory);
    const name = (entry as any).name || extractNameFromEmail(entry.email);
    const dateStr = entry.expirationDate.toLocaleDateString('es-ES');

    if (!template) {
      console.log(`[Scheduler] Skipping ${entry.email} ${entry.category}: no matching Word template for ${baseCategory}`);
      result.results.push({
        email: entry.email,
        category: entry.category,
        expirationDate: entry.expirationDate.toISOString().split('T')[0],
        daysRemaining: daysUntil,
        status: 'skipped',
      });
      continue;
    }

    const html = fillTemplate(template, name, dateStr);
    const message = `${entry.email} ${entry.category} expired (${expirationStatus.reason})`;

    const payload: ReminderPayload = {
      email: entry.email,
      category: entry.category,
      expirationDate: entry.expirationDate.toISOString().split('T')[0],
      daysRemaining: daysUntil,
      message,
      html,
    };

    remindersToSend.push(payload);

    result.results.push({
      email: entry.email,
      category: entry.category,
      expirationDate: entry.expirationDate.toISOString().split('T')[0],
      daysRemaining: daysUntil,
      status: 'sent',
    });
  }

  // Add all other entries (both expired and valid) as "skipped"
  const handledKeys = new Set(entriesToNotify.map(e => `${e.dni}_${extractBaseCategory(e.category)}`));

  for (const { entry, daysUntil } of allEntriesWithStatus) {
    const baseCategory = extractBaseCategory(entry.category);
    const groupKey = `${entry.dni}_${baseCategory}`;

    // Skip if we already handled this group as sent or missing-template skipped.
    if (handledKeys.has(groupKey)) continue;

    result.results.push({
      email: entry.email,
      category: entry.category,
      expirationDate: entry.expirationDate.toISOString().split('T')[0],
      daysRemaining: daysUntil,
      status: 'skipped',
    });
  }

  if (remindersToSend.length === 0) {
    return result;
  }

  // Send Email notifications if enabled
  if (channels.email && remindersToSend.length > 0) {
    console.log(`[Scheduler] Sending ${remindersToSend.length} email notifications`);

    const { success, sent, failed, errors } = await sendEmailNotifications(
      remindersToSend
    );

    if (success) {
      console.log(`[Scheduler] All emails sent successfully: ${sent}`);
      (result as any).emailsSent = sent;
      result.remindersSent = sent;
    } else {
      console.error(`[Scheduler] Email errors: ${errors.join(', ')}`);
      (result as any).emailsSent = sent;
      (result as any).emailsFailed = failed;
      result.results = result.results.map((r) =>
        r.status === 'sent' ? { ...r, status: 'failed' as const } : r
      );
    }
  }

  return result;
}
