-- Migration: Create subscription_payments table and related structures
-- Description: Manage payment tracking for student subscriptions

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.student_subscriptions(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  paid_date DATE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('pix', 'boleto', 'credit_card', 'debit_card', 'cash', 'bank_transfer', 'other')),
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_subscription_payments_subscription_id ON public.subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_due_date ON public.subscription_payments(due_date);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX idx_subscription_payments_paid_date ON public.subscription_payments(paid_date);

-- Add trigger for updated_at
CREATE TRIGGER set_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to automatically create payment schedule when subscription is created
CREATE OR REPLACE FUNCTION public.create_payment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  payment_date DATE;
  months_count INTEGER;
  i INTEGER;
BEGIN
  -- Calculate number of months based on plan duration
  SELECT duration_months INTO months_count
  FROM public.plans
  WHERE id = NEW.plan_id;

  -- Create payment entries for each month
  FOR i IN 0..(months_count - 1) LOOP
    payment_date := NEW.start_date + (i || ' months')::INTERVAL;
    
    INSERT INTO public.subscription_payments (
      subscription_id,
      due_date,
      amount,
      status
    ) VALUES (
      NEW.id,
      payment_date,
      NEW.monthly_price,
      CASE 
        WHEN payment_date < CURRENT_DATE THEN 'overdue'
        ELSE 'pending'
      END
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create payment schedule on subscription creation
CREATE TRIGGER trigger_create_payment_schedule
  AFTER INSERT ON public.student_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payment_schedule();

-- Function to automatically update overdue status
CREATE OR REPLACE FUNCTION public.update_overdue_payments()
RETURNS void AS $$
BEGIN
  UPDATE public.subscription_payments
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to create cash flow entry when payment is marked as paid
CREATE OR REPLACE FUNCTION public.create_cash_flow_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  plan_name TEXT;
BEGIN
  -- Only create cash flow entry when payment is marked as paid
  IF NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    -- Get student and plan names for description
    SELECT 
      p.full_name,
      pl.name
    INTO student_name, plan_name
    FROM public.student_subscriptions ss
    JOIN public.profiles p ON ss.student_id = p.id
    JOIN public.plans pl ON ss.plan_id = pl.id
    WHERE ss.id = NEW.subscription_id;

    -- Create cash flow entry
    INSERT INTO public.cash_flow_entries (
      type,
      category_id,
      description,
      amount,
      entry_date,
      related_to_type,
      related_to_id,
      payment_status
    ) VALUES (
      'income',
      (SELECT id FROM public.cash_flow_categories WHERE name = 'Assinaturas de Alunos' AND type = 'income' LIMIT 1),
      'Pagamento de assinatura - ' || student_name || ' - ' || plan_name,
      NEW.amount,
      COALESCE(NEW.paid_date, CURRENT_DATE),
      'student_subscription',
      NEW.subscription_id,
      'confirmed'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create cash flow entry when payment is paid
CREATE TRIGGER trigger_create_cash_flow_from_payment
  AFTER INSERT OR UPDATE OF status, paid_date ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cash_flow_from_payment();

-- Add RLS policies
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Administrators can view all payments
CREATE POLICY "Administrators can view all subscription payments"
  ON public.subscription_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Managers can view payments of their students
CREATE POLICY "Managers can view payments of their students"
  ON public.subscription_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      JOIN public.student_journeys sj ON ss.student_id = sj.student_id
      WHERE ss.id = subscription_id
      AND sj.manager_id = auth.uid()
    )
  );

-- Students can view their own payments
CREATE POLICY "Students can view their own payments"
  ON public.subscription_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.id = subscription_id
      AND ss.student_id = auth.uid()
    )
  );

-- Administrators can manage all payments
CREATE POLICY "Administrators can manage subscription payments"
  ON public.subscription_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Managers can update payments of their students
CREATE POLICY "Managers can update payments of their students"
  ON public.subscription_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      JOIN public.student_journeys sj ON ss.student_id = sj.student_id
      WHERE ss.id = subscription_id
      AND sj.manager_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.subscription_payments IS 'Track individual payments for student subscriptions';

-- Grant permissions
GRANT ALL ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

