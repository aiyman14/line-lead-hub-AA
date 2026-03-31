SELECT auth.uid(); -- no-op, using this to delete auth user via admin API
DELETE FROM auth.users WHERE id = '415deca9-289f-404c-b376-1b4dc33da232';
