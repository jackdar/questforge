-- The xp is the progress of the character into its current level. shared/leveling.js sets the xp for each level.
ALTER TABLE characters ADD COLUMN xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0);
