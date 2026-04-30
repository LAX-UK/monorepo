# Auction System - Visual Diagrams

Updated: April 27, 2026

These diagrams can be rendered in any Mermaid-compatible viewer.

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        WEB["Next.js Web App<br/>(apps/web)"]
    end

    subgraph Backend["Backend Services"]
        API["Hono API<br/>(apps/api)<br/>Port 8787"]
        WS["Socket.IO Gateway<br/>(apps/ws)<br/>Port 8788"]
    end

    subgraph Data["Data + Async"]
        PG[("PostgreSQL<br/>Drizzle ORM")]
        REDIS[("Redis<br/>Cache + Pub/Sub")]
        BULL["BullMQ queue<br/>lot-lifecycle"]
    end

    subgraph External["Optional integrations"]
        XERO["Xero<br/>OAuth + invoices + webhooks"]
    end

    WEB -->|"REST/RPC JSON<br/>Better Auth cookies"| API
    WEB <-->|"Socket.IO"| WS
    API -->|"Drizzle queries"| PG
    API -->|"cache, idempotency,<br/>pub/sub"| REDIS
    API -->|"schedule activate/end jobs"| BULL
    BULL -->|"jobs use Redis connection"| REDIS
    WS -->|"PSUBSCRIBE<br/>lot:*:events<br/>user:*:notifications"| REDIS
    API <-->|"hosted invoice checkout<br/>sync paid invoices"| XERO
```

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ SALE : "creates"
    USER ||--o{ LOT : "sells"
    USER ||--o{ LOT : "wins"
    USER ||--o{ BID : "places"
    USER ||--o{ WATCHLIST : "watches lots"
    USER ||--o{ SALE_FOLLOW : "follows sales"
    USER ||--o{ ITEM_SUBMISSION : "submits"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ PAYMENT : "pays/receives"

    CATEGORY ||--o{ SALE : "theme"
    CATEGORY ||--o{ LOT : "classifies"
    CATEGORY ||--o{ CATEGORY : "parent"

    SALE ||--o{ LOT : "contains"
    SALE ||--o{ SALE_FOLLOW : "followed by"
    LOT ||--o{ BID : "has"
    LOT ||--o{ WATCHLIST : "watched by"
    LOT ||--o{ NOTIFICATION : "about"
    LOT ||--o{ PAYMENT : "settled by"
    ITEM_SUBMISSION }o--o| LOT : "converted_lot"
    PAYMENT ||--o| PAYMENT_EXTERNAL_REF : "provider ref"

    SALE {
        uuid id PK
        text title
        enum delivery_mode
        enum status
        uuid category_id FK
        timestamp start_time
        timestamp end_time
        timestamp preview_start_time
        text stream_url
        text location_fields
        numeric buyer_premium_rate
    }

    LOT {
        uuid id PK
        uuid sale_id FK
        integer lot_number
        text seller_id FK
        text title
        uuid category_id FK
        enum auction_type
        numeric starting_price
        numeric reserve_price
        numeric buy_now_price
        numeric current_price
        numeric min_bid_increment
        numeric dutch_decrement_amount
        integer dutch_decrement_interval_ms
        enum status
        text winner_id FK
        jsonb marketing_details
    }

    BID {
        uuid id PK
        uuid lot_id FK
        text bidder_id FK
        numeric amount
        boolean is_winning
        boolean is_auto_bid
        numeric max_auto_bid_amount
    }

    PAYMENT {
        uuid id PK
        uuid lot_id FK
        text buyer_id FK
        text seller_id FK
        numeric amount
        numeric platform_fee
        text stripe_payment_intent_id
        enum status
    }
```

## 3. Lot Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> draft: POST /lots or POST /sales with nested lots

    draft --> scheduled: POST /lots/:id/publish
    draft --> scheduled: POST /sales/:id/publish
    draft --> cancelled: POST /lots/:id/cancel or sale cancel

    scheduled --> active: BullMQ activate job or 10s reconciliation
    scheduled --> cancelled: cancel endpoint

    active --> active: English/buy-it-now bid extends endTime by 30s
    active --> active: Dutch lifecycle decrements currentPrice
    active --> ended: BullMQ end job or 10s reconciliation
    active --> ended: Dutch accepted bid
    active --> ended: Buy-it-now price met
    active --> cancelled: cancel endpoint

    ended --> [*]
    cancelled --> [*]

    note right of ended
        Ending uses strategy.determineWinner()
        and enforces reservePrice before winnerId.
    end note
```

## 4. Sale Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft: POST /sales
    draft --> scheduled: POST /sales/:id/publish
    draft --> cancelled: POST /sales/:id/cancel

    scheduled --> active: any child lot active
    scheduled --> ended: onsite mark-ended
    scheduled --> cancelled: POST /sales/:id/cancel

    active --> ended: all child lots ended/cancelled
    active --> ended: onsite mark-ended
    active --> cancelled: POST /sales/:id/cancel

    ended --> [*]
    cancelled --> [*]
```

