-- Add requires_address field to coin_toss_preset_prizes table
ALTER TABLE coin_toss_preset_prizes ADD COLUMN requires_address BOOLEAN DEFAULT FALSE;

-- Add index for the new field
CREATE INDEX preset_prize_requires_address_idx ON coin_toss_preset_prizes (requires_address);