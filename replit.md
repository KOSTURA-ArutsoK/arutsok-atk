# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for financial services and real estate. It offers comprehensive client and partner management, precise commission calculations, and emphasizes data integrity, auditability, and temporal validity. The platform aims to be a robust, secure, and leading solution for complex business relationships and financial transactions, with significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system utilizes a modern full-stack architecture with a focus on data integrity, security, and auditability. Key features include immutable historical records, soft deletion with audit trails, granular RBAC, and temporal validity managed via specific date fields and cron jobs. Unique 12-digit identifiers are generated globally for all entities.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Implemented through immutable historical records, soft deletion with audit trails, `audit_logs`, `subject_field_history` for granular field-level tracking, and document validity indicators.
- **Temporal Validity**: Managed with `validFrom`, `validTo`, and `isActive` fields, supported by hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Granular permissions are controlled via `permission_groups`.
- **UI/UX & Interaction**: Features include a forced two-step context selector, dynamic dialog sizing, a smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API voice assistance.
- **Security & Workflow**: Incorporates a two-phase idle timeout with auto-logout, a dedicated archive module with password-protected restore, and a processing time protocol.
- **Module A/B Architecture**: A dual-module system: **Module A (Contract Management)** uses a SEKTOR→ODVETVIE→PRODUKT→PRIEČINOK→PANEL→PARAMETER hierarchy. **Module B (Subject Management)** provides an aggregated client view with automatic object creation via unique key matching and data provenance tracking.
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) enables dynamic, database-driven configuration of contract fields and form generation without code changes. Supports AI synonym mapping for document text extraction and tracks unknown extracted fields for continuous learning.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity and supports various calculation types, logging all calculations.
- **Settlement Sheets Module**: Manages settlement sheets and contracts, including locking mechanisms, status workflows, and monitoring.
- **Repeatable Collections**: Allows creation of repeatable groups of fields (e.g., vehicles, properties) within forms, with data stored in JSONB.
- **Subject & Contract Parameter Systems**: Defines a comprehensive set of active parameters for subjects (e.g., IDENTITA, KONTAKT, EKONOMIKA) and contracts across various sectors (e.g., Poistenie, Reality, Investície), all with AI extraction hints.
- **Client Management**: Includes multi-step registration, granular ownership and visibility rules, a Bonita Point System, risk linking, and an AML module.
- **Client Portal**: Provides a restricted, read-only interface for clients to access their profiles.
- **Reporting & Administration**: Features system settings, customizable dashboards, global table resizing, universal column management, and dedicated CRUD pages.
- **Excel Importer**: Advanced importer for auto-creating/updating subjects, handling incomplete contracts, and duplicate detection.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated serving, and classification (profile/signature/id_scan). Includes a WhatsApp-style image lightbox.
- **AI Feedback Loop**: Uses `parameter_synonyms` to improve AI document text extraction through user confirmations.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with `relation_role_types` (32 roles), supporting temporal validity and context-aware relations.
- **Family Relations (Rodinný pavúk)**: Defines 8 family-specific roles, features a family spider visualization, parameter inheritance, maturity semaphore tracking, and AI extraction rules for auto-linking family members.
- **Universal Guardian Access Hierarchy**: Allows both individuals and organizations to serve as legal guardians, with features for ward management, enhanced maturity alerts, and automatic read-only access for guardians.
- **Blbuvzdornosť (Foolproof) System**: Implements `data_conflict_alerts` with resolution workflows, `transaction_dedup_log` for duplicate detection, Zod validation, and subject-level authorization checks.
- **GDPR & Privacy System**: Comprehensive privacy controls, household management, privacy blocks, and access consent logging. Includes an 18+ privacy trigger with explicit consent requirements.
- **Full-Auto Adult Transition (Autopilot)**: Automated 18+ transition for wards, revoking guardian consents, creating privacy blocks, archiving relations, and sending notifications.
- **Address Groups (Adresná skupina - Objekt XY)**: Groups unrelated subjects by shared address or contract without implying cross-profile access.
- **PO Structure (Company Subject Roles)**: Defines a deep role hierarchy for companies (`Štatutár`, `UBO`, `Zamestnanec`, `Operátor`) with section-level access control.
- **Bulk Notification Queue**: Async batch processing for notifications with real-time progress tracking and a dedicated UI for batch actions.
- **Behavioral Profile & Smart Tags**: Panel "Behaviorálny & Zdravotný kódex" under OSOBNÉ with communication type, specific needs (multi-select), and access notes. Tag system stored in `subjects.details.tags` (JSONB array) with preset colored tags (VIP, Vozičkár, Pozor, Problémový, Neaktívny, Prioritný) + custom tags. Red behavior alert (POZOR) appears at subject name when communication is "Agresívna" or access note is filled. Tags and alerts visible in both Profile (C) and Subjects list. `SubjectTagBadges` component exported for reuse.

## External Dependencies
- **Replit OIDC Auth**: Authentication.
- **PostgreSQL (Neon)**: Database.
- **Drizzle ORM**: Database interaction.
- **Vite**: Frontend build.
- **Express.js**: Backend framework.
- **Tailwind CSS**: Styling.
- **shadcn/ui**: UI components.
- **wouter**: Client-side routing.
- **Tiptap**: Rich text editor.
- **Multer**: File uploads.
- **ExcelJS**: Excel generation.
- **Sharp**: Image processing.