/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      email: string;
      full_name: string | null;
      institution: string | null;
      role: 'admin' | 'steering' | 'member';
      is_approved: boolean;
      created_at: string;
      updated_at: string;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;
  readonly GITHUB_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
