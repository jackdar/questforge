CREATE TABLE accounts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Usernames are unique without regard to case, so "Alice" and "alice" cannot both exist.
CREATE UNIQUE INDEX accounts_username_lower_key ON accounts (lower(username));

-- The table keeps only a hash of each session token, so a copy of the table cannot log anyone in.
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_account_id_idx ON sessions (account_id);
