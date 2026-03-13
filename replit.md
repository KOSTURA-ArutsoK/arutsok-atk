# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for financial services and real estate sectors. Its core purpose is to manage client and partner relationships, accurately calculate commissions, and ensure high standards of data integrity, auditability, and temporal validity. The project aims to become a leading, secure platform for complex business relationships and financial transactions, holding significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius
- Globálny Justified Layout: Všetky navigačné prvky, karty a menu zarovnané do bloku (vľavo aj vpravo). Flex-wrap, dynamické medzery, žiadny horizontálny scroll. TabsList: `flex flex-wrap h-auto gap-1 justify-between w-full`

## System Architecture
The system utilizes a modern full-stack architecture built for data integrity, security, and auditability. Key features include immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through date fields and cron jobs. All entities are identified by unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Local e-mail/password with bcrypt and express-session (PG session store). Features a multi-step login process including subject multiplicity detection and phone verification.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Achieved through immutable records, soft deletion, audit logs, field history, and document validity indicators.
- **Temporal Validity**: Implemented using `validFrom`, `validTo`, `isActive` fields, complemented by hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Supports admin/user roles with specific checks (`isAdmin()`) and granular permissions via `permission_groups`.
- **UI/UX & Interaction**: Includes a Holding Context Bubble, dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API integration.
- **Security & Workflow**: Features a two-phase idle timeout with auto-logout, an archive module with password-protected restore, a processing time protocol, IP locking for restricted users, login rate limiting (express-rate-limit, 5 attempts/15 min on all login endpoints), file upload type validation (extension+MIME whitelist), XSS sanitization (DOMPurify), and SameSite=strict session cookies.
- **Context Security Policy (STRICT)**: Prevents automatic bypass of context overlay if multiple options exist. Requires explicit user selection with audit trail for sensitive field access.
- **Navigation Structure**: Organized into collapsible sections for `Štruktúra` (Sectors, Subjects, Subject Profile), `Moje úlohy`, dynamic `Odkazy` (Links), `Zmluvy` (Contracts, Processing), `Reporty`, `Analytika`, and `Holding Dashboard`.
- **Dátová linka (OCR Module)**: Integrates Azure AI Document Intelligence for document processing. Supports bulk PDF upload, background processing, split-screen validation, and synonym confirmation.
- **Subject Hierarchy**: Supports parent-child relationships via `parentSubjectId`.
- **Sensitive Field Audit**: Logs all access to sensitive fields like birth number, ID card number, IBAN, email, and phone.
- **Global Field Versioning**: Automatically tracks and records all field changes for subjects and contracts.
- **Dynamic Parameter System (EAV Architecture)**: A 6-level hierarchy enabling dynamic configuration of contract fields and form generation, supported by AI synonym mapping.
- **AI Synonym Mapping**: Requires multiple confirmations for synonyms to become active.
- **Commission Brain & Calculation Engine**: Manages commission rates with temporal validity and various calculation types with logging.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking and status workflows.
- **Client Management**: Features multi-step registration, granular ownership, a Bonita Point System, risk linking, and an AML module.
- **Universal Guardian Access Hierarchy**: Manages legal guardians for individuals and organizations.
- **Foolproof System (`Blbuvzdornosť`)**: Incorporates data conflict alerts, transaction deduplication, Zod validation, subject-level authorization, and Slovak birth number (RČ) validation (MOD11 + date + gender).
- **Birth Number (RČ) Validation**: Global `validateSlovakRC()` in `shared/rc-validator.ts` — MOD11, date existence, gender detection (+50/+20/+70 offsets), 9-digit pre-1954 support. Used in: import endpoint (critical error), Subject registration dialog (on-the-fly), SZČO FO field (onBlur), Register page (onBlur), and subject save validation.
- **IČO Validation + Multi-Registry Lookup**: Global `validateSlovakICO()` in `shared/ico-validator.ts` — weighted checksum (weights 8→2), MOD11, auto-padding to 8 digits. Lookup endpoint (`GET /api/lookup/ico/:ico?type=szco|company`) cascades through SK/CZ registries: ORSR (Obchodný register SR, web scraping with cheerio+iconv-lite), ZRSR (Živnostenský register SR, Altcha PoW CAPTCHA solver), ARES (Czech registry, REST API). Module: `server/sk-registry-lookup.ts`. Priority order depends on `type` param (szco→ZRSR first, company→ORSR first). Frontend banner dynamically shows source name. Used in: import endpoint (icoCritical flag), Subject registration dialog (on-the-fly + banner), SZČO firm section (onBlur + "Použiť údaje" button), backend subject create/update (HTTP 400), and DynamicFieldInput (onBlur).
- **GDPR & Privacy System**: Provides privacy controls, household management, privacy blocks, and access consent logging.
- **Global Subject Relations System**: Enables universal cross-entity linking with temporal validity and context-aware relations.
- **First Contract Rule (`Pravidlo Prvej Zmluvy`)**: Identifies and flags the first contract for an agent within a division, influencing commission redirection and visual indicators.
- **Partner & Product Lifecycle (Media-Player System)**: A 6-state lifecycle for partners and sector products with inheritance and cron-driven auto-transitions.
- **90-Day Date Semaphore**: Highlights expired and upcoming dates (≤90 days) for contracts and key subject fields.
- **Contract Parameter Versioning (`Stroj času`)**: Tracks and allows restoration of contract parameter value changes.
- **Holding Structure**: Unified ID system with dynamic country prefixes, extended states, and divisions table, each with an emoji.
- **Context Selector Overlay**: Full-screen blurred backdrop for state, company, and division selection, without an "X" button or "Všetky divízie".
- **Dashboard & Analytics**: Customizable overview with drag-and-drop widgets, KPI cards, dynamic filters, charts, and PDF summaries. Includes an admin-only Holding Dashboard.
- **Global Date/Time Format**: Strict `DD.MM.RRRR HH:mm:ss` format across UI, DB, and logs. File naming uses `RRRRMMDD_HHmmss`.
- **PDF QR Codes**: All server-generated PDFs include a QR code linking to the subject URL and timestamp.
- **OCR Duplicate Guard**: Flags duplicate extracted values to prevent unapproved entries.
- **Network Module (Financie > Sieť)**: Manages network links (subject↔guarantor) and a 4-step approval process for guarantor transfer requests (`Prestupový protokol`).
- **Moje úlohy module**: Displays pending approval tasks for the current user, with a dynamic sidebar badge for notification.
- **Status Notification Templates**: Configurable email/SMS notifications based on contract status changes, using smart tags for dynamic content.
- **Contract Status System (Simplified)**: System statuses (isSystem) removed. Only user-defined (custom) statuses and lifecycle phases (1-10) remain. Contract `statusId` is nullable. Lifecycle phases are configured via `/api/lifecycle-phase-configs`. On the ContractStatuses page, statuses are in 3 mutually exclusive sections: Systémové stavy (lifecycle fázy 1-10), Voliteľné stavy (!definesContractEnd), Stavy ukončujúce kontrakt (definesContractEnd). Each status appears in exactly one section. UI shows single "Stav zmluvy" everywhere (no duplicate "Aktuálny stav").
- **Contract Processing Workflow (Phases 5→10)**: A comprehensive workflow in the `/evidencia-zmluv` module for processing contracts, including creating processing `súpisky` and managing dispatch/receipt.
- **Business Opportunities Module**: Multi-record system for managing business opportunities (`business_opportunities` table). Records use `divisionIds` (integer array) for multi-division assignment: empty array `[]` = all divisions, non-empty array = specific divisions only. Admin settings page (`/nastavenie-obchodnych-prilezitosti`) supports CRUD with multi-checkbox division selector. Display page (`/obchodne-prilezitosti`) shows list/detail views. Sidebar dynamically lists opportunities as collapsible sub-items under "Obchodné príležitosti".
- **Registry Snapshots (Vzorová pravda)**: Immutable timestamped snapshots of external registry data (ORSR, ZRSR, ARES) stored per subject in `registry_snapshots` table. Auto-saved when IČO lookup succeeds with `subjectId` param. Manual refresh via "Registre" tab in subject detail (visible for SZČO/PO/company types). Each snapshot stores `parsedFields` (name, address, legalForm, DIČ, directors) and `rawData` (full API response). Serves as "ground truth" for AI contract audit and synonym learning. Endpoints: `GET /api/subjects/:id/registry-snapshots`, `POST /api/subjects/:id/registry-snapshots/refresh`.

## External Dependencies
- **bcryptjs**: Password hashing.
- **PostgreSQL (Neon)**: Database.
- **Drizzle ORM**: Database interaction.
- **Vite**: Frontend build.
- **Express.js**: Backend framework.
- **Tailwind CSS**: Styling.
- **shadcn/ui**: UI components.
- **wouter**: Frontend routing.
- **Tiptap**: Rich text editor.
- **Multer**: File uploads (`multipart/form-data`).
- **ExcelJS**: XLSX, CSV, JSON manipulation.
- **Sharp**: Image processing.
- **jsPDF**: Client-side PDF generation.
- **pdfkit**: Server-side PDF generation.
- **qrcode**: QR code generation.
- **@azure/ai-form-recognizer**: Azure AI Document Intelligence SDK.
- **express-rate-limit**: Login brute-force protection.
- **dompurify**: XSS sanitization for HTML content rendering.