// Who may delete a manuscript, beyond admins: anyone named on it as a lead
// author or the lead data scientist. Manuscripts store people as free-text
// names (comma-separated for authors), so membership is a case-insensitive
// name match against the session user's full_name.

interface ManuscriptPeople {
  lead_authors?: string | null;
  lead_data_scientist?: string | null;
}

export function isNamedOnManuscript(
  fullName: string | null | undefined,
  manuscript: ManuscriptPeople
): boolean {
  const target = (fullName ?? '').trim().toLowerCase();
  if (!target) return false;
  return [manuscript.lead_authors, manuscript.lead_data_scientist]
    .flatMap((v) => String(v ?? '').split(','))
    .some((name) => name.trim().toLowerCase() === target);
}
