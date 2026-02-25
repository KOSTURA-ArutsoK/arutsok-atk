# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for financial services and real estate sectors. It provides comprehensive client and partner management, precise commission calculations, and emphasizes data integrity, auditability, and temporal validity. The platform aims to be a robust, secure, and leading solution for complex business relationships and financial transactions, with significant market potential.

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
- **Data Integrity & Auditability**: Achieved via immutable historical records, soft deletion with audit trails, dedicated `audit_logs`, `subject_field_history` for granular field-level tracking, and document validity indicators.
- **Temporal Validity**: Implemented using `validFrom`, `validTo`, and `isActive` fields, supported by hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Granular permissions are managed through `permission_groups`.
- **UI/UX & Interaction**: Includes a forced two-step context selector, dynamic dialog sizing, a smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API voice assistance.
- **Security & Workflow**: Features a two-phase idle timeout with auto-logout, a dedicated archive module with password-protected restore, and a processing time protocol.
- **Module A/B Architecture**: Comprises **Module A (Contract Management)** with a SEKTOR→ODVETVIE→PRODUKT→PRIEČINOK→PANEL→PARAMETER hierarchy, and **Module B (Subject Management)** offering an aggregated client view, automatic object creation via unique key matching, and data provenance tracking.
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) allows for dynamic, database-driven configuration of contract fields and form generation without code changes. Supports AI synonym mapping for document text extraction and tracks unknown extracted fields for continuous learning.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity and supports various calculation types, logging all calculations.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking mechanisms, status workflows, and monitoring.
- **Repeatable Collections**: Enables creation of repeatable groups of fields within forms, with data stored in JSONB.
- **Subject & Contract Parameter Systems**: Defines active parameters for subjects (e.g., IDENTITA, KONTAKT, EKONOMIKA) and contracts across sectors (e.g., Poistenie, Reality, Investície), all with AI extraction hints.
- **Client Management**: Includes multi-step registration, granular ownership and visibility rules, a Bonita Point System, risk linking, and an AML module.
- **Client Portal**: Provides a restricted, read-only interface for clients.
- **Reporting & Administration**: Offers system settings, customizable dashboards, global table resizing, universal column management, and dedicated CRUD pages.
- **Excel Importer**: Advanced importer for auto-creating/updating subjects, handling incomplete contracts, and duplicate detection.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated serving, and classification. Includes a WhatsApp-style image lightbox.
- **AI Feedback Loop**: Uses `parameter_synonyms` to enhance AI document text extraction through user confirmations.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with 32 `relation_role_types`, supporting temporal validity and context-aware relations.
- **Family Relations (Rodinný pavúk)**: Defines 8 family-specific roles, features a family spider visualization, parameter inheritance, maturity semaphore tracking, and AI extraction rules for auto-linking.
- **Universal Guardian Access Hierarchy**: Allows individuals and organizations as legal guardians, with features for ward management, enhanced maturity alerts, and automatic read-only access.
- **Blbuvzdornosť (Foolproof) System**: Implements `data_conflict_alerts` with resolution workflows, `transaction_dedup_log` for duplicate detection, Zod validation, and subject-level authorization checks.
- **GDPR & Privacy System**: Comprehensive privacy controls, household management, privacy blocks, and access consent logging. Includes an 18+ privacy trigger with explicit consent.
- **Full-Auto Adult Transition (Autopilot)**: Automated 18+ transition for wards, revoking guardian consents, creating privacy blocks, archiving relations, and sending notifications.
- **Address Groups (Adresná skupina - Objekt XY)**: Groups unrelated subjects by shared address or contract without implying cross-profile access.
- **PO Structure (Company Subject Roles)**: Defines a deep role hierarchy for companies with section-level access control.
- **Bulk Notification Queue**: Asynchronous batch processing for notifications with real-time progress tracking and a dedicated UI.
- **Behavioral Profile & Smart Tags**: Panel for behavioral and medical codes, communication types, specific needs, and access notes. Tag system in `subjects.details.tags` (JSONB array) with preset colored tags and custom tags. Red behavior alert for "Agresívna" communication or filled access notes. Tags and alerts visible in Profile and Subjects list.
- **CGN Module (Interná Segmentácia)**: Risk segmentation via `subjects.details.cgnActive` (boolean). Visual indicators for stable and CGN-flagged subjects. High-Alert Mode with orange subject name, daily warning dialog, and CGN toggle in Architect mode.
- **Globálny Stroj času (🕰️)**: Inline version count indicator inside every input field, showing history and allowing restoration.
- **Heatmapa čerstvých dát (7-dňový cyklus)**: Panels automatically change background color based on data freshness (blue for fresh, white for old).
- **Dôkazný materiál (ORSR/ŽRSR)**: When a company's lifecycle status changes to "Zaniknutá" or "V likvidácii", the system auto-generates a styled evidence document simulating a screenshot from the relevant state register (ORSR/ŽRSR). Evidence is stored in the `status_evidence` table.
- **Relations Integration (Relácie a portfólio)**: Three AI-driven panels: Rodinný klaster (family members by surname+address with wealth aggregation), Osobné portfólio subjektu (linked contracts with status/premium), Navrhované prepojenia AI (relationship suggestions).
- **Asset Panels (⛵🏗️💎)**: Specialized panels for Špeciálne aktíva (boats/aircraft/art), Firemné portfólio (SZČO/PO fleet/equipment), and Špecifické riziká (cyber/metals/environmental).
- **📸 Vizuálna evidencia exkluzívnych aktív**: Orange Camera icon semaphore on asset fields when data exists but no photo attached, advising documentation of high-value assets.
- **🎭 Poistenie podujatí**: Event insurance panel for all client types (FO/SZČO/PO) with event details and status. Auto-expiry cron job archives events past their end date.
- **🏛️ Špecifické subjekty**: PO-only panel for state institutions, foundations, NGOs with conditional fields based on organization type.
- **Visibility Rules**: Fields with `visibilityRule` conditionally render based on another field's value.
- **System Notifications (Email Queue)**: `system_notifications` table stores all lifecycle email notifications (objection_created, pre_deletion_warning) with recipient, subject, body, and status.
- **Dynamic Product Lifecycle Limits**: `sector_products` table allows configurable `objection_days_limit` and `archive_days_before_delete` per product, which cron jobs utilize.
- **Ghost Mode (Migration Mode)**: Superadmin-only toggle for bulk historical contract import. When active, it gates/skips lifecycle cron jobs, allows manual lifecycle timestamp overrides, sets system timestamps to the earliest historical date, and audits trail logs "Systémový import".

