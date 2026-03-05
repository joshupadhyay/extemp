-- Add new categories and merge professional+networking into interviews
INSERT INTO category (slug, label, description) VALUES
  ('interviews',  'Interviews',  'Job interviews, behavioral questions, and networking conversations'),
  ('leadership',  'Leadership',  'Leading teams, making decisions, and developing others')
ON CONFLICT (slug) DO NOTHING;

-- Migrate existing prompts from old categories to interviews
UPDATE prompt
SET category_id = (SELECT id FROM category WHERE slug = 'interviews')
WHERE category_id IN (
  SELECT id FROM category WHERE slug IN ('professional', 'networking')
);
