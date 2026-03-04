import React, { useState } from "react";
import "../styles/PlaceholderModal.css";

const PlaceholderModal = ({ placeholders, title }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="placeholder-help-btn"
        onClick={() => setIsOpen(true)}
        title="View available placeholders"
      >
        ?
      </button>

      {isOpen && (
        <div className="placeholder-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="placeholder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="placeholder-modal-header">
              <h3>Available Placeholders - {title}</h3>
              <button
                type="button"
                className="placeholder-modal-close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="placeholder-modal-content">
              <p className="placeholder-info">
                You can use these placeholders in your template:
              </p>
              <div className="placeholders-grid">
                {placeholders.map((placeholder, index) => (
                  <div key={index} className="placeholder-item">
                    <code>{placeholder.name}</code>
                    <p>{placeholder.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="placeholder-modal-footer">
              <button
                type="button"
                className="placeholder-modal-btn-close"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlaceholderModal;
