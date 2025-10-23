-- Fix RLS policies to include administrators

-- Table: mercado_livre_campaigns
DROP POLICY IF EXISTS "Managers can view all campaigns" ON mercado_livre_campaigns;

CREATE POLICY "Managers and admins can view all campaigns" ON mercado_livre_campaigns
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

-- Table: mercado_livre_orders
DROP POLICY IF EXISTS "Managers can view all ML orders" ON mercado_livre_orders;

CREATE POLICY "Managers and admins can view all ML orders" ON mercado_livre_orders
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

-- Table: mercado_livre_products
DROP POLICY IF EXISTS "Managers can view all ML products" ON mercado_livre_products;

CREATE POLICY "Managers and admins can view all ML products" ON mercado_livre_products
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'administrator'::app_role)
  );