-- One row for each quest that a character has accepted. A row with the status 'completed' is the record that the
-- character completed the quest. The quest id refers to QUESTS in shared/quests.js. The progress holds the kill
-- count of each kill objective, by objective index.
CREATE TABLE character_quests (
    character_id bigint NOT NULL REFERENCES characters ON DELETE CASCADE,
    quest_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'completed')),
    progress jsonb NOT NULL DEFAULT '[]',
    accepted_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    PRIMARY KEY (character_id, quest_id)
);
