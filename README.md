# Watchtower Scheduling

Watchtower Scheduling is a web-based academic planning tool designed for Hunter College students. The system automatically generates personalized, conflict-free course schedules by integrating the user's course history, degree requirements, prerequisite rules, and availability constraints. Its goal is to reduce the manual effort students spend cross-referencing DegreeWorks, course listings, and personal schedules when planning for a semester.

## Core Features

- DegreeWorks audit ingestion via PDF upload with user confirmation
- Structured representation of remaining degree requirements
- Prerequisite-aware course filtering
- Support for scheduling preferences (blocked days/times, credit limits, modality)
- Generation of multiple valid schedule options with clear warnings and explanations

## System Architecture

- **Frontend:** Web-based user interface for uploading audits, confirming requirements, and viewing schedules
- **Backend API:** Handles data ingestion, validation, and schedule generation requests
- **Database:** Relational database storing courses, sections, prerequisites, and requirement structures
- **Scheduling Engine:** Constraint-based solver that generates valid schedule combinations

## Tech Stack

- **Frontend:** React / Next.js
- **Backend:** Java
- **Database:** PostgreSQL
- **Scheduling Logic:** Constraint satisfaction approach (e.g., OR-Tools)
- **Data Processing:** PDF text extraction and structured parsing

## Project Scope

This project is intentionally scoped for a semester-long academic build:
- Hunter College only
- Limited set of majors and degree requirements
- Focus on hard prerequisites with warnings for conditional cases
- Single-semester schedule generation

The system is designed to support academic planning and does not replace official enrollment systems.

## Architecture Docs

- Class diagram for the Python domain model: `docs/architecture/models-class-diagram.md`
