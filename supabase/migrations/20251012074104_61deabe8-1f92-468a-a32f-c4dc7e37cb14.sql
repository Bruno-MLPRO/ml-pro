-- Allow students to create milestones in their own journey
CREATE POLICY "Students can insert own milestones"
ON public.milestones
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM student_journeys
    WHERE student_journeys.id = milestones.journey_id
      AND student_journeys.student_id = auth.uid()
  )
);