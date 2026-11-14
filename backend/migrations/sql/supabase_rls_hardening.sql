-- ==============================================================================
-- PHARMATRIX PRODUCTION DATABASE SECURITY HARDENING: ROW LEVEL SECURITY (RLS)
-- Document Reference: PMX-SEC-RLS-2026
-- ==============================================================================
--
-- Objective:
-- Mitigate data exposure risk if Supabase PostgREST endpoints are ever exposed
-- to public clients. Ensure that the service role (used by FastAPI backend)
-- maintains full operational access while public/anon access is strictly blocked.
--
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) on all core application tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pharmacy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS distributor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hospital_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pickup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouse_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouse_intake_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disposal_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disposal_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disposal_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pricing_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_pricing_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS razorpay_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuration_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuration_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuration_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS operational_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Grant full access to the backend Service Role (Superuser / FastAPI Backend)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'users', 'customers', 'customer_locations', 'customer_documents',
        'pharmacy_profiles', 'distributor_profiles', 'hospital_profiles', 'clinic_profiles',
        'drivers', 'vehicles', 'driver_vehicle_assignments', 'warehouses', 'routes',
        'route_stops', 'pickups', 'pickup_events', 'warehouse_intakes', 'warehouse_intake_items',
        'facilities', 'disposal_shipments', 'disposal_shipment_items', 'disposal_certificates',
        'notifications', 'device_tokens', 'pricing_plans', 'pricing_plan_versions',
        'customer_pricing_assignments', 'invoices', 'invoice_line_items', 'payments',
        'razorpay_orders', 'razorpay_webhook_events', 'audit_logs', 'configuration_parameters',
        'configuration_versions', 'configuration_changes', 'configuration_audit',
        'operational_exceptions', 'whatsapp_templates', 'user_consents', 'marketing_preferences'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS service_role_full_access ON %I;', tbl);
        EXECUTE format('CREATE POLICY service_role_full_access ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- 3. Explicitly block all Direct Anonymous Access
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'users', 'customers', 'customer_locations', 'customer_documents',
        'pharmacy_profiles', 'distributor_profiles', 'hospital_profiles', 'clinic_profiles',
        'drivers', 'vehicles', 'driver_vehicle_assignments', 'warehouses', 'routes',
        'route_stops', 'pickups', 'pickup_events', 'warehouse_intakes', 'warehouse_intake_items',
        'facilities', 'disposal_shipments', 'disposal_shipment_items', 'disposal_certificates',
        'notifications', 'device_tokens', 'pricing_plans', 'pricing_plan_versions',
        'customer_pricing_assignments', 'invoices', 'invoice_line_items', 'payments',
        'razorpay_orders', 'razorpay_webhook_events', 'audit_logs', 'configuration_parameters',
        'configuration_versions', 'configuration_changes', 'configuration_audit',
        'operational_exceptions', 'whatsapp_templates', 'user_consents', 'marketing_preferences'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS anon_no_access ON %I;', tbl);
        EXECUTE format('CREATE POLICY anon_no_access ON %I FOR ALL TO anon USING (false);', tbl);
    END LOOP;
END $$;

-- 4. Secure Storage Buckets
-- Ensure all buckets (customer-documents, pickup-proofs, disposal-certificates) are marked PRIVATE:
UPDATE storage.buckets SET public = false WHERE id IN ('customer-documents', 'pickup-proofs', 'disposal-certificates');

