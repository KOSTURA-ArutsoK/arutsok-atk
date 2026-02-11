# ArutsoK CRM

## Overview
ArutsoK CRM is a multi-tenant Customer Relationship Management and commission tracking system designed for industries such as financial services, real estate, and defense/weapons trade. It aims to provide robust client management, partner relationship tracking, and detailed commission calculations with a strong focus on data integrity, auditability, and temporal validity. The project's vision is to be a comprehensive and secure platform for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system is built on a modern full-stack architecture:
- **Frontend**: React with Vite, styled using Tailwind CSS and `shadcn/ui` components for a consistent UI. `wouter` is used for client-side routing.
- **Backend**: Express.js handles API requests, serving both frontend assets and API endpoints.
- **Database**: PostgreSQL with Drizzle ORM for type-safe database interactions, hosted on Neon.
- **Authentication**: Replit OIDC Auth integration, maintaining separate user tables for authentication (`users`) and application-specific roles/permissions (`app_users`).
- **Deployment**: Frontend and Backend are served together on port 5000.
- **Data Integrity**: A core principle is "no overwriting"; all updates archive original records, creating an immutable history.
- **Unique Identifiers**: A 12-digit UID (`01-CC-SSS-NNN NNN NNN NNN`) is generated atomically using a `global_counters` table.
- **Soft Deletion**: Entities like Companies and Partners are soft-deleted using an `isDeleted` flag, accompanied by an audit trail (deletedBy, deletedAt, deletedFromIp).
- **Rich Text Editing**: Tiptap editor is integrated for rich text notes, storing content as HTML.
- **Document Management**: A dual document system (official and work documents) allows file uploads to local storage (`uploads/`) with metadata stored in the database. Logo management includes primary/archived states.
- **Context Switching**: The application supports switching between active states (e.g., geographic regions) and companies, persisted per `app_user`.
- **Temporal Validity**: Many tables (`companyOfficers`, `partnerContacts`, `companyContacts`, `commission_schemes`) incorporate `validFrom`, `validTo`, and `isActive` fields for managing time-sensitive data. An hourly cron job automatically archives expired bindings.
- **Audit Logging**: A comprehensive audit log (`audit_logs` table) tracks user actions, module, entity, data changes, processing time, and IP address for all mutating routes.
- **Role-Based Access Control (RBAC)**: A granular RBAC system uses `permission_groups` and a `permissions` matrix (module x action) to control access to different parts of the application.
- **Workflow Management**: The WAME protocol tracks form editing duration (`processingTimeSec`) for all create/edit forms.

## External Dependencies
- **Replit OIDC Auth**: Used for user authentication and session management.
- **PostgreSQL (Neon)**: The primary relational database.
- **Drizzle ORM**: Used for database interactions.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **wouter**: Client-side routing library.
- **Tiptap**: Rich text editor.
- **Multer**: Node.js middleware for handling multipart/form-data, primarily used for file uploads.