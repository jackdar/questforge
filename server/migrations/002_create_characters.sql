CREATE TABLE characters (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts ON DELETE CASCADE,
    name text NOT NULL,
    faction text NOT NULL,
    level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Character names are unique on the server without regard to case.
CREATE UNIQUE INDEX characters_name_lower_key ON characters (lower(name));

CREATE INDEX characters_account_id_idx ON characters (account_id);
