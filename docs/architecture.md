# Employee Safety & Response System - Architecture Documentation

This document explicitly defines the system architecture, sequence flows, and entity-relationship models for the Employee Safety & Response System based on the system proposal.

## 1. Entity-Relationship (ER) Diagram

This diagram maps precisely to the SQLAlchemy Domain Models defined in `app/models/domain_models.py`.

```mermaid
erDiagram
    Department ||--o{ User : "has many (employees)"
    User ||--o| Department : "manager of (optional)"
    Event ||--o{ SafetyResponse : "receives"
    User ||--o{ SafetyResponse : "submits"
    User ||--o{ NotificationLog : "receives"
    Event ||--o{ NotificationLog : "triggers"

    User {
        int id PK
        string employee_no UK
        string name
        string email
        int department_id FK
        enum role "admin, supervisor, employee"
        boolean is_active
    }

    Department {
        int id PK
        string name
        int manager_id FK
    }

    Event {
        int id PK
        string title
        string description
        enum event_type "Earthquake, Fire, Test"
        enum status "active, closed"
        datetime created_at
    }

    SafetyResponse {
        int id PK
        int event_id FK
        int user_id FK
        enum status "safe, need_help"
        float location_lat
        float location_lng
        string comment
        datetime reported_at
    }

    NotificationLog {
        int id PK
        int event_id FK
        int user_id FK
        string channel "FCM, SMS"
        string status "sent, failed"
        datetime sent_at
    }
```

## 2. System Architecture Diagram

This component diagram visualizes the GCP-based Serverless Modular Monolith design.

```mermaid
graph TD
    classDef gcp fill:#e3f2fd,stroke:#4285f4,stroke-width:2px;
    classDef ext fill:#fff3e0,stroke:#fbc02d,stroke-width:2px;
    classDef db fill:#e8f5e9,stroke:#ef6c00,stroke-width:2px;

    Client[PWA (Employees / Supervisors / Admins)]

    subgraph GCP [Google Cloud Platform asia-east1]
        CR[Cloud Run Container]:::gcp
        Sched[APScheduler]:::gcp
        
        CR --- Sched

        subgraph Modules [Modular Monolith (FastAPI)]
            Auth[Auth Module]
            EventMod[Event Module]
            ReportMod[Report Module]
            NotifMod[Notification Module]
            UserMod[User Module]
        end
        CR --- Modules

        PubSub{Cloud Pub/Sub}:::gcp
        SQL[(Cloud SQL / PostgreSQL)]:::db
        Redis[(Cloud Memorystore / Redis)]:::db
    end

    Client -- HTTPS --> CR
    Client -- HTTPS --> Firebase[FCM Push]:::ext

    EventMod -- Publish --> PubSub
    ReportMod -- Publish (Buffer) --> PubSub
    Sched -- Publish (Reminder) --> PubSub
    
    PubSub -- Async Trigger --> NotifMod
    PubSub -- Async Buffer Write --> ReportMod

    ReportMod -- Sync Read/Write --> SQL
    NotifMod -- Read Targets --> SQL
    ReportMod -- Update Dash Stats --> Redis

    NotifMod -- Push API --> Firebase
    NotifMod -- Fallback API --> Twilio[Twilio SMS]:::ext
    NotifMod -- On Demand --> SendGrid[SendGrid Email]:::ext
```

## 3. Sequence Diagrams

### Flow A: Event Creation and Notification Dispatch

```mermaid
sequenceDiagram
    actor Admin
    participant API as FastAPI (EventModule)
    participant DB as Cloud SQL
    participant PubSub as Cloud Pub/Sub
    participant Worker as NotificationModule
    participant FCM as Firebase (FCM)
    participant SMS as Twilio (Fallback)

    Admin->>API: POST /events (Create Event)
    API->>DB: INSERT into events
    DB-->>API: Transaction Committed
    API->>PubSub: Publish Event Created Message
    API-->>Admin: 201 Created (Fast Response)

    %% Async Phase
    PubSub-)Worker: Push Message to Subscriber
    Worker->>DB: Query target users for this Event
    DB-->>Worker: Return User list
    Worker->>FCM: Dispatch Push Notifications
    alt FCM Delivery Failed
        FCM-->>Worker: Error / Invalid Token
        Worker->>SMS: Dispatch SMS Fallback
    end
    Worker->>DB: INSERT into notification_logs
    Worker-->>PubSub: ACK Message
```

### Flow B: Employee Safety Reporting

```mermaid
sequenceDiagram
    actor Employee
    participant API as FastAPI (ReportModule)
    participant PubSub as Cloud Pub/Sub
    participant Worker as ReportWorker
    participant DB as Cloud SQL
    participant Cache as Redis

    Employee->>API: POST /reports (Status: Safe / Need Help)
    API->>PubSub: Publish Report Payload
    API-->>Employee: 202 Accepted (Instant Response)

    %% Async Processing
    PubSub-)Worker: Push Message to Subscriber
    Worker->>DB: INSERT into safety_responses
    DB-->>Worker: DB Write Confirmed
    Worker->>Cache: INCR Event Status Counts
    Worker-->>PubSub: ACK Message
```

---
