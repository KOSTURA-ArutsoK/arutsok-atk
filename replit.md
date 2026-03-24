# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for financial services and real estate. It manages client and partner relationships, calculates commissions, and ensures data integrity, auditability, and temporal validity for complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius
- Globálny Justified Layout: Všetky navigačné prvky, karty a menu zarovnané do bloku (vľavo aj vpravo). Flex-wrap, dynamické medzery, žiadny horizontálny scroll. TabsList: `flex flex-wrap h-auto gap-1 justify-between w-full`
- **Globálny formát dátumov (POVINNÉ)**: Vždy používaj `formatDateSlovak` alebo `formatDateTimeSlovak` z `@/lib/utils`. NIKDY nepoužívaj `toLocaleDateString`, `toLocaleString` ani `toLocaleTimeString` priamo.
  - Iba dátum: `dd.mm.rrrr` (napr. `22.03.2026`)
  - Dátum + čas: `dd.mm.rrrr - hh:mm:ss` (napr. `22.03.2026 - 14:23:45`)
  - Bez medzier okolo bodiek, bez iného formátu
- **Globálny formát UID (POVINNÉ)**: Vždy používaj `formatUid` z `@/lib/utils` na zobrazenie UID. NIKDY nevytvárај vlastné formátovanie UID. Skupiny číslic sú oddelené úzkou nezlomiteľnou medzerou (`\u202F`) — číslo sa nikdy nezalomí na viacero riadkov.
- **ConditionalDelete Guard (POVINNÉ)**: Každá stránka so zoznamom entít, ktorá zobrazuje tlačidlo mazania (Trash2), MUSÍ používať komponent `ConditionalDelete` z `@/components/conditional-delete.tsx`. Backend list endpointy MUSIA vracať počty závislostí (napr. `subjectsCount`, `officersCount`, `contractsCount`, ...). Trash ikona sa skryje (visibility:hidden) keď entita má závislosti — NIKDY len `disabled`. Implementované pre: Stávy (subjectsCount + companiesCount + partnersCount === 0), Divízie (contractCount + companiesCount === 0), Spoločnosti (!uid + subjectsCount + officersCount + contractsCount === 0), Partneri (!uid + productsCount + contractsCount === 0). Výnimky: inline položky formulára pred uložením, Archív, kalendárne udalosti, data-link joby, stavové parametre.

