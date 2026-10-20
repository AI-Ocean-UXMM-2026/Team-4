"""Opt-in checks against a migrated Supabase project, always rolled back.

Needs two already verified test Auth users. Never synthesizes email verification.
"""
import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.connection import make_engine


def test_live_supabase_business_and_storage_rls():
    url = os.getenv("BIZFLOW_RLS_TEST_DATABASE_URL")
    user_a, user_b = os.getenv("BIZFLOW_RLS_TEST_USER_A"), os.getenv("BIZFLOW_RLS_TEST_USER_B")
    if not all((url, user_a, user_b)):
        pytest.skip("Live Supabase project and two verified test-user UUIDs are not configured")
    engine = make_engine(url)
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            for user_id in (user_a, user_b):
                confirmed = connection.scalar(text("SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = CAST(:id AS uuid)"), {"id": user_id})
                assert confirmed, "Both live test users must already have verified email"
                connection.execute(text("INSERT INTO public.users(id,full_name) VALUES (:id,'RLS test') ON CONFLICT(id) DO UPDATE SET full_name='RLS test'"), {"id": user_id})
            for business_id, owner in ((a, user_a), (b, user_b)):
                connection.execute(text("INSERT INTO public.businesses(id,name,version,industry,city,currency) VALUES (:id,'RLS fixture',0,'Retail','Yangon','MMK')"), {"id": business_id})
                connection.execute(text("INSERT INTO public.business_memberships(business_id,user_id) VALUES (:id,:owner)"), {"id": business_id, "owner": owner})
                connection.execute(text("INSERT INTO storage.objects(bucket_id,name) VALUES ('bizflow-uploads',:name)"), {"name": business_id + "/rls-test.txt"})
            connection.exec_driver_sql("SET LOCAL ROLE authenticated")
            for user_id, own, other in ((user_a, a, b), (user_b, b, a)):
                connection.execute(text("SELECT set_config('request.jwt.claim.sub', :id, true)"), {"id": user_id})
                assert connection.scalar(text("SELECT count(*) FROM public.businesses WHERE id=:own"), {"own": own}) == 1
                assert connection.scalar(text("SELECT count(*) FROM public.businesses WHERE id=:other"), {"other": other}) == 0
                assert connection.scalar(text("SELECT count(*) FROM storage.objects WHERE bucket_id='bizflow-uploads' AND name=:name"), {"name": own + "/rls-test.txt"}) == 1
                assert connection.scalar(text("SELECT count(*) FROM storage.objects WHERE bucket_id='bizflow-uploads' AND name=:name"), {"name": other + "/rls-test.txt"}) == 0
                for query, parameters in [
                    ("UPDATE public.businesses SET name='forbidden' WHERE id=:id", {"id": other}),
                    ("SELECT * FROM public.workbook_sources", {}),
                    ("INSERT INTO storage.objects(bucket_id,name) VALUES ('bizflow-uploads',:name)", {"name": other + "/forbidden.txt"}),
                ]:
                    with connection.begin_nested() as savepoint:
                        try:
                            response = connection.execute(text(query), parameters)
                            assert response.rowcount == 0, "Unauthorized SQL unexpectedly succeeded"
                        except DBAPIError:
                            savepoint.rollback()
                assert connection.execute(text("DELETE FROM storage.objects WHERE bucket_id='bizflow-uploads' AND name=:name"), {"name": other + "/rls-test.txt"}).rowcount == 0
        finally:
            transaction.rollback()
    engine.dispose()
