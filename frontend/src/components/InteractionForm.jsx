import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Mic, Search, Plus, Trash2, Calendar, Clock, Smile, Meh, Frown, Sparkles } from 'lucide-react';
import {
  setField,
  setFields,
  addMaterial,
  removeMaterial,
  addSample,
  removeSample,
} from '../store/interactionSlice';
import MaterialsModal from './MaterialsModal';
import SamplesModal from './SamplesModal';

export default function InteractionForm() {
  const dispatch = useDispatch();
  const form = useSelector((state) => state.interaction);
  const suggestedFollowups = useSelector((state) => state.chat.suggestedFollowups);

  const [hcps, setHcps] = useState([]);
  const [showHcpSuggestions, setShowHcpSuggestions] = useState(false);
  const [hcpSearch, setHcpSearch] = useState('');
  
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);

  // Reference for autocomplete list closure
  const hcpRef = useRef(null);

  // Fetch HCPs for autocomplete on mount
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/hcps')
      .then((res) => res.json())
      .then((data) => setHcps(data))
      .catch((err) => console.error(err));
  }, []);

  // Sync HCP Search input with redux value
  useEffect(() => {
    setHcpSearch(form.hcp_name);
  }, [form.hcp_name]);

  // Click outside listener for HCP autocomplete box
  useEffect(() => {
    function handleClickOutside(event) {
      if (hcpRef.current && !hcpRef.current.contains(event.target)) {
        setShowHcpSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    dispatch(setField({ name, value }));
  };

  const handleHcpInput = (e) => {
    const val = e.target.value;
    setHcpSearch(val);
    dispatch(setField({ name: 'hcp_name', value: val }));
    setShowHcpSuggestions(true);
  };

  const selectHcp = (hcp) => {
    dispatch(
      setFields({
        hcp_name: hcp.name,
        hcp_id: hcp.id,
      })
    );
    setHcpSearch(hcp.name);
    setShowHcpSuggestions(false);
  };

  const handleVoiceNoteClick = () => {
    if (!voiceConsent) {
      setShowConsentModal(true);
    } else {
      triggerVoiceSimulation();
    }
  };

  const handleConsentApprove = () => {
    setVoiceConsent(true);
    setShowConsentModal(false);
    triggerVoiceSimulation();
  };

  const triggerVoiceSimulation = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      const simulatedSummary = "Discussed the overall efficacy of OncoBoost in oncologist trials, positive responses to recent study results, and potential dosage modifications.";
      const currentTopics = form.topics_discussed;
      const newTopics = currentTopics
        ? `${currentTopics}\n\n[Voice Summary]: ${simulatedSummary}`
        : `[Voice Summary]: ${simulatedSummary}`;
      
      dispatch(setField({ name: 'topics_discussed', value: newTopics }));
      dispatch(setField({ name: 'sentiment', value: 'Positive' }));
    }, 4000);
  };

  const handleSuggestedFollowupClick = (suggestion) => {
    const currentFollowups = form.follow_up_actions;
    const newFollowups = currentFollowups
      ? `${currentFollowups}\n- ${suggestion}`
      : `- ${suggestion}`;
    dispatch(setField({ name: 'follow_up_actions', value: newFollowups }));
  };

  const filteredHcps = hcps.filter((h) =>
    h.name.toLowerCase().includes(hcpSearch.toLowerCase())
  );

  return (
    <div className="card">
      <div className="card-title">
        <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
        Interaction Details
      </div>

      <div className="form-grid">
        {/* HCP Name */}
        <div className="form-group autocomplete-wrapper" ref={hcpRef}>
          <label>HCP Name</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search or select HCP..."
              value={hcpSearch}
              onChange={handleHcpInput}
              onFocus={() => setShowHcpSuggestions(true)}
            />
            {showHcpSuggestions && hcpSearch && (
              <div className="autocomplete-suggestions">
                {filteredHcps.length === 0 ? (
                  <div className="autocomplete-suggestion" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    Create new HCP "{hcpSearch}"
                  </div>
                ) : (
                  filteredHcps.map((hcp) => (
                    <div
                      key={hcp.id}
                      className="autocomplete-suggestion"
                      onClick={() => selectHcp(hcp)}
                    >
                      <span style={{ fontWeight: 500 }}>{hcp.name}</span> - {hcp.specialty} ({hcp.organization})
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Interaction Type */}
        <div className="form-group">
          <label>Interaction Type</label>
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="Meeting">Meeting</option>
            <option value="Call">Call</option>
            <option value="Email">Email</option>
            <option value="Webcast">Webcast</option>
          </select>
        </div>

        {/* Date */}
        <div className="form-group">
          <label>Date</label>
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Time */}
        <div className="form-group">
          <label>Time</label>
          <div style={{ position: 'relative' }}>
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Attendees */}
        <div className="form-group full-width">
          <label>Attendees</label>
          <input
            type="text"
            name="attendees"
            placeholder="Enter names or search..."
            value={form.attendees}
            onChange={handleChange}
          />
        </div>

        {/* Topics Discussed */}
        <div className="form-group full-width">
          <label>Topics Discussed</label>
          <div className="textarea-container">
            <textarea
              name="topics_discussed"
              placeholder="Enter key discussion points..."
              value={form.topics_discussed}
              onChange={handleChange}
            />
            <button className="mic-button" onClick={handleVoiceNoteClick}>
              <Mic size={18} style={{ color: isRecording ? '#ef4444' : 'var(--color-text-muted)' }} />
            </button>
          </div>
          <button
            className={`voice-summarize-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleVoiceNoteClick}
          >
            <Mic size={14} />
            {isRecording ? 'Listening and Summarizing...' : 'Summarize from Voice Note (Requires Consent)'}
          </button>
        </div>
      </div>

      {/* Materials Shared Container */}
      <div className="dynamic-list-container">
        <div className="dynamic-list-header">
          <h3>Materials Shared</h3>
          <button className="action-btn" onClick={() => setIsMaterialsOpen(true)}>
            <Search size={14} /> Search/Add
          </button>
        </div>
        {form.materials.length === 0 ? (
          <div className="empty-list-text">No materials added.</div>
        ) : (
          <div className="tags-container">
            {form.materials.map((mat) => (
              <span key={mat} className="tag">
                {mat}
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() => dispatch(removeMaterial(mat))}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Samples Distributed Container */}
      <div className="dynamic-list-container">
        <div className="dynamic-list-header">
          <h3>Samples Distributed</h3>
          <button className="action-btn" onClick={() => setIsSamplesOpen(true)}>
            <Plus size={14} /> Add Sample
          </button>
        </div>
        {form.samples.length === 0 ? (
          <div className="empty-list-text">No samples added.</div>
        ) : (
          <div className="tags-container">
            {form.samples.map((samp) => (
              <span key={samp} className="tag sample-tag">
                {samp}
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() => dispatch(removeSample(samp))}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Observed Sentiment */}
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label>Observed/Inferred HCP Sentiment</label>
        <div className="sentiment-group">
          <label className="sentiment-option">
            <input
              type="radio"
              name="sentiment"
              value="Positive"
              checked={form.sentiment === 'Positive'}
              onChange={handleChange}
            />
            <Smile size={16} style={{ color: '#16a34a' }} />
            Positive
          </label>
          <label className="sentiment-option">
            <input
              type="radio"
              name="sentiment"
              value="Neutral"
              checked={form.sentiment === 'Neutral'}
              onChange={handleChange}
            />
            <Meh size={16} style={{ color: '#d97706' }} />
            Neutral
          </label>
          <label className="sentiment-option">
            <input
              type="radio"
              name="sentiment"
              value="Negative"
              checked={form.sentiment === 'Negative'}
              onChange={handleChange}
            />
            <Frown size={16} style={{ color: '#dc2626' }} />
            Negative
          </label>
        </div>
      </div>

      {/* Outcomes */}
      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label>Outcomes</label>
        <textarea
          name="outcomes"
          placeholder="Key outcomes or agreements..."
          value={form.outcomes}
          onChange={handleChange}
        />
      </div>

      {/* Follow-up Actions */}
      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label>Follow-up Actions</label>
        <textarea
          name="follow_up_actions"
          placeholder="Enter next steps or tasks..."
          value={form.follow_up_actions}
          onChange={handleChange}
        />
      </div>

      {/* AI Suggested Follow-ups */}
      {suggestedFollowups && suggestedFollowups.length > 0 && (
        <div className="ai-suggestions-container">
          <div className="ai-suggestions-title">AI Suggested Follow-ups:</div>
          <div className="ai-suggestions-list">
            {suggestedFollowups.map((suggestion, idx) => (
              <div
                key={idx}
                className="ai-suggestion-item"
                onClick={() => handleSuggestedFollowupClick(suggestion)}
              >
                <Plus size={12} /> {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="modal-overlay" onClick={() => setShowConsentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Voice Note Recording Consent</h2>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-main)', marginBottom: '20px' }}>
              To summarize this interaction using a voice recording, please confirm you have obtained consent from the HCP in compliance with medical data regulations and local privacy laws.
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={() => setShowConsentModal(false)}>
                Cancel
              </button>
              <button
                className="chat-log-btn"
                style={{ backgroundColor: 'var(--color-secondary)' }}
                onClick={handleConsentApprove}
              >
                I Consent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Search/Add Materials and Samples */}
      <MaterialsModal
        isOpen={isMaterialsOpen}
        onClose={() => setIsMaterialsOpen(false)}
        onSelect={(mat) => dispatch(addMaterial(mat))}
        selectedMaterials={form.materials}
      />
      <SamplesModal
        isOpen={isSamplesOpen}
        onClose={() => setIsSamplesOpen(false)}
        onSelect={(samp) => dispatch(addSample(samp))}
        selectedSamples={form.samples}
      />
    </div>
  );
}
