-- Optional private profile photo. Existing profiles retain their initials fallback.
-- Existing users RLS policies continue to restrict reads to the verified owner.
ALTER TABLE users ADD COLUMN avatar_data_url TEXT;
