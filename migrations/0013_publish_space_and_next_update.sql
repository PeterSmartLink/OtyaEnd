-- Publish a plain-language account and owner-experience update.
-- This is additive and safe to run once through the versioned Wrangler migration path.
INSERT OR IGNORE INTO blog_posts (
  slug, title, content, excerpt, category, author_name, published
) VALUES (
  'a-clearer-home-for-otya-accounts-and-next',
  'A clearer home for Otya accounts and Next',
  '# A clearer home for Otya accounts and Next

PeterSmart Link is simplifying where things belong.

**Otya Space** is for people using Otya. It is the place to manage an Otya account, sign-in methods, security, devices and supported recovery options. It does not try to act like an owner dashboard.

**Next** is the private owner intelligence app. It is where PeterSmart Link owner conversations, system health, approvals and protected operations belong. Next uses a verified owner device and keeps sensitive actions behind server-side checks and approval.

This separation makes the public experience easier to understand and keeps owner operations out of the browser. Your local Otya media stays device-first: Space does not claim that local playlists, history or private files are already cloud-synced.

We will keep publishing simple product updates and practical guides here as the experience improves.',
  'Otya Space is now focused on customer accounts and local data, while the private Next app becomes the owner-only operations experience.',
  'Product update',
  'PeterSmart Link',
  1
);
