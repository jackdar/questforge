-- The place where the character last stood, so that the character logs back in there. The height comes from the
-- ground of the map, so it is not saved. The columns are empty for a character that has not played yet.
ALTER TABLE characters
    ADD COLUMN map_id text,
    ADD COLUMN position_x double precision,
    ADD COLUMN position_z double precision,
    ADD COLUMN rotation double precision;
