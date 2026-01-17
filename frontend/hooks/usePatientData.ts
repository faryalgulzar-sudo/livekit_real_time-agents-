'use client';

import { useState, useEffect, useCallback } from 'react';

export interface IntakeField {
  id: string;
  label: string;
  value: string | null;
  required: boolean;
  completed: boolean;
  category: 'personal' | 'medical' | 'insurance' | 'appointment';
}

export interface Appointment {
  id: string;
  date: Date;
  time: string;
  type: 'checkup' | 'cleaning' | 'consultation' | 'treatment' | 'emergency';
  dentist?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  dueDate?: Date;
}

export interface PatientData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  intakeProgress: number; // 0-100
  intakeFields: IntakeField[];
  appointments: Appointment[];
  actionItems: ActionItem[];
  lastVisit?: Date;
  notes?: string;
}

interface UsePatientDataOptions {
  patientId?: string;
  sessionId?: string;
}

interface UsePatientDataReturn {
  patientData: PatientData | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
  updateIntakeField: (fieldId: string, value: string) => void;
  completeActionItem: (itemId: string) => void;
}

// Mock data for development
const mockPatientData: PatientData = {
  id: 'patient-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1 555-0123',
  dateOfBirth: new Date('1985-06-15'),
  intakeProgress: 75,
  intakeFields: [
    { id: 'f1', label: 'Full Name', value: 'John Doe', required: true, completed: true, category: 'personal' },
    { id: 'f2', label: 'Phone Number', value: '+1 555-0123', required: true, completed: true, category: 'personal' },
    { id: 'f3', label: 'Email Address', value: 'john.doe@example.com', required: false, completed: true, category: 'personal' },
    { id: 'f4', label: 'Date of Birth', value: '1985-06-15', required: true, completed: true, category: 'personal' },
    { id: 'f5', label: 'Current Medications', value: 'None', required: true, completed: true, category: 'medical' },
    { id: 'f6', label: 'Allergies', value: 'Penicillin', required: true, completed: true, category: 'medical' },
    { id: 'f7', label: 'Last Dental Visit', value: '6 months ago', required: false, completed: true, category: 'medical' },
    { id: 'f8', label: 'Insurance Provider', value: null, required: true, completed: false, category: 'insurance' },
    { id: 'f9', label: 'Policy Number', value: null, required: true, completed: false, category: 'insurance' },
    { id: 'f10', label: 'Preferred Appointment Time', value: 'Morning', required: false, completed: true, category: 'appointment' },
    { id: 'f11', label: 'Reason for Visit', value: 'Regular checkup', required: true, completed: true, category: 'appointment' },
    { id: 'f12', label: 'Emergency Contact', value: null, required: false, completed: false, category: 'personal' },
  ],
  appointments: [
    {
      id: 'apt-1',
      date: new Date(Date.now() + 86400000 * 3), // 3 days from now
      time: '10:00 AM',
      type: 'checkup',
      dentist: 'Dr. Sarah Johnson',
      status: 'confirmed',
      notes: 'Regular 6-month checkup',
    },
  ],
  actionItems: [
    {
      id: 'action-1',
      title: 'Complete insurance information',
      description: 'Please provide your insurance provider and policy number before your appointment.',
      priority: 'high',
      completed: false,
      dueDate: new Date(Date.now() + 86400000 * 2),
    },
    {
      id: 'action-2',
      title: 'Bring previous dental records',
      description: 'If available, bring any X-rays or records from your previous dentist.',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'action-3',
      title: 'Arrive 15 minutes early',
      description: 'Please arrive early to complete any remaining paperwork.',
      priority: 'low',
      completed: false,
    },
  ],
  lastVisit: new Date(Date.now() - 86400000 * 180), // 6 months ago
};

export function usePatientData(options: UsePatientDataOptions = {}): UsePatientDataReturn {
  const { patientId, sessionId } = options;

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatientData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/patients/${patientId}?session_id=${sessionId}`);
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setPatientData(mockPatientData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch patient data');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, sessionId]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  const updateIntakeField = useCallback((fieldId: string, value: string) => {
    setPatientData(prev => {
      if (!prev) return prev;

      const updatedFields = prev.intakeFields.map(field => {
        if (field.id === fieldId) {
          return { ...field, value, completed: !!value };
        }
        return field;
      });

      const completedCount = updatedFields.filter(f => f.completed).length;
      const intakeProgress = Math.round((completedCount / updatedFields.length) * 100);

      return { ...prev, intakeFields: updatedFields, intakeProgress };
    });
  }, []);

  const completeActionItem = useCallback((itemId: string) => {
    setPatientData(prev => {
      if (!prev) return prev;

      const updatedItems = prev.actionItems.map(item => {
        if (item.id === itemId) {
          return { ...item, completed: true };
        }
        return item;
      });

      return { ...prev, actionItems: updatedItems };
    });
  }, []);

  return {
    patientData,
    isLoading,
    error,
    refreshData: fetchPatientData,
    updateIntakeField,
    completeActionItem,
  };
}