## System Architecture
The system employs a modern full-stack architecture prioritizing data integrity, security, and auditability. It features immutable historical records, soft deletion with audit trails, granular Role-Based Access Control (RBAC), and temporal validity managed through date fields. All entities are identified by unique 12-digit global identifiers.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Local e-mail/password with bcrypt and express-session (PG session store), including multi-step login and phone verification.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Immutable records, soft deletion, audit logs, field history, and document validity indicators.
- **Temporal Validity**: Implemented with `validFrom`, `validTo`, `isActive` fields and hourly archiving cron jobs.
- **Role-Based Access Control (RBAC)**: Supports admin/user roles with specific checks and granular permissions.
- **UI/UX & Interaction**: Includes a Holding Context Bubble, dynamic dialog sizing, smart filter bar, row-click navigation, Tiptap rich text editing, dual document management, drag & drop reordering, consistent status indicators, and Web Speech API integration.
- **Security & Workflow**: Features two-phase idle timeout, archive module with password-protected restore, processing time protocol, IP locking, login rate limiting, file upload type validation, XSS sanitization, and SameSite=strict session cookies.
- **Context Security Policy (STRICT)**: Prevents automatic context overlay bypass for sensitive field access.
- **Navigation Structure**: Organized into collapsible sections for `Štruktúra`, `Moje úlohy`, dynamic `Odkazy`, `Zmluvy`, `Reporty`, `Analytika`, and `Holding Dashboard`.
- **Dátová linka (OCR Module)**: Integrates Azure AI Document Intelligence for document processing, supporting bulk PDF upload, background processing, split-screen validation, and synonym confirmation.
- **Dynamic Parameter System (EAV Architecture)**: A 6-level hierarchy for dynamic configuration of contract fields and form generation, supported by AI synonym mapping.
- **A-Vízia Builder (Anti-Vata)**: Hierarchical product template builder managing folders, panels, and parameters, with blueprint layout stored in `ui_blueprints` table.
- **B-Vízia Builder (Anti-Vata)**: Subject template builder managing mega-blocks, panels, and parameters, with CRUD entirely through PUT blueprint layoutJson.
- **Rendering Engine (Blueprint-driven UI)**: `BlueprintRenderer` and `SubjectBlueprintSection` components render A-Vízia and B-Vízia blueprints respectively, supporting cross-pulling and graceful empty states.
- **OS Subjekt Module**: Supports 8 subtypes for "Ostatné subjekty" with full dynamic parameter coverage and `subject_picker` field type for cross-subject UID linking.
- **Web Routing Rules**: 1:N routing rules for OS Web/Digital Asset subjects, managed via `webRoutingRules` table and `WebRouterPanel` component.
- **AI Synonym Mapping**: Requires multiple confirmations for synonyms, tracking origin.
- **OCR Registry Audit**: Compares extracted company fields against stored registry snapshots, generating warnings and proposing synonyms.
- **Commission Brain & Calculation Engine**: Manages commission rates with temporal validity and various calculation types.
- **Settlement Sheets Module**: Handles settlement sheets and contracts, including locking and status workflows.
- **Client Management**: Multi-step registration, granular ownership, Bonita Point System, risk linking, and an AML module.
- **Foolproof System (`Blbuvzdornosť`)**: Incorporates data conflict alerts, transaction deduplication, Zod validation, subject-level authorization, and Slovak birth number (RČ) validation.
- **Subject UID Lifecycle**: UID assigned only upon contract progression to central processing phases; admin endpoint for merging duplicates.
- **GLOBAL UID INTEGRITY RULE**: Subject UID can only be assigned if RČ + name for individuals/SZČO, or companyName + IČO for companies/organizations are present, enforced in `storage.createSubject()` and direct `db.insert(subjects)` calls.
- **NO SHADOW SUBJECTS**: No shadow subjects are created for companies or partners; the subject register contains only real individuals and clients of companies.
- **Import UPSERT**: During Excel import, existing subjects with matching RČ/IČO are reused; new subjects are created without UID if sufficient data.
- **IČO Validation + Multi-Registry Lookup**: Global `validateSlovakICO()` with weighted checksum and MOD11, providing lookup across Slovak and Czech registries.
- **GDPR & Privacy System**: Privacy controls, household management, privacy blocks, and access consent logging.
- **Global Subject Relations System**: Universal cross-entity linking with temporal validity.
- **First Contract Rule (`Pravidlo Prvej Zmluvy`)**: Identifies and flags the first contract for an agent within a division.
- **Partner & Product Lifecycle (Media-Player System)**: A 6-state lifecycle for partners and sector products with inheritance.
- **90-Day Date Semaphore**: Highlights expired and upcoming dates for contracts and key subject fields.
- **Contract Parameter Versioning (`Stroj času`)**: Tracks and allows restoration of contract parameter value changes.
- **Holding Structure**: Unified ID system with dynamic country prefixes, extended states, and divisions.
- **Context Selector Overlay**: Full-screen blurred backdrop for state, company, and division selection.
- **Dashboard & Analytics**: Customizable overview with drag-and-drop widgets, KPI cards, dynamic filters, charts, and PDF summaries, including an admin-only Holding Dashboard.
- **PDF QR Codes**: All server-generated PDFs include a QR code linking to the subject URL and timestamp.
- **OCR Duplicate Guard**: Flags duplicate extracted values.
- **Network Module (Financie > Sieť)**: Manages network links and a 4-step approval process for guarantor transfer requests.
- **Moje úlohy module**: Displays pending approval tasks for the current user with dynamic notification badge.
- **Status Notification Templates**: Configurable email/SMS notifications based on contract status changes using smart tags.
- **Contract Status System**: Uses user-defined statuses and lifecycle phases; `statusId` is nullable.
- **Contract Processing Workflow**: Comprehensive workflow in the `/evidencia-zmluv` module for processing contracts, including creating `súpisky` and managing dispatch/receipt.
- **Business Opportunities Module**: Multi-record system for managing business opportunities with multi-division assignment, CRUD functionality via admin settings, and dynamic sidebar display.
- **Hromadný import stavov (Bulk Status Import Module)**: Multi-step Excel import for bulk updating contract statuses with configurable import types, session management, and detailed row-level results.
- **Holding Groups**: Auto-created and synced client groups for companies in `my_companies`, hidden and mutation-protected.
- **Holding Tree (ATK Hierarchický strom)**: Superadmin-only page (`/holding-strom`) displaying full subject hierarchy rooted at ATK, with recursive tree UI, search, and type badges.
- **Partner Groups**: Auto-created and synced client groups for partners, visually distinguished, and mutation-protected.
- **Registry Snapshots (Vzorová pravda)**: Immutable timestamped snapshots of external registry data, auto-saved or manually refreshed, serving as "ground truth" for AI contract audit and synonym learning.

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
- **Multer**: File uploads.
- **ExcelJS**: XLSX, CSV, JSON manipulation.
- **Sharp**: Image processing.
- **jsPDF**: Client-side PDF generation.
- **pdfkit**: Server-side PDF generation.
- **qrcode**: QR code generation.
- **@azure/ai-form-recognizer**: Azure AI Document Intelligence SDK.
- **express-rate-limit**: Login brute-force protection.
- **dompurify**: XSS sanitization.