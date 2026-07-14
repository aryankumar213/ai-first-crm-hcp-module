import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

export default function SamplesModal({ isOpen, onClose, onSelect, selectedSamples }) {
  const [samples, setSamples] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('http://127.0.0.1:8000/api/samples')
        .then((res) => res.json())
        .then((data) => {
          setSamples(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredSamples = samples.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Samples Distributed</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="search-input-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Search samples..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="results-list">
          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              Loading samples...
            </div>
          ) : filteredSamples.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              No samples found
            </div>
          ) : (
            filteredSamples.map((s) => {
              const isSelected = selectedSamples.includes(s.name);
              return (
                <div
                  key={s.id}
                  className="result-item"
                  onClick={() => {
                    if (!isSelected) {
                      onSelect(s.name);
                    }
                  }}
                  style={{
                    cursor: isSelected ? 'default' : 'pointer',
                    opacity: isSelected ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div className="result-item-details">{s.description}</div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Added</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
