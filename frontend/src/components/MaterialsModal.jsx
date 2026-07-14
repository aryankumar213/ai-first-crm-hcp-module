import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

export default function MaterialsModal({ isOpen, onClose, onSelect, selectedMaterials }) {
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('http://127.0.0.1:8000/api/materials')
        .then((res) => res.json())
        .then((data) => {
          setMaterials(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Materials Shared</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="search-input-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="results-list">
          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              Loading materials...
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              No materials found
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const isSelected = selectedMaterials.includes(m.name);
              return (
                <div
                  key={m.id}
                  className="result-item"
                  onClick={() => {
                    if (!isSelected) {
                      onSelect(m.name);
                    }
                  }}
                  style={{
                    cursor: isSelected ? 'default' : 'pointer',
                    opacity: isSelected ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                    <div className="result-item-details">{m.type}</div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '12px', color: '#0d9488', fontWeight: 600 }}>Added</span>
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
