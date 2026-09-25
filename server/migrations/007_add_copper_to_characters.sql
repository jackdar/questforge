-- All the money of a character, as a whole number of copper. 1 silver is 100 copper, and 1 gold is 100 silver.
ALTER TABLE characters ADD COLUMN copper integer NOT NULL DEFAULT 0 CHECK (copper >= 0);
