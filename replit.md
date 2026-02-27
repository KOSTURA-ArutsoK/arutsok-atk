# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for the financial services and real estate sectors. Its primary purpose is to provide robust client and partner management, precise commission calculations, and ensure high data integrity, auditability, and temporal validity. The platform aims to become a leading, secure solution for managing complex business relationships and financial transactions, with significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system utilizes a modern full-stack architecture, emphasizing data integrity, security, and auditability. Key features include immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through date fields and cron jobs. All entities are assigned unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Achieved through immutable records, soft deletion, audit logs, field history, and document validity indicators.
- **Temporal Validity**: Implemented using `validFrom`, `validTo`, `isActive` fields, and hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Granular permissions managed via `permission_groups`.
- **UI/UX & Interaction**: Includes a two-step context selector, dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API integration.
- **Security & Workflow**: Features a two-phase idle timeout with auto-logout, an archive module with password-protected restore, and a processing time protocol.
- **Module A/B Architecture**: Module A (Contract Management) uses a SEKTOR→ODVETVIE→PRODUKT→PRIEČINOK→PANEL→PARAMETER hierarchy. Module B (Subject Management) provides an aggregated client view and data provenance.
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) allows dynamic configuration of contract fields and form generation, with AI synonym mapping.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports various calculation types, and logs all calculations.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking mechanisms and status workflows.
- **Repeatable Collections**: Enables repeatable field groups within forms, storing data in JSONB.
- **Client Management**: Features multi-step registration, granular ownership, Bonita Point System, risk linking, and an AML module.
- **Subject Registration Status**: Three-state lifecycle (`potencialny` → `tiper` → `klient`) tracked via `subjects.registrationStatus`. Auto-upgraded to `klient` on first contract creation. Visual badges in subject table (Overenie column) and detail panel. Admins can manually change status via profile header dropdown. All changes tracked in `subject_field_history`.
- **Client Portal**: Provides a restricted, read-only interface for clients.
- **Reporting & Administration**: Offers system settings, customizable dashboards, global table resizing, universal column management, and dedicated CRUD pages.
- **Excel Importer**: Advanced tool for auto-creating/updating subjects, handling incomplete contracts, and duplicate detection.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated serving, and classification.
- **AI Feedback Loop**: Enhances AI document text extraction through user-confirmed `parameter_synonyms`.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with 40 `relation_role_types` (32 original + 8 biznis), temporal validity, and context-aware relations. Biznis category includes: nadriadeny, podriadeny, majitel_firmy, konatel, tiper_rel, obchodny_partner, poradca, byva_spolu. Creating NADRIADENÝ/PODRIADENÝ relation auto-syncs `app_users.manager_id`.
- **Family Relations (Rodinný pavúk)**: Defines 8 family-specific roles, features a family spider visualization, parameter inheritance, and AI extraction rules.
- **Pravidlo Prvej Zmluvy (First Contract Rule)**: `contracts.isFirstContract` flag detected at creation time. When agent's first contract in division, 100% UP+NP commission redirected to `manager_id` superior. Fixated via `commissionRedirectedToUserId` and `commissionRedirectedToName` snapshot. Red "Provízny stop" banner in contract detail. "1. ZMLUVA" badge in contracts table. Commission calculation logs track `isRedirected` and `redirectReason`.
- **Address Inheritance (Dedičnosť adries)**: When updating a subject's address, system checks `subject_relations` for BYVA_SPOLU, family roles (rodic, manzel, partner, dieta). Shows dialog to propagate address to linked subjects. Endpoints: `GET /api/subjects/:id/address-inheritance-candidates`, `POST /api/subjects/:id/propagate-address`.
- **Universal Guardian Access Hierarchy**: Manages legal guardians for individuals and organizations, with ward management and enhanced maturity alerts.
- **Blbuvzdornosť (Foolproof) System**: Implements `data_conflict_alerts`, `transaction_dedup_log`, Zod validation, and subject-level authorization.
- **GDPR & Privacy System**: Comprehensive privacy controls, household management, privacy blocks, and access consent logging.
- **Full-Auto Adult Transition (Autopilot)**: Automated 18+ transition for wards, managing consents, archiving relations, and notifications.
- **Address Groups (Adresná skupina - Objekt XY)**: Groups unrelated subjects by shared address or contract.
- **PO Structure (Company Subject Roles)**: Defines a deep role hierarchy for companies with section-level access control.
- **Bulk Notification Queue**: Asynchronous batch processing for notifications with real-time progress tracking.
- **Behavioral Profile & Smart Tags**: Panel for behavioral/medical codes, communication types, and needs. Tag system in `subjects.details.tags` (JSONB) with preset and custom tags.
- **CGN Module (Interná Segmentácia)**: Risk segmentation via `subjects.details.cgnActive` with visual indicators and a high-alert mode.
- **Globálny Stroj času (🕰️)**: Inline version count indicator in input fields, showing history and allowing restoration.
- **Heatmapa čerstvých dát (7-dňový cyklus)**: Panels change background color based on data freshness.
- **Dôkazný materiál (ORSR/ŽRSR)**: Auto-generates styled evidence documents for company lifecycle status changes from state registers.
- **Relations Integration (Relácie a portfólio)**: AI-driven panels for Rodinný klaster, Osobné portfólio subjektu, and Navrhované prepojenia AI.
- **Asset Panels (⛵🏗️💎)**: Specialized panels for Špeciálne aktíva, Firemné portfólio, and Špecifické riziká.
- **📸 Vizuálna evidencia exkluzívnych aktív**: Orange Camera icon semaphore on asset fields advising photo documentation.
- **🎭 Poistenie podujatí**: Event insurance panel with event details and status. Auto-expiry cron job archives events.
- **🏛️ Špecifické subjekty**: PO-only panel for state institutions, foundations, NGOs with conditional fields.
- **Visibility Rules**: Conditional rendering of fields based on other field values.
- **System Notifications (Email Queue)**: `system_notifications` table stores lifecycle email notifications.
- **Dynamic Product Lifecycle Limits**: `sector_products` table allows configurable `objection_days_limit` and `archive_days_before_delete`.
- **Ghost Mode (Migration Mode)**: Superadmin-only toggle for bulk historical contract import, managing lifecycle cron jobs and timestamps.
- **Partner & Product Lifecycle (Media-Player System)**: 6-state lifecycle for `partners` and `sector_products` via `lifecycle_status` column, with top-down inheritance and cron-driven auto-transitions.
- **Holding Structure (Kostura OS)**: Unified ID system with dynamic country prefix, extended `states` table with `currency`, and `divisions` table for holding divisions. Divisions have `emoji` field for visual identification.
- **Adaptive Division Header**: Division switcher in header uses emoji bar (≤5 divisions) with colored ring for active division and tooltips, or dropdown menu (6+ divisions). Hidden for Klienti users. Emoji displayed in Context Selector Overlay tiles.
- **9-Level Hierarchy**: Full data path: Štát → Spoločnosť → Divízia → Sektor → Sekcia → Produkt → Priečinok → Panel → Parameter, with `sectorId` linked to `divisionId` and `sectionType`.
- **Majiteľský Sentinel & Impersonation**: `architekt` role (L7) for highest privilege, with impersonation functionality for auditing and support.
- **Dashboard (Prehľad)**: Simple overview at `/` with drag-and-drop widget layout for contract stats, recent subjects, companies, partners, products, audit activity, and events.
- **Analytics & Reporting Module**: Admin/SuperAdmin module at `/analytika` with KPI cards (Production, Cashflow, Storno Analysis, Cross-sell potential, Red list), a dynamic filter system, charts (PieChart, BarChart), and PDF manager summaries.

## External Dependencies
- **Replit OIDC Auth**: Authentication service.
- **PostgreSQL (Neon)**: Primary database.
- **Drizzle ORM**: Object-Relational Mapper.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web application framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **wouter**: React routing library.
- **Tiptap**: Headless editor framework for rich text editing.
- **Multer**: Middleware for handling `multipart/form-data`.
- **ExcelJS**: Library for reading, writing, and manipulating XLSX, CSV, and JSON files.
- **Sharp**: High-performance Node.js image processing library.
- **jsPDF**: Client-side PDF generation library.