# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for financial services and real estate. It offers comprehensive client and partner management, precise commission calculations, and emphasizes data integrity, auditability, and temporal validity. The platform aims to be a robust, secure, and leading solution for complex business relationships and financial transactions, with significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system employs a modern full-stack architecture prioritizing data integrity, security, and auditability. It features immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through specific date fields and cron jobs. All entities are assigned unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Achieved via immutable historical records, soft deletion, `audit_logs`, `subject_field_history`, and document validity indicators.
- **Temporal Validity**: Implemented using `validFrom`, `validTo`, `isActive` fields, and hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Granular permissions managed through `permission_groups`.
- **UI/UX & Interaction**: Features a two-step context selector, dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API voice assistance.
- **Security & Workflow**: Includes a two-phase idle timeout with auto-logout, an archive module with password-protected restore, and a processing time protocol.
- **Module A/B Architecture**: Comprises Module A (Contract Management) with a SEKTOR→ODVETVIE→PRODUKT→PRIEČINOK→PANEL→PARAMETER hierarchy, and Module B (Subject Management) offering an aggregated client view, automatic object creation, and data provenance tracking.
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) for dynamic, database-driven configuration of contract fields and form generation. Supports AI synonym mapping and tracks unknown extracted fields.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity and supports various calculation types, logging all calculations.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking mechanisms and status workflows.
- **Repeatable Collections**: Enables repeatable groups of fields within forms, with data stored in JSONB.
- **Subject & Contract Parameter Systems**: Defines active parameters for subjects and contracts across sectors with AI extraction hints.
- **Client Management**: Includes multi-step registration, granular ownership and visibility rules, Bonita Point System, risk linking, and an AML module.
- **Client Portal**: Provides a restricted, read-only interface.
- **Reporting & Administration**: Offers system settings, customizable dashboards, global table resizing, universal column management, and dedicated CRUD pages.
- **Excel Importer**: Advanced importer for auto-creating/updating subjects, handling incomplete contracts, and duplicate detection.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated serving, and classification.
- **AI Feedback Loop**: Uses `parameter_synonyms` to enhance AI document text extraction through user confirmations.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with 32 `relation_role_types`, supporting temporal validity and context-aware relations.
- **Family Relations (Rodinný pavúk)**: Defines 8 family-specific roles, features a family spider visualization, parameter inheritance, maturity semaphore tracking, and AI extraction rules.
- **Universal Guardian Access Hierarchy**: Allows individuals and organizations as legal guardians, with features for ward management, enhanced maturity alerts, and automatic read-only access.
- **Blbuvzdornosť (Foolproof) System**: Implements `data_conflict_alerts` with resolution workflows, `transaction_dedup_log` for duplicate detection, Zod validation, and subject-level authorization checks.
- **GDPR & Privacy System**: Comprehensive privacy controls, household management, privacy blocks, and access consent logging. Includes an 18+ privacy trigger.
- **Full-Auto Adult Transition (Autopilot)**: Automated 18+ transition for wards, revoking guardian consents, creating privacy blocks, archiving relations, and sending notifications.
- **Address Groups (Adresná skupina - Objekt XY)**: Groups unrelated subjects by shared address or contract.
- **PO Structure (Company Subject Roles)**: Defines a deep role hierarchy for companies with section-level access control.
- **Bulk Notification Queue**: Asynchronous batch processing for notifications with real-time progress tracking and a dedicated UI.
- **Behavioral Profile & Smart Tags**: Panel for behavioral and medical codes, communication types, specific needs, and access notes. Tag system in `subjects.details.tags` (JSONB array) with preset colored tags and custom tags. Red behavior alert for "Agresívna" communication or filled access notes. Tags and alerts visible in Profile and Subjects list.
- **CGN Module (Interná Segmentácia)**: Risk segmentation via `subjects.details.cgnActive` (boolean). Visual indicators for stable and CGN-flagged subjects. High-Alert Mode with orange subject name, daily warning dialog, and CGN toggle in Architect mode.
- **Globálny Stroj času (🕰️)**: Inline version count indicator inside every input field, showing history and allowing restoration.
- **Heatmapa čerstvých dát (7-dňový cyklus)**: Panels automatically change background color based on data freshness.
- **Dôkazný materiál (ORSR/ŽRSR)**: Auto-generates styled evidence documents for company lifecycle status changes (e.g., "Zaniknutá", "V likvidácii") from state registers.
- **Relations Integration (Relácie a portfólio)**: Three AI-driven panels: Rodinný klaster, Osobné portfólio subjektu, Navrhované prepojenia AI.
- **Asset Panels (⛵🏗️💎)**: Specialized panels for Špeciálne aktíva, Firemné portfólio, and Špecifické riziká.
- **📸 Vizuálna evidencia exkluzívnych aktív**: Orange Camera icon semaphore on asset fields when data exists but no photo attached, advising documentation of high-value assets.
- **🎭 Poistenie podujatí**: Event insurance panel for all client types with event details and status. Auto-expiry cron job archives events past their end date.
- **🏛️ Špecifické subjekty**: PO-only panel for state institutions, foundations, NGOs with conditional fields based on organization type.
- **Visibility Rules**: Fields with `visibilityRule` conditionally render based on another field's value.
- **System Notifications (Email Queue)**: `system_notifications` table stores all lifecycle email notifications with recipient, subject, body, and status.
- **Dynamic Product Lifecycle Limits**: `sector_products` table allows configurable `objection_days_limit` and `archive_days_before_delete` per product, utilized by cron jobs.
- **Ghost Mode (Migration Mode)**: Superadmin-only toggle for bulk historical contract import, which gates/skips lifecycle cron jobs, allows manual lifecycle timestamp overrides, sets system timestamps to the earliest historical date, and audits trail logs "Systémový import".

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

## Recent Features
- **Analytics & Reporting Module**: Admin/SuperAdmin-only module at `/analytika`. Sidebar item "Analytika a Reporty" (BarChart3 icon) below Informácie section. Backend `GET /api/reports/production` endpoint with filters (dateRange, partner, agent, status, contractType, premiumMin/Max, paymentFrequency, expiryFrom/To, listStatus, subjectType, PSČ), state isolation via `getEnforcedStateId`. **6 KPI cards**: Celková produkcia, Čistá produkcia, Skutočný cashflow, Storno Analýza (red), Cross-sell potenciál (green, 3+ contracts without life insurance), Červený zoznam count (orange). **Dynamic filter system**: „+ Pridať filter" button with Module A (Klientsky kmeň: typ subjektu, reputačný status, PSČ), Module B (Zmluvy: lehotné poistné min/max, frekvencia platenia, dátum expirácie), Module C (placeholder for OCR fields). Filters appear as chips with module badge and ✕ removal. Auto-update on filter change. **Hĺbkový prieskum** collapsible section showing active filters with module badges. **Charts**: PieChart (Partner Share) and BarChart (Monthly trend) using recharts. **Extended table** with Typ zmluvy, Frekvencia, Expirácia columns + červený zoznam badge. **Fulltext search** in table. Response includes `partnerBreakdown`, `monthlyTrend`, `contractTypes`. MASSIVE_DATA_ACCESS audit for >500 records, DEEP_DIVE_ACCESS audit for Module C filters. Manager Summary PDF via jsPDF with diagonal watermark, includes KPI + active filters + partner breakdown + monthly trend. No xlsx/csv/json export. `@media print` hides report-table class. SQL limit 2000 records.