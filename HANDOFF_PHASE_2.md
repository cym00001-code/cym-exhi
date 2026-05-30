# Phase 2 Working Notes

Date: 2026-05-30
Workspace: `C:\Users\Administrator\OneDrive\Desktop\编程项目\一鸣的展`

## Current Direction

Curator Studio is no longer a local-only placeholder. It is now designed as a cloud-hosted, authenticated private console:

- Studio page: `/curator-studio`
- Protected API: `/api/curator-studio`
- Public exhibition remains static Astro output.
- Studio API runs behind PM2 on `127.0.0.1:3000`.
- Nginx serves static `current` and proxies only the Studio API.

## Safety Rules

- Never add Studio to public navigation.
- Keep `/studio` blocked or absent.
- Keep secrets in `.env`, never in Git.
- Save operations create `.studio-backups/`.
- Production saves should rebuild and publish a new static release.

## Content Notes

The six foundational halls are:

1. `city`
2. `travel`
3. `campus`
4. `still-life`
5. `daily-notes`
6. `experiments`

`campus-theatre` was intentionally replaced by `campus`. Theatre/stage can be a future exhibition topic under Campus, but not the hall definition.

## Next Maintenance Reminders

- If Studio login fails on the server, check `.env` for `STUDIO_PASSWORD_HASH` and `STUDIO_SESSION_SECRET`.
- If content saves but the public page does not change, check PM2 logs for the `pnpm build` and release publish step.
- If server build fails, confirm the server Node version satisfies the Astro engine requirement.
- Do not remove `data/`, `releases/`, `.env`, or `.studio-backups/` during deployment.
