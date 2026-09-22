import { describe, it, expect } from 'vitest';
import { buildAffiliationRegistry, format, CLIF_CONSORTIUM_AUTHOR, type AuthorInput } from './format-byline';

const people: AuthorInput[] = [
  { id: 'a', full_name: 'Catherine A. Gao', degrees: 'MD', affiliation: 'Northwestern University' },
  { id: 'b', full_name: 'William F. Parker', degrees: 'MD, PhD', affiliation: 'University of Chicago' },
];
const registry = buildAffiliationRegistry(people);
const withGroup = [...people, CLIF_CONSORTIUM_AUTHOR];
const group = CLIF_CONSORTIUM_AUTHOR.full_name;

describe('group author (CLIF Consortium)', () => {
  it('is emitted verbatim as the last Vancouver author', () => {
    expect(format('vancouver', withGroup, registry).byline).toBe(
      `Catherine A. Gao¹, William F. Parker², and ${group}`
    );
  });

  it('gets no degrees or affiliation numbers in AMA', () => {
    expect(format('ama', withGroup, registry).byline).toBe(
      `Catherine A. Gao, MD¹; William F. Parker, MD, PhD²; ${group}`
    );
  });

  it('is not reduced to surname + initials in NLM', () => {
    expect(format('nlm', withGroup, registry).byline).toBe(`Gao CA¹, Parker WF², ${group}`);
  });

  it('adds nothing to the affiliation block', () => {
    expect(format('vancouver', withGroup, registry).affBlock).toBe(
      '1. Northwestern University\n2. University of Chicago'
    );
  });
});
