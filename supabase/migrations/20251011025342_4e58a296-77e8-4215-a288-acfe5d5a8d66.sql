-- Allow students to update their own milestones
CREATE POLICY "Students can update own milestones"
ON public.milestones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM student_journeys
    WHERE student_journeys.id = milestones.journey_id
    AND student_journeys.student_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM student_journeys
    WHERE student_journeys.id = milestones.journey_id
    AND student_journeys.student_id = auth.uid()
  )
);