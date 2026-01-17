'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SessionTranscript {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  status: 'completed' | 'in_progress' | 'cancelled';
  patientName?: string;
  patientPhone?: string;
  appointmentBooked: boolean;
  transcriptCount: number;
  transcripts?: SessionTranscript[];
}

interface UseSessionHistoryOptions {
  tenantId?: string;
  limit?: number;
}

interface UseSessionHistoryReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  selectedSession: Session | null;
  selectSession: (sessionId: string) => void;
  clearSelection: () => void;
  refreshSessions: () => void;
  loadSessionDetail: (sessionId: string) => Promise<Session | null>;
  filterByDateRange: (start: Date, end: Date) => void;
  filterByStatus: (status: Session['status'] | 'all') => void;
  filteredSessions: Session[];
}

// Mock data for development - replace with actual API calls
const mockSessions: Session[] = [
  {
    id: '1',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() - 3000000),
    duration: 600,
    status: 'completed',
    patientName: 'John Doe',
    patientPhone: '+1 555-0123',
    appointmentBooked: true,
    transcriptCount: 24,
  },
  {
    id: '2',
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 6600000),
    duration: 600,
    status: 'completed',
    patientName: 'Jane Smith',
    patientPhone: '+1 555-0456',
    appointmentBooked: true,
    transcriptCount: 18,
  },
  {
    id: '3',
    startTime: new Date(Date.now() - 86400000), // 1 day ago
    endTime: new Date(Date.now() - 86100000),
    duration: 300,
    status: 'cancelled',
    patientName: 'Bob Wilson',
    appointmentBooked: false,
    transcriptCount: 8,
  },
  {
    id: '4',
    startTime: new Date(Date.now() - 172800000), // 2 days ago
    endTime: new Date(Date.now() - 172200000),
    duration: 600,
    status: 'completed',
    patientName: 'Alice Brown',
    patientPhone: '+1 555-0789',
    appointmentBooked: true,
    transcriptCount: 32,
  },
  {
    id: '5',
    startTime: new Date(Date.now() - 259200000), // 3 days ago
    endTime: new Date(Date.now() - 258900000),
    duration: 300,
    status: 'completed',
    patientName: 'Charlie Davis',
    appointmentBooked: false,
    transcriptCount: 12,
  },
];

const mockTranscripts: Record<string, SessionTranscript[]> = {
  '1': [
    { id: 't1', speaker: 'agent', text: 'Hello! Welcome to CloudOps Dental Clinic. How can I help you today?', timestamp: new Date(Date.now() - 3600000) },
    { id: 't2', speaker: 'user', text: 'Hi, I would like to book an appointment for a dental checkup.', timestamp: new Date(Date.now() - 3590000) },
    { id: 't3', speaker: 'agent', text: 'Of course! May I have your name please?', timestamp: new Date(Date.now() - 3580000) },
    { id: 't4', speaker: 'user', text: 'My name is John Doe.', timestamp: new Date(Date.now() - 3570000) },
    { id: 't5', speaker: 'agent', text: 'Thank you, John. And what is the best phone number to reach you?', timestamp: new Date(Date.now() - 3560000) },
    { id: 't6', speaker: 'user', text: 'You can reach me at 555-0123.', timestamp: new Date(Date.now() - 3550000) },
  ],
};

export function useSessionHistory(options: UseSessionHistoryOptions = {}): UseSessionHistoryReturn {
  const { limit = 50 } = options;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [statusFilter, setStatusFilter] = useState<Session['status'] | 'all'>('all');

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/sessions?tenant_id=${tenantId}&limit=${limit}`);
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setSessions(mockSessions.slice(0, limit));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSelectedSession(session);
    }
  }, [sessions]);

  const clearSelection = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const loadSessionDetail = useCallback(async (sessionId: string): Promise<Session | null> => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/sessions/${sessionId}`);
      // const data = await response.json();

      await new Promise(resolve => setTimeout(resolve, 300));

      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const transcripts = mockTranscripts[sessionId] || [];
        const detailedSession = { ...session, transcripts };
        setSelectedSession(detailedSession);
        return detailedSession;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details');
      return null;
    }
  }, [sessions]);

  const filterByDateRange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  const filterByStatus = useCallback((status: Session['status'] | 'all') => {
    setStatusFilter(status);
  }, []);

  const filteredSessions = sessions.filter(session => {
    if (dateRange) {
      if (session.startTime < dateRange.start || session.startTime > dateRange.end) {
        return false;
      }
    }
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return {
    sessions,
    isLoading,
    error,
    selectedSession,
    selectSession,
    clearSelection,
    refreshSessions: fetchSessions,
    loadSessionDetail,
    filterByDateRange,
    filterByStatus,
    filteredSessions,
  };
}
