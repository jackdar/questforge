-- One row holds the total quantity of one item for one character. The item id refers to ITEMS in shared/items.js,
-- because the game data lives in code and not in the database.
CREATE TABLE character_items (
    character_id bigint NOT NULL REFERENCES characters ON DELETE CASCADE,
    item_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity >= 1),
    PRIMARY KEY (character_id, item_id)
);
