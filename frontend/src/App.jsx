import React, { useState } from 'react';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store } from './store';
import InteractionForm from './components/InteractionForm';
import ChatAssistant from './components/ChatAssistant';
import { resetForm } from './store/interactionSlice';
import { clearChat } from './store/chatSlice';
import { Stethoscope, CheckCircle, AlertCircle } from 'lucide-react';

function Dashboard() {
  const form = useSelector((state) => state.interaction);
  const dispatch = useDispatch();
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error', or null
  const [saving, setSaving] = useState(false);

  const handleSaveLog = async () => {
    if (!form.hcp_name) {
      setSaveStatus({ type: 'error', message: 'HCP Name is required.' });
      setTimeout(() => setSaveStatus(null), 4000);
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hcp_id: form.hcp_id,
          hcp_name: form.hcp_name,
          type: form.type,
          date: form.date,
          time: form.time,
          attendees: form.attendees,
          topics_discussed: form.topics_discussed,
          materials: form.materials,
          samples: form.samples,
          sentiment: form.sentiment,
          outcomes: form.outcomes,
          follow_up_actions: form.follow_up_actions,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      setSaveStatus({ type: 'success', message: 'Interaction successfully logged to CRM Database!' });
      
      // Reset form and chat
      dispatch(resetForm());
      dispatch(clearChat());
      
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error(err);
      setSaveStatus({ type: 'error', message: 'Failed to log interaction. Please check database connection.' });
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      {/* Page Header */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>
          <Stethoscope size={28} style={{ color: 'var(--color-accent)' }} />
          Log HCP Interaction
        </h1>
        <button
          className="chat-log-btn"
          style={{ backgroundColor: 'var(--color-secondary)' }}
          onClick={handleSaveLog}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Interaction Log'}
        </button>
      </header>

      {/* Save Toast Alerts */}
      {saveStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: saveStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${saveStatus.type === 'success' ? '#bbf7d0' : '#fca5a5'}`,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {saveStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {saveStatus.message}
        </div>
      )}

      {/* Grid Layout */}
      <main className="main-content">
        <InteractionForm />
        <ChatAssistant />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <Dashboard />
    </Provider>
  );
}
