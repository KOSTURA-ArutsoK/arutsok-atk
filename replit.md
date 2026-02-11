# ArutsoK CRM v1.0

## Overview
Multi-tenant CRM and commission tracking system for financial services, real estate, and defense/weapons trade. Built with Express + Vite + React + Drizzle ORM + PostgreSQL.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon)
- **Auth**: Replit OIDC Auth (separate `users` table for auth, `app_users` for CRM)
- **Port**: Frontend + Backend served on port 5000
- **File Storage**: Multer uploads to local disk (`uploads/official/` and `uploads/work/`), metadata stored in DB as JSONB

## Key Design Decisions
- **Two user tables**: `users` (Replit Auth, varchar IDs) and `app_users` (CRM users, serial IDs with roles/permissions)
- **Data Integrity**: No overwriting - all updates archive original records first
- **12-digit UID**: Format `CC-FF-SSS-NNN NNN NNN` (continent-company-state-random)
- **WAME Timer**: `performance.now()` tracks form editing duration, stored as `processingTimeSec`
- **Soft Delete**: Companies use `isDeleted` flag, archived before deletion
- **Slovak Language**: All UI labels in Slovak
- **Rich Text Notes**: Tiptap editor for company notes, stored as HTML in `notes` field
- **Dual Document System**: Section A (official docs) + Section B (work docs) per company, files on disk with DB metadata
- **Auth on all routes**: All company CRUD and file management routes require `isAuthenticated` middleware

## File Structure
- `shared/schema.ts` - Database schema (Drizzle tables + Zod schemas + types)
- `shared/routes.ts` - API route definitions with Zod validation
- `shared/models/auth.ts` - Replit Auth user/session tables (DO NOT MODIFY)
- `server/routes.ts` - Express route handlers (incl. file upload/download/delete)
- `server/storage.ts` - Database storage layer (IStorage interface)
- `server/replit_integrations/auth/` - Replit Auth integration (DO NOT MODIFY)
- `client/src/App.tsx` - Router with PrivateRoute wrapper
- `client/src/components/layout/AppShell.tsx` - Sidebar + header layout
- `client/src/components/rich-text-editor.tsx` - Tiptap-based rich text editor
- `client/src/components/app-sidebar.tsx` - Shadcn sidebar navigation
- `client/src/pages/` - Dashboard, Companies, Subjects, Auth
- `client/src/hooks/` - use-auth, use-app-user, use-companies, use-hierarchy, use-subjects
- `uploads/` - File storage (official/ and work/ subdirectories)

## Database Tables
- `continents`, `states` - Global hierarchy
- `my_companies`, `company_archive` - Companies with archival (officialDocs/workDocs as JSONB)
- `subjects`, `subject_archive` - Subjects with UID and archival
- `partners`, `contacts` - Partner management
- `products`, `commission_schemes` - Product/commission tracking
- `app_users` - CRM users with roles, security levels, admin codes
- `users`, `sessions` - Replit Auth (managed by integration)

## Companies CRUD Features
- **4-tab form**: Zakladne udaje, Adresa, Dokumenty, Poznamky
- **Fields**: name, specialization, code, ICO, DIC, IC DPH, street, streetNumber, orientNumber, postalCode, city, stateId, description, notes
- **File upload**: POST /api/my-companies/:id/files/:section (multipart/form-data)
- **File download**: GET /api/files/:section/:filename
- **File delete**: DELETE /api/my-companies/:id/files/:section (body: {fileUrl})
- **Company detail view**: Read-only 4-tab dialog with all data + document download

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs Drizzle schema to database

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## Recent Changes (2026-02-11)
- Enhanced Companies CRUD with strict validation (ICO, DIC, IC DPH, full address, description required)
- Implemented soft delete with Audit Trail (tracking user, time, and IP)
- Added Admin/SuperAdmin role protection for company creation
- Added support for logo management (schema fields: logos, primary, archive)
- Dialog uses live query data for document list refresh after uploads
