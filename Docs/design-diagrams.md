# Wina Bwangu Design Diagrams

These Mermaid diagrams were prepared by our group and can be rendered in Mermaid Live, GitHub or a Markdown editor that supports Mermaid.

## Conceptual model

```mermaid
flowchart LR
  User[Authenticated User] --> Booth[Booth Operations]
  User --> Tx[Transaction Processing]
  Booth --> Service[Financial Service]
  Tx --> Customer[Customer Identifier]
  Tx --> Report[Dashboard and Reports]
  Booth --> Report
  Service --> Report
```

## Use-case diagram

```mermaid
flowchart LR
  Admin((System Administrator))
  Manager((Admin Agent))
  Agent((Agent))
  Login[Sign in / sign out]
  Process[Process transaction]
  View[View dashboard and activity]
  Configure[Manage booths and services]
  Users[Manage users and roles]
  Receipt[Print receipt]
  Admin --> Login
  Manager --> Login
  Agent --> Login
  Admin --> Process
  Manager --> Process
  Agent --> Process
  Admin --> View
  Manager --> View
  Agent --> View
  Admin --> Configure
  Admin --> Users
  Admin --> Receipt
  Manager --> Receipt
  Agent --> Receipt
```

## Entity relationship diagram

```mermaid
erDiagram
  USERS {
    int id PK
    string username UK
    string email UK
    string password_hash
    string role
    string assigned_booths
    string assigned_services
    string status
  }
  BOOTHS {
    int id PK
    string booth UK
    string location
  }
  SERVICES {
    int id PK
    string service UK
    decimal monthly_transaction_limit
    decimal revenue_rate
    string identifier_type
  }
  BOOTH_SERVICES {
    int booth_id PK,FK
    int service_id PK,FK
  }
  TRANSACTIONS {
    int id PK
    string transaction_id UK
    string transaction_type
    int booth_id FK
    int service_id FK
    decimal transaction_amount
    decimal transaction_tax
    decimal transaction_amount_after_tax
    decimal transaction_revenue
    datetime transaction_date
  }
  BOOTHS ||--o{ BOOTH_SERVICES : offers
  SERVICES ||--o{ BOOTH_SERVICES : available_at
  BOOTHS ||--o{ TRANSACTIONS : records
  SERVICES ||--o{ TRANSACTIONS : uses
```
