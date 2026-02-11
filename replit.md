# ArutsoK CRM v1.0

## Overview
Multi-tenant CRM and commission tracking system for financial services, real estate, and defense/weapons trade. Built with Express + Vite + React + Drizzle ORM + PostgreSQL.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon)
- **Auth**: Replit OIDC Auth (separate `users` table for auth, `app_users` for CRM)
- **Port**: Frontend + Backend served on port 5000

## Key Design Decisions
- **Two user tables**: `users` (Replit Auth, varchar IDs) and `app_users` (CRM users, serial IDs with roles/permissions)
- **Data Integrity**: No overwriting - all updates archive original records first
- **12-digit UID**: Format `CC-FF-SSS-NNN NNN NNN` (continent-company-state-random)
- **WAME Timer**: `performance.now()` tracks form editing duration, stored as `processingTimeSec`
- **Soft Delete**: Companies use `isDeleted` flag, archived before deletion
- **Slovak Language**: All UI labels in Slovak

## File Structure
- `shared/schema.ts` - Database schema (Drizzle tables + Zod schemas + types)
- `shared/routes.ts` - API route definitions with Zod validation
- `shared/models/auth.ts` - Replit Auth user/session tables (DO NOT MODIFY)
- `server/routes.ts` - Express route handlers
- `server/storage.ts` - Database storage layer (IStorage interface)
- `server/replit_integrations/auth/` - Replit Auth integration (DO NOT MODIFY)
- `client/src/App.tsx` - Router with PrivateRoute wrapper
- `client/src/components/layout/AppShell.tsx` - Sidebar + header layout
- `client/src/pages/` - Dashboard, Companies, Subjects, Auth
- `client/src/hooks/` - use-auth, use-app-user, use-companies, use-hierarchy, use-subjects

## Database Tables
- `continents`, `states` - Global hierarchy
- `my_companies`, `company_archive` - Companies with archival
- `subjects`, `subject_archive` - Subjects with UID and archival
- `partners`, `contacts` - Partner management
- `products`, `commission_schemes` - Product/commission tracking
- `app_users` - CRM users with roles, security levels, admin codes
- `users`, `sessions` - Replit Auth (managed by integration)

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs Drizzle schema to database

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius
