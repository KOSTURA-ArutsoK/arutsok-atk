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
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) allows dynamic configuration of contract fields and form generation. This system is fully database-driven ("Programmer-Independent") - admins add parameters via Knižnica Parametrov UI and they auto-appear in all views, AI extraction, and forms without code changes. Key components: `/api/subject-schema/:clientTypeId` endpoint consolidates sections/panels/fields with extraction hints; `useSubjectSchema` hook replaces static TypeScript field definitions; `FIELD_HINTS` and `FIELD_TO_CATEGORY` are dynamized from DB `extraction_hints`; static fallback (`staticFieldDefs.ts`) preserved for backward compatibility. Supports temporal validity for parameters and templates, AI synonym mapping for document text extraction, and tracks unknown extracted fields for continuous learning.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports various calculation types, and maintains `commission_calculation_logs`.
- **Settlement Sheets Module**: Manages settlement sheets and contracts with locking mechanisms, status workflows, and monitoring for undelivered contracts.
- **Repeatable Collections**: Sections marked `is_collection=true` (VOZIDLO, NEHNUTEĽNOSŤ, PRENÁJOM, POĽNOHOSPODÁRSTVO, ZVIERATÁ, ŠPECIFICKÉ RIZIKÁ, LEASINGY/ÚVERY) render as repeatable groups with add/remove instances. Data stored as `{sectionCode}_{instanceIndex}_{fieldKey}` in clientData JSONB. UI renders indexed instances with dashed borders and instance counter badges.
- **Subject Parameter System**: 350 active parameters across 14 logical sections (IDENTITA, KONTAKT, ADRESA, DOKLADY, EKONOMIKA, AML, PRÁVNE SUBJEKTY, SZČO, VOZIDLO, NEHNUTEĽNOSŤ, ZDRAVOTNÝ PROFIL, INVESTIČNÝ PROFIL, PRENÁJOM NEHNUTEĽNOSTÍ, POĽNOHOSPODÁRSTVO & ZVIERATÁ, MARKETING & GDPR, UNIVERZÁLNY RETAIL & OBCHOD). Supports 3 client types (FO=303 params, PO=32 params, SZČO=15 params). Three templates: SUBJEKT FO (120 params), VOZIDLO (53 params), MAJETOK (62 params). Deprecated/merged panels use [ZLÚČENÉ] prefix and are filtered from API responses. All params have consistent codes (prefixes: p_, adr_, kont_, dok_, eko_, aml_, po_, szco_, voz_, real_, zdr_, inv_, pren_, agro_, mkt_, ret_). EKONOMIKA includes sub-panels for Leasingy/Úvery and Dôchodkové sporenie. PRÁVNE SUBJEKTY reorganized into 3 sub-panels (Základné údaje, Prepojenia a orgány, Ekonomické parametre) with OR extraction priority. All params have AI extraction hints (synonyms) for document text extraction.
- **Contract Parameter System**: 89 contract parameters across 12 sections in 6 sectors (Poistenie: PZP, CP, Životné poistenie, Cestovné poistenie; SDS; Reality: Predaj/Nákup realít; Odškodnenie; Investície; Poľnohospodárstvo & Zvieratá: Rastlinná výroba, Zvieratá, Špecifické riziká). Cestovné poistenie covers territorial validity, trip type, riders (storno, baggage, liability, rescue), and treatment cost limits.
- **Client Management**: Features multi-step client registration, granular subject ownership and visibility rules, and a detailed client data architecture organized into categories with field history logging. Includes a Bonita Point System for credit ratings, risk linking, and an AML module.
- **Client Portal**: Provides a restricted, read-only interface for clients to access their own profiles, ensuring data isolation.
- **Reporting & Administration**: Features include system settings, customizable dashboards with drag-and-drop widgets, global table resizing, a universal column manager, and dedicated CRUD pages for states and companies.
- **Excel Importer**: Advanced importer auto-creates/updates subjects, marks incomplete contracts, detects duplicates, and maps data to client categories.
- **Profile Photo System**: Manages `subject_photos` with versioning, smart cropping, authenticated file serving, and `fileType` classification (profile/signature/id_scan/other). WhatsApp-style `ImageLightbox` component with carousel navigation (arrows/swipe/keyboard), zoom (scroll/buttons), rotation, responsive display, and thumbnail strip. Signature uploads use aspect-preserving resize (800px width). File type deactivation is scoped (uploading signature doesn't deactivate profile). Signature indicator badge on avatar when signature is attached.
- **AI Feedback Loop**: `parameter_synonyms` table supports synonym learning with user confirmations, enhancing AI document text extraction accuracy over time.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` table with `relation_role_types` codebook (32 roles across 5 categories: Zmluvná strana, Predmet záujmu, Beneficient, Kontakt, Rodina). Supports context-aware relations (sector, section, collection index), temporal validity, and Draft subject auto-creation. Cross-Entity Intelligence provides summary view of all relations across the system. No text-only names allowed - always links to subject_id.
- **Family Relations (Rodinný pavúk)**: 8 family-specific roles (Rodič/Zákonný zástupca, Dieťa/Oprávnená osoba, Manžel/Manželka, Partner/Druh, Starý rodič, Vnuk/Vnučka, Súrodenec, Iný príbuzný). Features: Family spider visualization in Relácie tab, parameter inheritance (address propagation from parent to child with confirmation), maturity semaphore (18th birthday tracking with approaching/imminent/reached alerts and contract update prompts), AI extraction rules for auto-linking parent/child from children's insurance and savings contracts. Tables: `maturity_alerts`, `inheritance_prompts`. Cron job refreshes maturity alerts hourly. API: `/api/family/tree/:id`, `/api/family/check-inheritance`, `/api/family/apply-inheritance`, `/api/family/auto-link-from-contract`, `/api/family/extraction-rules`, `/api/maturity-alerts/*`.
- **Blbuvzdornosť (Foolproof) System**: `data_conflict_alerts` for field-level conflict detection with resolution workflow (keep_existing/use_new/merge/dismissed). `transaction_dedup_log` with fingerprint-based duplicate detection and unique constraint. All endpoints use Zod validation and `checkKlientiSubjectAccess` for subject-level authorization.

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