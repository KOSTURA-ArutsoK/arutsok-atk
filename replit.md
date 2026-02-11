# ArutsoK CRM v1.0

## Overview
Multi-tenant CRM and commission tracking system for financial services, real estate, and defense/weapons trade. Built with Express + Vite + React + Drizzle ORM + PostgreSQL.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon)
- **Auth**: Replit OIDC Auth (separate `users` table for auth, `app_users` for CRM)
- **Port**: Frontend + Backend served on port 5000
- **File Storage**: Multer uploads to local disk (`uploads/official/`, `uploads/work/`, `uploads/logos/`), metadata stored in DB as JSONB

## Key Design Decisions
- **Two user tables**: `users` (Replit Auth, varchar IDs) and `app_users` (CRM users, serial IDs with roles/permissions)
- **Data Integrity**: No overwriting - all updates archive original records first
- **12-digit UID**: Format `01-CC-SSS-NNN NNN NNN NNN` (planet-continent-stateDialCode-12digitSequence with spaces)
- **Atomic UID Generator**: Uses `global_counters` table with atomic SQL increment
- **WAME Timer**: `performance.now()` tracks form editing duration, stored as `processingTimeSec`
- **Soft Delete**: Companies and Partners use `isDeleted` flag with audit trail (deletedBy, deletedAt, deletedFromIp)
- **Slovak Language**: All UI labels in Slovak
- **Rich Text Notes**: Tiptap editor for company/partner notes, stored as HTML in `notes` field
- **Dual Document System**: Section A (official docs) + Section B (work docs) per company, files on disk with DB metadata
- **Logo Management**: JSONB array with isPrimary/isArchived flags; new primary auto-archives old
- **Auth on all routes**: All CRUD and file management routes require `isAuthenticated` middleware
- **Context Switching**: State Switcher (left, +421 Slovensko format) and Company Switcher (right) in navbar, persisted via activeStateId/activeCompanyId in app_users

## File Structure
- `shared/schema.ts` - Database schema (Drizzle tables + Zod schemas + types)
- `shared/routes.ts` - API route definitions with Zod validation
- `shared/models/auth.ts` - Replit Auth user/session tables (DO NOT MODIFY)
- `server/routes.ts` - Express route handlers (incl. file upload/download/delete, partners CRUD)
- `server/storage.ts` - Database storage layer (IStorage interface with UID generator)
- `server/replit_integrations/auth/` - Replit Auth integration (DO NOT MODIFY)
- `client/src/App.tsx` - Router with PrivateRoute wrapper
- `client/src/components/layout/AppShell.tsx` - Sidebar + header with State/Company switchers
- `client/src/components/rich-text-editor.tsx` - Tiptap-based rich text editor
- `client/src/components/app-sidebar.tsx` - Shadcn sidebar navigation
- `client/src/pages/` - Dashboard, Companies, Partners, Subjects, Auth
- `client/src/hooks/` - use-auth, use-app-user, use-companies, use-hierarchy, use-subjects, use-partners
- `uploads/` - File storage (official/, work/, logos/ subdirectories)

## Database Tables
- `global_counters` - Atomic sequence for UID generation
- `continents`, `states` - Global hierarchy (states use international dial codes: 421, 420, 001)
- `my_companies`, `company_archive` - Companies with archival (officialDocs/workDocs/logos as JSONB)
- `company_officers` - Konatelia/vlastnici per company (person or company owners)
- `partners` - External business partners with UID, soft delete, audit trail
- `partner_contracts` - Links partners to companies via contracts
- `partner_contacts` - External contacts per partner with security levels (1-4)
- `partner_products` - Product catalog per partner
- `contact_product_assignments` - Maps contacts to products (or allProducts boolean)
- `communication_matrix` - Partner-Company-Contact-Subject relationship mapping
- `subjects`, `subject_archive` - Subjects with UID and archival
- `contacts` - Legacy contacts (backward compat)
- `products`, `commission_schemes` - Product/commission tracking
- `app_users` - CRM users with roles, security levels, admin codes, active context
- `users`, `sessions` - Replit Auth (managed by integration)

## Companies CRUD Features
- **4-tab form**: Zakladne udaje, Adresa, Dokumenty, Poznamky
- **Fields**: name, specialization, code, ICO, DIC, IC DPH, street, streetNumber, orientNumber, postalCode, city, stateId, description, notes, businessActivities, logos
- **File upload**: POST /api/my-companies/:id/files/:section (multipart/form-data, section: official|work|logos)
- **File download**: GET /api/files/:section/:filename
- **File delete**: DELETE /api/my-companies/:id/files/:section (body: {fileUrl})
- **Logo set primary**: PUT /api/my-companies/:id/logos/set-primary
- **Company detail view**: Read-only 4-tab dialog with all data + document download

