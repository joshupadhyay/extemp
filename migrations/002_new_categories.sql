-- Add new categories for networking and leadership prompts
INSERT INTO category (slug, label, description) VALUES
  ('networking',  'Networking',  'Job interviews, behavioral questions, and networking conversations'),
  ('leadership',  'Leadership',  'Leading teams, making decisions, and developing others')
ON CONFLICT (slug) DO NOTHING;
