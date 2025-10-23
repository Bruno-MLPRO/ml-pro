-- Add policy for administrators to view all ML metrics
CREATE POLICY "Administrators can view all ML metrics"
ON mercado_livre_metrics
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

-- Also add administrators to other ML-related tables for consistency
CREATE POLICY "Administrators can view all ML accounts"
ON mercado_livre_accounts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all ML products"
ON mercado_livre_products
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all ML orders"
ON mercado_livre_orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all FULL stock"
ON mercado_livre_full_stock
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all item health"
ON mercado_livre_item_health
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all health history"
ON mercado_livre_health_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Administrators can view all product ads data"
ON mercado_livre_product_ads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));