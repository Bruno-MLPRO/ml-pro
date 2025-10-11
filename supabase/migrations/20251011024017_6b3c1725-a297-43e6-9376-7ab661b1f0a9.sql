-- Update existing student journey to set current_phase
UPDATE student_journeys 
SET current_phase = 'Onboarding'
WHERE student_id = '1f79fe5c-0814-4a6a-8f61-4a21149da725' AND current_phase IS NULL;