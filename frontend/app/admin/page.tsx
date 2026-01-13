'use client';

import { useState, useEffect } from 'react';

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface CRMStats {
  total_calls: number;
  total_followups: number;
  followups_pending: number;
  followups_responded: number;
  response_rate: number;
  total_meetings: number;
  meetings_scheduled: number;
  meetings_completed: number;
}

interface Call {
  id: string;
  user_name: string | null;
  user_phone: string | null;
  state: string;
  created_at: string;
  transcript: string | null;
}

interface FollowUp {
  id: number;
  session_id: string | null;
  user_name: string | null;
  user_phone: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  notes: string | null;
}

interface Meeting {
  id: number;
  user_name: string | null;
  user_phone: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  purpose: string | null;
  status: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'meetings'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, callsRes, followUpsRes, meetingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/stats`),
        fetch(`${API_BASE}/api/crm/calls?limit=20`),
        fetch(`${API_BASE}/api/crm/follow-ups?limit=20`),
        fetch(`${API_BASE}/api/crm/meetings?limit=20`)
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');

      const statsData = await statsRes.json();
      const callsData = await callsRes.json();
      const followUpsData = await followUpsRes.json();
      const meetingsData = await meetingsRes.json();

      setStats(statsData);
      setCalls(callsData.calls || []);
      setFollowUps(followUpsData.follow_ups || []);
      setMeetings(meetingsData.meetings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Update follow-up status
  const updateFollowUpStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/follow-ups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update follow-up:', err);
    }
  };

  // Update meeting status
  const updateMeetingStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/meetings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update meeting:', err);
    }
  };

  // Create follow-up from call
  const createFollowUp = async (call: Call) => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: call.id,
          user_name: call.user_name || 'Unknown',
          user_phone: call.user_phone || '',
          reason: 'Follow-up from call'
        })
      });
      if (res.ok) {
        alert('Follow-up created!');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create follow-up:', err);
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status badge styles
  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'sent': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'responded': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'no_response': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'scheduled': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'no_show': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-5 flex items-center justify-center">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 text-center">
          <div className="text-4xl mb-4 animate-bounce">📊</div>
          <div className="text-xl text-slate-100">Loading Dashboard...</div>
          <div className="text-slate-400 mt-2">Please wait</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-5 flex items-center justify-center">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-red-500/30 text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl text-red-400 mb-2">Error Loading Dashboard</div>
          <div className="text-slate-400 mb-4">{error}</div>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-indigo-500/40"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Open transcript modal
  const openTranscript = (call: Call) => {
    setSelectedCall(call);
    setShowTranscriptModal(true);
  };

  // Close transcript modal
  const closeTranscript = () => {
    setShowTranscriptModal(false);
    setSelectedCall(null);
  };

  return (
    <div className="min-h-screen p-5">
      {/* Transcript Modal */}
      {showTranscriptModal && selectedCall && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-w-3xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <span>💬</span>
                  <span>Conversation Transcript</span>
                </h2>
                <div className="text-slate-400 mt-1 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span>👤</span>
                    {selectedCall.user_name || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>📞</span>
                    {selectedCall.user_phone || 'No phone'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>📅</span>
                    {formatDate(selectedCall.created_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={closeTranscript}
                className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Transcript */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedCall.transcript ? (
                <div className="space-y-4">
                  {selectedCall.transcript.split('\n').map((line, index) => {
                    const isAgent = line.toLowerCase().startsWith('agent:') || line.toLowerCase().startsWith('assistant:');
                    const isUser = line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('patient:');

                    if (!line.trim()) return null;

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-xl ${
                          isAgent
                            ? 'bg-indigo-500/10 border border-indigo-500/30 ml-0 mr-12'
                            : isUser
                            ? 'bg-purple-500/10 border border-purple-500/30 ml-12 mr-0'
                            : 'bg-slate-700/50 border border-slate-600'
                        }`}
                      >
                        <div className={`text-xs font-semibold mb-1 ${
                          isAgent ? 'text-indigo-400' : isUser ? 'text-purple-400' : 'text-slate-400'
                        }`}>
                          {isAgent ? '🤖 Agent' : isUser ? '👤 Patient' : '📝 System'}
                        </div>
                        <div className="text-slate-200">
                          {line.replace(/^(agent:|assistant:|user:|patient:)/i, '').trim()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📭</div>
                  <div className="text-slate-400">No transcript available for this call</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={closeTranscript}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-indigo-500/40"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header - Matching Frontend Style */}
        <header className="text-center mb-8 p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-5xl font-bold mb-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            📊 Admin Dashboard
          </h1>
          <p className="text-slate-400 text-lg">
            Manage calls, follow-ups, and meetings
          </p>
        </header>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Calls */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 hover:border-indigo-500/50 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📞</span>
                </div>
                <div>
                  <div className="text-slate-400 text-sm mb-1">Total Calls</div>
                  <div className="text-3xl font-bold text-slate-100">{stats.total_calls}</div>
                </div>
              </div>
            </div>

            {/* Pending Follow-ups */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 hover:border-yellow-500/50 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
                <div>
                  <div className="text-slate-400 text-sm mb-1">Pending Follow-ups</div>
                  <div className="text-3xl font-bold text-yellow-400">{stats.followups_pending}</div>
                </div>
              </div>
            </div>

            {/* Response Rate */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <div className="text-slate-400 text-sm mb-1">Response Rate</div>
                  <div className="text-3xl font-bold text-green-400">{stats.response_rate}%</div>
                </div>
              </div>
            </div>

            {/* Scheduled Meetings */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <div className="text-slate-400 text-sm mb-1">Scheduled Meetings</div>
                  <div className="text-3xl font-bold text-blue-400">{stats.meetings_scheduled}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Matching Frontend Button Style */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {(['overview', 'calls', 'followups', 'meetings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:border-slate-600'
              }`}
            >
              <span>
                {tab === 'overview' && '📊'}
                {tab === 'calls' && '📞'}
                {tab === 'followups' && '📋'}
                {tab === 'meetings' && '📅'}
              </span>
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
          <button
            onClick={fetchData}
            className="ml-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 hover:-translate-y-0.5"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                <span>📈</span>
                <span>Recent Activity</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Calls */}
                <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <span>📞</span>
                    <span>Recent Calls</span>
                  </h3>
                  <div className="space-y-3">
                    {calls.slice(0, 5).map((call) => (
                      <div key={call.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-indigo-500/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-slate-100 font-medium flex items-center gap-2">
                              <span>👤</span>
                              {call.user_name || 'Unknown'}
                            </div>
                            <div className="text-slate-400 text-sm mt-1">{call.user_phone || 'No phone'}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-slate-500 text-xs">{formatDate(call.created_at)}</div>
                            <button
                              onClick={() => openTranscript(call)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg border border-slate-600 hover:border-slate-500 transition-all flex items-center gap-1"
                            >
                              <span>💬</span>
                              <span>View</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {calls.length === 0 && (
                      <div className="text-slate-500 text-center py-8">No calls yet</div>
                    )}
                  </div>
                </div>

                {/* Pending Follow-ups */}
                <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <span>⏳</span>
                    <span>Pending Follow-ups</span>
                  </h3>
                  <div className="space-y-3">
                    {followUps.filter(f => f.status === 'pending').slice(0, 5).map((followUp) => (
                      <div key={followUp.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-yellow-500/30 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-slate-100 font-medium flex items-center gap-2">
                              <span>👤</span>
                              {followUp.user_name || 'Unknown'}
                            </div>
                            <div className="text-slate-400 text-sm mt-1">{followUp.user_phone || 'No phone'}</div>
                          </div>
                          <button
                            onClick={() => updateFollowUpStatus(followUp.id, 'sent')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Mark Sent
                          </button>
                        </div>
                      </div>
                    ))}
                    {followUps.filter(f => f.status === 'pending').length === 0 && (
                      <div className="text-slate-500 text-center py-8 flex flex-col items-center gap-2">
                        <span className="text-3xl">✅</span>
                        <span>No pending follow-ups</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calls Tab */}
          {activeTab === 'calls' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Phone</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">State</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Date</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <span className="text-slate-100 font-medium">{call.user_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{call.user_phone || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-600">
                          {call.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{formatDate(call.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openTranscript(call)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium rounded-lg border border-slate-600 hover:border-slate-500 transition-all duration-300 flex items-center gap-1"
                          >
                            <span>💬</span>
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => createFollowUp(call)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30"
                          >
                            + Follow-up
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {calls.length === 0 && (
                <div className="text-slate-500 text-center py-12 flex flex-col items-center gap-2">
                  <span className="text-4xl">📞</span>
                  <span>No calls recorded yet</span>
                </div>
              )}
            </div>
          )}

          {/* Follow-ups Tab */}
          {activeTab === 'followups' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Phone</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Created</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {followUps.map((followUp) => (
                    <tr key={followUp.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <span className="text-slate-100 font-medium">{followUp.user_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{followUp.user_phone || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 text-sm rounded-lg border ${getStatusStyles(followUp.status)}`}>
                          {followUp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{formatDate(followUp.created_at)}</td>
                      <td className="px-6 py-4">
                        <select
                          value={followUp.status}
                          onChange={(e) => updateFollowUpStatus(followUp.id, e.target.value)}
                          className="px-4 py-2 bg-slate-900 text-slate-100 text-sm rounded-lg border-2 border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="sent">Sent</option>
                          <option value="responded">Responded</option>
                          <option value="no_response">No Response</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {followUps.length === 0 && (
                <div className="text-slate-500 text-center py-12 flex flex-col items-center gap-2">
                  <span className="text-4xl">📋</span>
                  <span>No follow-ups yet</span>
                </div>
              )}
            </div>
          )}

          {/* Meetings Tab */}
          {activeTab === 'meetings' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Phone</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Date/Time</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Purpose</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {meetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <span className="text-slate-100 font-medium">{meeting.user_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{meeting.user_phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">
                        <div className="flex items-center gap-2">
                          <span>📅</span>
                          <span>{meeting.meeting_date ? formatDate(meeting.meeting_date) : '-'}</span>
                        </div>
                        {meeting.meeting_time && (
                          <div className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                            <span>🕐</span>
                            <span>{meeting.meeting_time}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{meeting.purpose || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 text-sm rounded-lg border ${getStatusStyles(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={meeting.status}
                          onChange={(e) => updateMeetingStatus(meeting.id, e.target.value)}
                          className="px-4 py-2 bg-slate-900 text-slate-100 text-sm rounded-lg border-2 border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No Show</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {meetings.length === 0 && (
                <div className="text-slate-500 text-center py-12 flex flex-col items-center gap-2">
                  <span className="text-4xl">📅</span>
                  <span>No meetings scheduled yet</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Back to Home Link - Matching Footer Style */}
        <footer className="text-center p-5 mt-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 font-medium rounded-lg border border-slate-700 hover:border-slate-600 transition-all duration-300"
          >
            <span>🎤</span>
            <span>Back to Voice Agent</span>
          </a>
          <p className="text-slate-400 mt-4">
            Powered by LiveKit • Real-time Voice AI
          </p>
        </footer>
      </div>
    </div>
  );
}
