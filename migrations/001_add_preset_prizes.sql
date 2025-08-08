-- Add preset prizes table
CREATE TABLE IF NOT EXISTS coin_toss_preset_prizes (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX preset_prize_is_default_idx (is_default),
  INDEX preset_prize_is_active_idx (is_active)
);

-- Insert some sample prizes
INSERT IGNORE INTO coin_toss_preset_prizes (name, description, image_url, is_default, is_active) VALUES
  ('Mystery Prize Box', '🎁 A special mystery prize awaits the winner! Contact support to claim your reward.', 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop', TRUE, TRUE),
  ('Digital Badge', '🏆 Exclusive digital winner badge for your profile and bragging rights!', 'https://images.unsplash.com/photo-1556746834-f35b0a6c2a98?w=400&h=300&fit=crop', FALSE, TRUE),
  ('Coin Toss Champion', '👑 Recognition as the daily Coin Toss Champion with special privileges!', 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=300&fit=crop', FALSE, TRUE);