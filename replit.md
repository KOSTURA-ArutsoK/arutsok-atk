# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for financial services and real estate. It focuses on client and partner management, precise commission calculations, and ensuring data integrity, auditability, and temporal validity. The platform aims to be a secure, leading solution for complex business relationships and financial transactions, with significant market potential.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system employs a modern full-stack architecture emphasizing data integrity, security, and auditability. It features immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through date fields and cron jobs. All entities use unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Implemented via immutable records, soft deletion, audit logs, field history, and document validity indicators.
- **Temporal Validity**: Managed using `validFrom`, `validTo`, `isActive` fields, and hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Granular permissions are controlled through `permission_groups`.
- **UI/UX & Interaction**: Includes a Holding Context Bubble (unified header selector), dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API integration.
- **Security & Workflow**: Features a two-phase idle timeout with auto-logout, an archive module with password-protected restore, and a processing time protocol.
- **4-Module Architecture (Kostura OS)**:
  - Module A: Import & Identita (klienti, kódy, SEKTOR→ODVETVIE→PRODUKT→PRIEČINOK→PANEL→PARAMETER hierarchy)
  - Module B: OCR & Digitalizácia (skenovanie 13k zmlúv, subject sectors)
  - Module C: Holding Dashboard (KPI, GWP, cross-sell, divízna výkonnosť, DB status Bratislava)
  - Module D: Administrácia & Úpravy (manuálne editovanie zmlúv, správa synonym, AI 5× pravidlo)
- **Sensitive Field Audit**: Every access to subject detail (birthNumber, idCardNumber, iban, email, phone) creates an audit log entry with action `sensitive_field_access`.
- **Global Field Versioning**: All field changes on subjects and contracts are automatically diffed and recorded in `subject_field_history` / `contract_parameter_value_history`.
- **DB Status Endpoint**: `GET /api/system/db-status` returns connection info (host, database, label: "Bratislava").
- **Dynamic Parameter System (EAV Architecture)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) allows dynamic configuration of contract fields and form generation, supported by AI synonym mapping.
- **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity and supports various calculation types with logging.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking mechanisms and status workflows.
- **Client Management**: Features multi-step registration, granular ownership, Bonita Point System, risk linking, and an AML module.
- **Universal Guardian Access Hierarchy**: Manages legal guardians for individuals and organizations, with ward management and enhanced maturity alerts.
- **Foolproof System (`Blbuvzdornosť`)**: Implements `data_conflict_alerts`, `transaction_dedup_log`, Zod validation, and subject-level authorization.
- **GDPR & Privacy System**: Provides comprehensive privacy controls, household management, privacy blocks, and access consent logging.
- **Global Subject Relations System**: Universal cross-entity linking via `subject_relations` with 40 `relation_role_types`, temporal validity, and context-aware relations. Includes specific family relations for visualization and parameter inheritance.
- **First Contract Rule (`Pravidlo Prvej Zmluvy`)**: Automatically identifies and flags the first contract for an agent within a division, with commission redirection logic and visual indicators.
- **Address Inheritance (`Dedičnosť adries`)**: System suggests propagating address updates to related subjects based on defined relationships.
- **Partner & Product Lifecycle (Media-Player System)**: A 6-state lifecycle for `partners` and `sector_products` with top-down inheritance and cron-driven auto-transitions, managed via inline controls.
- **90-Day Date Semaphore**: A utility that highlights expired dates in red and upcoming dates (≤90 days) in orange for contract expiry and key subject date fields.
- **Contract Parameter Versioning (`Stroj času`)**: Tracks all changes to contract parameter values, allowing history viewing and restoration.
- **Holding Structure**: A unified ID system with dynamic country prefixes, extended `states` table, and `divisions` table for holding divisions, each with an `emoji` for visual identification.
- **9-Level Hierarchy**: Defines a full data path from Štát to Parameter for structured data management.
- **Sentinel Security Pyramid (0-10 Levels)**: A comprehensive 11-level security model (L0-L10) with explicit `securityLevel`, role-based fallbacks, sensitive data masking, blacklist enforcement, write restrictions for auditors (L9), and IP locking.
- **Dashboard & Analytics**: Provides a customizable overview with drag-and-drop widgets, KPI cards, dynamic filters, charts, and PDF summaries for administrators and superadministrators. A separate Holding Dashboard offers L7+ analytics with cross-sell and division performance heatmaps, exchange rates, and export functionalities.
- **Data Leakage Prevention (DLP) System**: A 4-layer system including anti-mass-export limits, dynamic visual watermarks on UI, suspicious activity detection with CAPTCHA challenges, and cryptographic audit signing for integrity verification.

## External Dependencies
- **Replit OIDC Auth**: Authentication service.
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