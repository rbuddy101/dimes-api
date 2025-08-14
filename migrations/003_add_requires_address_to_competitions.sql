ALTER TABLE coin_toss_competitions 
ADD COLUMN requires_address BOOLEAN DEFAULT FALSE AFTER prize_image_url;

-- Add index for the new field
CREATE INDEX idx_competitions_requires_address ON coin_toss_competitions(requires_address);