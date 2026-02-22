# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for financial services and real estate industries. It provides comprehensive client and partner management, precise commission calculations, and prioritizes data integrity, auditability, and temporal validity. The platform aims to be a secure and robust solution for managing complex business relationships and financial transactions, with a vision to become a leading, robust, and secure platform in its niche market.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system employs a modern full-stack architecture, emphasizing data integrity, security, and auditability through immutable historical records, soft deletion with audit trails, and granular RBAC. Temporal validity is managed using specific date fields and cron jobs for archiving. Unique identifiers are generated globally.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Immutable historical records, soft deletion with audit trails, comprehensive `audit_logs`, and subject-specific history views ensure data integrity and full auditability. Granular field-level history (`subject_field_history`) with per-field filtering, author attribution, intelligent restore with append-only audit trail, and document validity semaphore (traffic light indicators for expired/expiring/valid documents).
- **Temporal Validity**: Utilizes `validFrom`, `validTo`, and `isActive` fields, supported by an hourly cron job for archiving expired data.
- **Role-Based Access Control (RBAC)**: Granular permissions are managed via `permission_groups` for secure access control.
- **Unique Identifiers**: Atomic 12-digit UIDs are generated from a `global_counters` table for all entities.
- **UI/UX & Interaction**: Features include a forced two-step context selector, dynamic dialog sizing, a smart filter bar system with saved views, row-click navigation, integrated rich text editing (Tiptap), dual document management, drag & drop reordering, consistent status indicators, and voice assistance via Web Speech API.
- **Security & Workflow**: Implements a two-phase idle timeout with auto-logout, a dedicated archive module with password-protected restore, and a processing time protocol for tracking form editing.
- **Dynamic Parameter System**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) allows dynamic configuration of contract fields and form generation. This system is database-driven, replacing hardcoded definitions and supporting temporal validity for parameters and templates. It includes AI synonym mapping for document text extraction and tracks unknown extracted fields for continuous learning.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports various calculation types, and maintains `commission_calculation_logs`.
- **Settlement Sheets Module**: Manages settlement sheets and contracts with locking mechanisms, status workflows, and monitoring for undelivered contracts.
- **Subject Parameter System**: 319 active parameters across 11 logical sections (IDENTITA, KONTAKT, ADRESA, DOKLADY, EKONOMIKA, AML, PO, SZČO, VOZIDLO, NEHNUTEĽNOSŤ, ZDRAVOTNÝ PROFIL, INVESTIČNÝ PROFIL, PRENÁJOM NEHNUTEĽNOSTÍ). Supports 3 client types (FO=273 params, PO=31 params, SZČO=15 params). Three templates: SUBJEKT FO (116 params), VOZIDLO (53 params), MAJETOK (62 params). Deprecated/merged panels use [ZLÚČENÉ] prefix and are filtered from API responses. All params have consistent codes (prefixes: p_, adr_, kont_, dok_, eko_, aml_, po_, szco_, voz_, real_, zdr_, inv_, pren_). EKONOMIKA includes sub-panels for Leasingy/Úvery and Dôchodkové sporenie. All params have AI extraction hints (synonyms) for document text extraction.
- **Client Management**: Features multi-step client registration, granular subject ownership and visibility rules, and a detailed client data architecture organized into categories with field history logging. Includes a Bonita Point System for credit ratings, risk linking, and an AML module.
- **Client Portal**: Provides a restricted, read-only interface for clients to access their own profiles, ensuring data isolation.
- **Reporting & Administration**: Features include system settings, customizable dashboards with drag-and-drop widgets, global table resizing, a universal column manager, and dedicated CRUD pages for states and companies.
- **Excel Importer**: Advanced importer auto-creates/updates subjects, marks incomplete contracts, detects duplicates, and maps data to client categories.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated file serving, and `fileType` classification (profile/signature/id_scan/other). WhatsApp-style `ImageLightbox` component with carousel navigation (arrows/swipe/keyboard), zoom (scroll/buttons), rotation, responsive display, and thumbnail strip. Signature uploads use aspect-preserving resize (800px width). File type deactivation is scoped (uploading signature doesn't deactivate profile). Signature indicator badge on avatar when signature is attached.
- **AI Feedback Loop**: `parameter_synonyms` table supports synonym learning with user confirmations, enhancing AI document text extraction accuracy over time.

## External Dependencies
- **Replit OIDC Auth**: For user authentication.
- **PostgreSQL (Neon)**: The primary database service.
- **Drizzle ORM**: Used for database interactions.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web application framework.
- **Tailwind CSS**: For styling the user interface.
- **shadcn/ui**: UI component library.
- **wouter**: Client-side routing library.
- **Tiptap**: Rich text editor integrated for notes.
- **Multer**: Handles file uploads.
- **ExcelJS**: For generating Excel spreadsheets.
- **Sharp**: Used for image processing, including resizing and smart cropping of profile photos.