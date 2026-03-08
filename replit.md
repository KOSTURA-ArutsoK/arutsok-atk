# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for financial services and real estate. It focuses on client and partner management, precise commission calculations, and ensuring data integrity, auditability, and temporal validity. The platform aims to be a secure, leading solution for complex business relationships and financial transactions, with significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius
- Globálny Justified Layout: Všetky navigačné prvky, karty a menu zarovnané do bloku (vľavo aj vpravo). Flex-wrap, dynamické medzery, žiadny horizontálny scroll. TabsList: `flex flex-wrap h-auto gap-1 justify-between w-full`

## System Architecture
The system employs a modern full-stack architecture emphasizing data integrity, security, and auditability. It features immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through date fields and cron jobs. All entities use unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Local e-mail/password auth with bcrypt + express-session (PG session store). Multi-step login: (1) E-mail + Heslo, (2) Subject multiplicity detection — ak viac subjektov s rovnakým e-mailom, výberový overlay, (3) Phone verification — overenie/zmena telefónneho čísla s simulovaným SMS kódom, (4) Audit trail + Context overlay. No Replit OIDC dependency.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Implemented via immutable records, soft deletion, audit logs, field history, and document validity indicators.
- **Temporal Validity**: Managed using `validFrom`, `validTo`, `isActive` fields, and hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Simple admin/user model — `isAdmin()` checks for roles: admin, superadmin, architekt, prezident. Granular permissions controlled through `permission_groups`.
- **UI/UX & Interaction**: Includes a Holding Context Bubble (unified header selector with responsive grid overlay), dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API integration.
- **Security & Workflow**: Features a two-phase idle timeout with auto-logout, an archive module with password-protected restore, and a processing time protocol. IP locking for restricted users.
- **Context Security Policy (STRICT)**: Automatické bypassovanie kontextového overlay je ZAKÁZANÉ ak existuje viac ako 1 možnosť na akejkoľvek úrovni (štát/spoločnosť/divízia). Výnimka: Ak má používateľ práve 1 štát, 1 spoločnosť a 1 divíziu, systém automaticky aplikuje kontext bez overlay. Aj pri automatickom výbere sa vytvára auditná stopa cez `PUT /api/app-user/active`. Každý prístup k citlivým poliam musí zanechať nezmazateľnú auditnú stopu. Justified layout platí aj pre overlay prvky.
- **Navigation Structure**:
  - Štruktúra (collapsible): Štruktúra sektorov (A) → `/sektory-zmluv`, UI Subjektov (B) → `/sektory-subjektov`, Profil subjektu → `/profil-subjektu`
  - Moje úlohy → `/moje-ulohy` (with dynamic badge: red=non-calendar tasks, blue=only calendar events; auto-refresh 30s; shows 5 upcoming calendar events at bottom of page)
  - Odkazy - linky (dynamic, per-user per-division configurable link sections from `sidebar_link_sections` + `sidebar_links` tables with `divisionId`, managed via `/link-settings`; one fixed "Odkazy" section auto-created per division; collapsible groups; 0 links = kostura.sk fallback)
  - Zmluvy (collapsible): Zoznam zmlúv → `/contracts`, Spracovanie zmlúv (collapsible) → { Papierové zmluvy → `/evidencia-zmluv`, Dátová linka → `/datova-linka` }
  - Reporty (collapsible, admin only): Odosielanie → `/reporty-odosielanie`, Reporty pre NBS → `/reporty-nbs` (badge "Špecial")
  - Analytika → `/analytika` (admin only)
  - Holding Dashboard → `/holding-dashboard` (admin only)
