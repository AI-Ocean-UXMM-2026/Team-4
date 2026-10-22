CREATE TABLE ai_analysis_reports (
    business_id VARCHAR(80) PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    source_version INTEGER NOT NULL,
    report JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE ai_analysis_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_analysis_reports FROM anon, authenticated;
GRANT SELECT ON ai_analysis_reports TO authenticated;
CREATE POLICY business_member_read ON ai_analysis_reports
    FOR SELECT TO authenticated
    USING (public.bizflow_is_member(business_id));
