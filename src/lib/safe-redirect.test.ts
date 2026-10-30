import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('accepts same-site paths with query strings', () => {
    expect(safeRedirectPath('/portal/los-requests?request=abc')).toBe('/portal/los-requests?request=abc');
    expect(safeRedirectPath('/portal')).toBe('/portal');
  });

  it('rejects anything that could leave the site', () => {
    expect(safeRedirectPath('https://evil.example')).toBeNull();
    expect(safeRedirectPath('//evil.example/portal')).toBeNull();
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(safeRedirectPath('/portal\r\nSet-Cookie: x=y')).toBeNull();
  });

  it('rejects empty, missing, and auth-loop targets', () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath('   ')).toBeNull();
    expect(safeRedirectPath('/auth/login')).toBeNull();
    expect(safeRedirectPath('/api/auth/google')).toBeNull();
  });
});