- **Dátová linka (OCR Module)**: Azure AI Document Intelligence (Frankfurt, `germanywestcentral`) integration for document processing. Uses `prebuilt-layout` model with async `beginAnalyzeDocument`. Features: bulk PDF upload, background queue worker (10s interval), split-screen validation (original text vs extracted fields), synonym confirmation flow (green=confirmed, orange=learning, red=unknown). DB table: `ocr_processing_jobs`. Graceful SIGTERM handling marks processing jobs as "interrupted" for resume.
- **Subject Hierarchy**: `parentSubjectId` on subjects enables parent-child tree. Master Root ID: `421 000 000 000 000` (SK). CZ root (420) deactivated.
- **Sensitive Field Audit**: Every access to subject detail (birthNumber, idCardNumber, iban, email, phone) creates an audit log entry with action `sensitive_field_access`.
- **Global Field Versioning**: All field changes on subjects and contracts are automatically diffed and recorded in `subject_field_history` / `contract_parameter_value_history`.
- **DB Status Endpoint**: `GET /api/system/db-status` returns real connection info (host from DATABASE_URL, status connected/disconnected).
- **Dynamic Parameter System (EAV Architecture)**: A 6-level hierarchy (Sektory → Sekcie → Produkty → Priečinky → Panely → Parametre) allows dynamic configuration of contract fields and form generation, supported by AI synonym mapping.
- **AI Synonym Mapping**: `parameter_synonyms` table with `CONFIRMATION_THRESHOLD = 5` — synonyms require 5 confirmations before becoming active.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity and supports various calculation types with logging.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking mechanisms and status workflows.
- **Client Management**: Features multi-step registration, granular ownership, Bonita Point System, risk linking, and an AML module.
- **Universal Guardian Access Hierarchy**: Manages legal guardians for individuals and organizations, with ward management and enhanced maturity alerts.
- **Foolproof System (`Blbuvzdornosť`)**: Implements `data_conflict_alerts`, `transaction_dedup_log`, Zod validation, and subject-level authorization.
- **GDPR & Privacy System**: Provides comprehensive privacy controls, household management, privacy blocks, and access consent logging.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with 40 `relation_role_types`, temporal validity, and context-aware relations.
- **First Contract Rule (`Pravidlo Prvej Zmluvy`)**: Automatically identifies and flags the first contract for an agent within a division, with commission redirection logic and visual indicators.
- **Partner & Product Lifecycle (Media-Player System)**: A 6-state lifecycle for `partners` and `sector_products` with top-down inheritance and cron-driven auto-transitions.
- **90-Day Date Semaphore**: A utility that highlights expired dates in red and upcoming dates (≤90 days) in orange for contract expiry and key subject date fields.
- **Contract Parameter Versioning (`Stroj času`)**: Tracks all changes to contract parameter values, allowing history viewing and restoration.
- **Holding Structure**: A unified ID system with dynamic country prefixes, extended `states` table, and `divisions` table for holding divisions, each with an `emoji` for visual identification. Both `myCompanies` and `divisions` have `foundedDate` (timestamp, nullable) for tracking founding/creation dates. NBS Analytics Chart uses these dates as dynamic lower year limit via `/api/nbs-chart-year-bounds` endpoint.
- **Context Selector Overlay**: Full-screen blurred backdrop (no popup box) on all 3 steps. State: circular flags with sky-blue ring borders, centered row. Company: back arrow+text top-left, state flag centered, logos in rounded-xl squares. Division: back arrow+text top-left, emoji in rounded-xl squares. No X button, no "Všetky divízie". Backdrop click closes.
- **Dashboard & Analytics**: Customizable overview with drag-and-drop widgets, KPI cards, dynamic filters, charts, and PDF summaries. Holding Dashboard for admin-only analytics with cross-sell and division performance heatmaps.

