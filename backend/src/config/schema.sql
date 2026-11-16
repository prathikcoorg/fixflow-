
BEGIN;

CREATE TABLE organizations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('resident', 'technician', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, id),
    UNIQUE (organization_id, email)
);

CREATE TABLE maintenance_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id),
    reporter_id BIGINT NOT NULL,
    assigned_technician_id BIGINT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(60),
    location VARCHAR(200) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, id),

    CONSTRAINT fk_request_reporter
        FOREIGN KEY (organization_id, reporter_id)
        REFERENCES users(organization_id, id),

    CONSTRAINT fk_request_technician
        FOREIGN KEY (organization_id, assigned_technician_id)
        REFERENCES users(organization_id, id)
);

CREATE TABLE request_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    request_id BIGINT NOT NULL,
    changed_by BIGINT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL
        CHECK (new_status IN ('open', 'in_progress', 'resolved', 'closed')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (organization_id, request_id)
        REFERENCES maintenance_requests(organization_id, id),

    FOREIGN KEY (organization_id, changed_by)
        REFERENCES users(organization_id, id)
);

CREATE INDEX idx_users_org_role
    ON users(organization_id, role);

CREATE INDEX idx_requests_org_status
    ON maintenance_requests(organization_id, status);

CREATE INDEX idx_requests_org_created
    ON maintenance_requests(organization_id, created_at DESC);

CREATE INDEX idx_requests_assigned
    ON maintenance_requests(organization_id, assigned_technician_id);

CREATE INDEX idx_history_request
    ON request_status_history(organization_id, request_id, created_at);

COMMIT;