## Partners CRUD Features
- **Create/Edit dialog**: Name, code, rich text notes
- **Detail view with 5 tabs**: Info, Zmluvy (contracts), Kontakty (contacts), Produkty (products), Poznamky (notes)
- **Inline add forms**: Add contracts (link to company), contacts (name/email/phone/position), products (name/type/code)
- **Soft delete with audit trail**: deletedBy, deletedAt, deletedFromIp
- **UID auto-generation**: Atomic 12-digit UID assigned on creation

## API Endpoints
- `/api/app-user/me` - GET current app user
- `/api/app-user/active` - PUT set active state/company (Zod validated, only updates provided fields)
- `/api/hierarchy/continents` - GET continents
- `/api/hierarchy/states` - GET/POST states
- `/api/my-companies` - GET/POST companies
- `/api/my-companies/:id` - GET/PUT/DELETE company
- `/api/my-companies/:companyId/officers` - GET/POST officers
- `/api/my-companies/:companyId/files/:section` - POST upload, DELETE file
- `/api/my-companies/:companyId/logos/set-primary` - PUT set primary logo
- `/api/partners` - GET/POST partners
- `/api/partners/:id` - GET/PUT/DELETE partner
- `/api/partners/:partnerId/contracts` - GET/POST contracts
- `/api/partners/:partnerId/contacts` - GET/POST contacts
- `/api/partners/:partnerId/products` - GET/POST products
- `/api/partners/:partnerId/matrix` - GET/POST communication matrix
- `/api/partner-contacts/:id` - PUT/DELETE contact
- `/api/partner-contacts/:contactId/products` - GET/PUT product assignments
- `/api/subjects` - GET/POST subjects
- `/api/subjects/:id` - GET/PUT subject

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs Drizzle schema to database

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## Temporal Validity System
- **Validity Period**: companyOfficers, partnerContacts, companyContacts tables have `validFrom` (defaults NOW()), `validTo` (nullable = indefinite), and `isActive` fields
- **Auto-Archive**: Hourly cron job (setInterval 1hr) marks expired bindings (validTo <= now) as `isActive=false`
- **Contact Swap**: PUT `/api/partner-contacts/:id/swap` auto-terminates old contact (sets validTo=today), creates new contact with product assignments
- **Career History**: GET `/api/subjects/:id/career-history` aggregates all role assignments from companyOfficers, partnerContacts, companyContacts sorted by validFrom desc
- **UI Pattern**: Active contacts shown by default, archived contacts in collapsible section with toggle button showing count
- **Date Format**: Slovak locale (sk-SK), validity ranges shown as "Od: DD.MM.YYYY → Do: DD.MM.YYYY" or "Neurcito"/"Sucasnost"
- **Schema Changes**: Applied via direct SQL ALTER TABLE (drizzle-kit interactive prompt blocking automation)

## Recent Changes (2026-02-11)
- Added global_counters table for atomic UID generation
- Expanded schema: company_officers, partner_contracts, partner_contacts, partner_products, contact_product_assignments, communication_matrix
- Implemented full Partners module (CRUD + detail dialog with contracts/contacts/products tabs)
- Enhanced AppShell navbar with State Switcher (+code name format) and Company Switcher dropdowns
- Fixed context switching to only update provided fields (prevents clearing other active context)
- Added Zod validation to setActive endpoint
- Enhanced Companies CRUD with strict validation (ICO, DIC, IC DPH, full address, description required)
- Implemented soft delete with Audit Trail (tracking user, time, and IP) for both companies and partners
- Added Admin/SuperAdmin role protection for company creation
- Added support for logo management (schema fields: logos, primary, archive)
- Dialog uses live query data for document list refresh after uploads
- Added validFrom/validTo/isActive to companyOfficers, partnerContacts, companyContacts
- Implemented hourly auto-archive cron job for expired temporal bindings
- Added contact swap endpoint with automatic old contact termination
- Built subject career history API aggregating all role assignments chronologically
- Enhanced partner contacts UI with active/archived sections, validity date display, and date inputs for new contacts
- Added SubjectDetailDialog with "Historia kariery v systeme" timeline visualization
- Added eye/view button on Subjects table for opening detail dialog