## 5. Bid Placement Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Hono API
    participant S as Lot Strategy
    participant DB as PostgreSQL
    participant R as Redis
    participant WS as Socket.IO

    C->>API: POST /bids { lotId, amount, maxAutoBidAmount? }
    API->>R: GET idempotency:bid:user:key
    API->>DB: BEGIN + SELECT lot FOR UPDATE
    API->>API: Check active, sale mode, seller guard
    API->>S: validateBid(lot, bid)
    S-->>API: OK / Error
    API->>DB: INSERT bid
    opt English / buy-it-now proxy bidding
        API->>DB: aggregate bidder ceilings
        API->>DB: insert proxy auto-bids until ceiling exhausted
    end
    API->>DB: mark winning bid + update lot.current_price
    opt Anti-sniping extension
        API->>DB: update lot.end_time
    end
    opt Dutch accepted or buy-now met
        API->>DB: set winner + update status ended
    end
    API->>DB: COMMIT
    API->>R: SET lot:{id}:currentPrice
    API->>R: PUBLISH lot:{id}:events
    R->>WS: PSUBSCRIBE message
    WS->>C: bidUpdate / lotExtended / lotEnded
    API-->>C: 201 { data: bid }
```

## 6. Realtime Fan-out

```mermaid
flowchart LR
    subgraph API["apps/api"]
        BID["BidService"]
        NOTIFY["NotificationService"]
        REDIS_SENDER["RedisNotificationSender"]
        USER_NOTIFY["NotificationDispatcher"]
    end

    subgraph Redis
        LOT_EVENTS[("lot:{lotId}:events")]
        USER_EVENTS[("user:{userId}:notifications")]
    end

    subgraph WS["apps/ws"]
        BRIDGE["bridgeRedisToSockets"]
        SIO["Socket.IO Server"]
    end

    subgraph Rooms["Socket rooms"]
        LOT_ROOM["lot:{lotId}"]
        USER_ROOM["user:{userId}"]
    end

    BID --> NOTIFY --> REDIS_SENDER --> LOT_EVENTS
    USER_NOTIFY --> USER_EVENTS
    LOT_EVENTS --> BRIDGE
    USER_EVENTS --> BRIDGE
    BRIDGE --> SIO
    SIO --> LOT_ROOM
    SIO --> USER_ROOM
```

## 7. Payment and Xero Flow

```mermaid
flowchart TB
    END["Lot ended with winnerId"] --> PAY["POST /payments { lotId }"]
    PAY --> CHECK1{"buyer is winner?"}
    CHECK1 -->|No| ERR1["403"]
    CHECK1 -->|Yes| CHECK2{"lot.status = ended?"}
    CHECK2 -->|No| ERR2["400"]
    CHECK2 -->|Yes| CALC["amount = hammer + buyer premium<br/>platformFee = 5% of amount"]
    CALC --> ROW["Create/reuse pending payment"]
    ROW --> XCONF{"Xero configured + connected?"}
    XCONF -->|No| MANUAL["Return { paymentId, clientSecret: null, checkoutUrl: null }"]
    XCONF -->|Yes| INVOICE["Create/reuse authorised Xero invoice"]
    INVOICE --> URL["Return checkoutUrl"]
    URL --> WEBHOOK["POST /webhooks/xero or admin xero-sync"]
    WEBHOOK --> CAPTURED["local payment.status = captured"]
    MANUAL --> ADMIN["Admin may POST /payments/:id/capture or /refund"]
```

## 8. Public API Quick Reference

```mermaid
flowchart LR
    subgraph Public
        L1["GET /lots"]
        L2["GET /lots/:id"]
        L3["GET /lots/:id/bids"]
        L4["GET /lots/archive/summary"]
        S1["GET /sales"]
        S2["GET /sales/:id"]
        S3["GET /sales/:id/lots"]
        C1["GET /categories"]
    end

    subgraph Authenticated
        B1["POST /bids"]
        P1["POST /payments"]
        SF1["POST/DELETE /sales/:id/follow"]
        U1["GET/PATCH /users/me/*"]
        SUB1["/submissions"]
    end

    subgraph Admin
        A1["POST /lots"]
        A2["POST /lots/:id/publish"]
        A3["POST /lots/:id/cancel"]
        A4["POST /sales"]
        A5["POST /sales/:id/publish"]
        A6["POST /sales/:id/cancel"]
        A7["/admin/*"]
    end

    subgraph Auth
        AUTH["/api/auth/* Better Auth"]
    end
```
