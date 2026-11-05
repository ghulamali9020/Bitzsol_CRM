-- Block access through Supabase's public Data API (publishable/anon key).
-- The app reads and writes these tables through Prisma, using the postgres
-- role, which bypasses RLS. No policies are added on purpose: public roles
-- get no access to these tables.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pipeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadPhone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadCustomField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