- **Global Date/Time Format**: Strict `DD.MM.RRRR HH:mm:ss` everywhere (UI, DB, Logs, PDF). Server: `formatDateTimeSK()`, Frontend: `formatDateTimeSlovak()`. File naming: `RRRRMMDD_HHmmss` via `formatTimestampForFile()`. OCR dates auto-normalized via `normalizeExtractedDate()`.
- **PDF QR Codes**: All server-generated PDFs include QR code (top-right corner) linking to subject URL + timestamp. Uses `qrcode` package. Client-side PDFs use `DD.MM.RRRR HH:mm:ss` timestamps.
- **OCR Duplicate Guard**: Max 5 identical extracted values without manual approval (`OCR_DUPLICATE_LIMIT = 5`). Duplicates flagged with `duplicateWarning: true` and `DUPLIKÁT` badge in UI.
- **Network Module (Financie > Sieť)**: ATK spider web anchored under root `421 000 000 000 000`. Tables: `network_links` (subject↔guarantor with linkType: active/frozen/historical, phase: klient/tiper/specialist), `guarantor_transfer_requests` (prestupový protokol with 4-step approval). Career conversion freezes non-chosen guarantors.
- **Prestupový protokol — 4-stupňové schvaľovanie**: Transfer requests follow a 4-step approval chain: Žiadateľ → Prijímajúci garant → Odchádzajúci garant → Admin. Each step is timestamped. After final admin approval, a PDF protocol is auto-generated with QR code, watermark, and audit code. Status: `pending_all_approvals` | `approved` | `rejected`. Endpoints: `PATCH /api/network/transfer-requests/:id/approve`, `PATCH /api/network/transfer-requests/:id/reject`, `GET /api/network/transfer-requests/:id/pdf`.
- **Moje úlohy module**: `GET /api/my-tasks` returns pending approval tasks for the current user (based on `linkedSubjectId` matching to guarantor subjects, or admin role for step 4). `GET /api/my-tasks/count` returns count for sidebar badge. Route: `/moje-ulohy`. Red badge in sidebar shows pending task count, auto-refreshes every 30s.
- **Status Notification Templates**: `contractStatuses` table has `notifyEnabled`, `notifyChannel` (email/sms/both), `notifySubject`, `notifyTemplate` columns. UI: "Notifikacie" tab in status edit dialog with switch, channel selector, subject field, and two-section smart tag bar: **Systémové** (outline, `{{contract_number}}`, `{{client_name}}`, `{{valid_until}}`) + **Moje zo stavu** (secondary, dynamic `{{param_NAZOV}}` from `contract_status_parameters`). On status change, `replaceSmartTags()` replaces system tags with contract data and `{{param_*}}` tags with values from `parsedParams` (status change form). No cross-contract data loading. Inserts into `system_notifications` with `notificationType: "status_change_email"` or `"status_change_sms"`.
- **Reports module categories**: Uses `klienti`/`zmluvy`/`system` (NOT old A/B/C module badges). Reporty > Odosielanie shows SMS/Email split with separate KPI cards, channel filter, chart bars, and "Kanal" column in failed notifications table.
- **Contract Processing Workflow (Phases 5→10)**: Complete workflow in `/evidencia-zmluv` module. Phase 5 (Prijaté do centrály): checkbox + bulk "Presunúť do spracovania" → phase 6. Phase 6 (Kontrakt v spracovaní): checkbox + "Vytvoriť súpisku" → creates processing súpiska + moves to phase 8. Phase 7 (Interné intervencie): checkbox + "Vrátiť do spracovania" → phase 6. Phase 8 (Pripravené na odoslanie): grouped by súpisky, dispatch dialog (method: osobne/poštou/elektronicky + datetime) → phase 9. Phase 9 (Odoslané obch. partnerovi): grouped by súpisky, receive dialog (datetime) → phase 10. Phase 10 (Prijaté obch. partnerom): checkbox + "Dokončiť spracovanie" → phase 0 (exits workflow). DB: `supisky` table extended with `supiskaType`, `dispatchMethod`, `dispatchedAt`, `receivedByPartnerAt`. Endpoints: `POST /api/contracts/create-processing-supiska`, `POST /api/supisky/:id/dispatch`, `POST /api/supisky/:id/receive`, `GET /api/supisky/by-phase/:phase`. Server-side phase validation enforced on all transitions.

## Important Technical Notes
- **subjects table**: uses `deletedAt` (timestamp, nullable) NOT `isDeleted` boolean — always filter with `isNull(subjects.deletedAt)`
- **appUsers**: has NO `isActive` column — access controlled via role only
- **Sidebar**: Static menu items only — NEVER dynamic inventory lists
- **Security**: Simple role-based (`isAdmin()`, `isArchitekt()`, `hasAdminAccess()`) — no Sentinel pyramid levels. Security level in Users simplified to 3 levels: Štandardná/Rozšírená/Plná
- **Reports module categories**: Uses `klienti`/`zmluvy`/`system` (NOT old A/B/C module badges)

## External Dependencies
- **bcryptjs**: Password hashing for local authentication.
- **PostgreSQL (Neon)**: Primary database.
- **Drizzle ORM**: Object-Relational Mapper.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web application framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **wouter**: React routing library.
- **Tiptap**: Headless editor framework.
- **Multer**: For handling `multipart/form-data`.
- **ExcelJS**: For XLSX, CSV, and JSON file manipulation.
- **Sharp**: High-performance Node.js image processing.
- **jsPDF**: Client-side PDF generation.
- **pdfkit**: Server-side PDF generation.
- **qrcode**: QR code generation for PDF documents.
- **@azure/ai-form-recognizer**: Azure AI Document Intelligence SDK for OCR.