## External Dependencies
- **Replit OIDC Auth**: Authentication service.
- **PostgreSQL (Neon)**: Primary database.
- **Drizzle ORM**: Object-Relational Mapper for database interaction.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web application framework.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: UI component library.
- **wouter**: A tiny routing library for React.
- **Tiptap**: Headless editor framework for rich text editing.
- **Multer**: Middleware for handling `multipart/form-data`, primarily for file uploads.
- **ExcelJS**: Library for reading, writing, and manipulating XLSX, CSV, and JSON files.
- **Sharp**: High-performance Node.js image processing library.

## Recent Changes
- **Pagination**: Main contracts list endpoint paginated (limit/offset, default 50, max 200). Frontend "Načítať ďalšie" button with accumulated pages.
- **OPV Opravy**: Bulk reroute endpoint (`POST /api/contracts/bulk-reroute`) creates NEW inventory with next sequence number, assigns selected contracts. Old inventoryId archived in history + audit. Checkboxes (fixed 40px, non-resizable) in Neprijaté/Archív/Spracovanie. "Odoslať" buttons below table with color-coded backgrounds. Routing: Neprijaté→phase 2, Archív→phase 6, Spracovanie→phase 8.
- **Opečiatkovanie (Stamping)**: Phase 5 sets `stampedAt`, `isStamped=true`, `receivedByCentralAt`. After stamping, `contractNumber` and `statusId` are immutable (403 on update attempts, superadmin override). Revert from phase 5 releases `contractNumber` (set to null), clears stamp fields. Schema: `stamped_at` TIMESTAMP, `is_stamped` BOOLEAN on contracts table.
- **Dynamic Contract Numbering**: Phase 5 auto-assigns next sequential `contractNumber`. Revert from phase 5 releases number (sets to null) for reuse. Frontend disables contract number input when stamped with "Fixované" lock indicator.
- **Expandable Status History (Zhrnutie)**: Accordion-based numbered status change log rows in Zhrnutie tab. Each row expandable to show: old/new status, timestamp, user, iteration, notes, parameters, attached documents with download links.
- **Data Freshness Semaphore**: `getFreshnessSemaphore()` utility based on `updatedAt` field. Colors: green (<30d), amber (30-60d), red (60-90d), blinking red (>90d). Shown as column in contracts list ("Čerstvosť") and as detail indicator in Zhrnutie tab summary card.
- **Smart Status Semaphore**: `getSmartStatusColor()` in Contracts.tsx and ContractForm.tsx. If `expiryDate` (Koniec zmluvy) is filled, status dot turns red (#ef4444) regardless of status ID. No green allowed when end_date exists. Applied across all 6 status display locations.
- **AML & Compliance Panel**: Standalone collapsible panel in subject detail view (`subjekt-view.tsx`), below tabs. Displays PEP, KUV, PEO fields from staticFieldDefs. Orange semaphore dot when incomplete, green when filled. PEP/PEO "Áno" shows red badge. Editable in edit mode. Hidden from client portal view. Fields sourced from `dynamicFields` in subject details.