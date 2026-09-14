-- Additive blog publication fields. Existing posts remain private until explicitly published.
ALTER TABLE blog_posts ADD COLUMN category TEXT;
ALTER TABLE blog_posts ADD COLUMN author_name TEXT;
