import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_META, isRole } from './roles';

describe('roles', () => {
  it('has a ROLE_META entry (with a route segment) for every role in ROLES', () => {
    for (const role of ROLES) {
      expect(ROLE_META[role]).toBeDefined();
      expect(ROLE_META[role].routeSegment).toBeTruthy();
      expect(ROLE_META[role].label).toBeTruthy();
    }
  });

  it('isRole accepts every known role and rejects everything else', () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
    expect(isRole('technician')).toBe(false); // removed role — must stay rejected
    expect(isRole('hospital_admin')).toBe(false); // display label, not the wire value
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole('')).toBe(false);
  });

  it('keeps admin as the wire value for the hospital-scoped admin role', () => {
    // Regression guard for the admin/hospital_admin role-string mismatch
    // fixed in migration 0009 — the DB, backend, and frontend must all
    // agree on 'admin' as the actual stored/wire value.
    expect(ROLES).toContain('admin');
    expect(ROLE_META.admin.label).toBe('Hospital Admin');
  });
});
