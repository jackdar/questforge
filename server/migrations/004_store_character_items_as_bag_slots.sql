-- Each row is now one stack in one bag slot, so that the player can arrange the bags.
-- Rows from before this change take the slots 0, 1, 2, and so on, in item order.
ALTER TABLE character_items ADD COLUMN slot integer;

UPDATE character_items
SET slot = numbered.slot
FROM (
    SELECT character_id, item_id, ROW_NUMBER() OVER (PARTITION BY character_id ORDER BY item_id) - 1 AS slot
    FROM character_items
) AS numbered
WHERE character_items.character_id = numbered.character_id AND character_items.item_id = numbered.item_id;

ALTER TABLE character_items ALTER COLUMN slot SET NOT NULL;
ALTER TABLE character_items ADD CONSTRAINT character_items_slot_check CHECK (slot >= 0);
ALTER TABLE character_items DROP CONSTRAINT character_items_pkey;
ALTER TABLE character_items ADD PRIMARY KEY (character_id, slot);
