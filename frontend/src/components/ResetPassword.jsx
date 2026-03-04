import React, { useState } from 'react';
import { API_URL } from '../api';
import '../styles/ResetPassword.css';

const ResetPassword = ({ onClose, currentUsername }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessageType('error');
      setMessage('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessageType('error');
      setMessage('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setMessageType('error');
      setMessage('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessageType('success');
        setMessage('Password reset successfully!');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setMessageType('error');
        setMessage(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Error resetting password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-overlay" onClick={onClose}>
      <div className="reset-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reset-password-header">
          <h3>Reset Password</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleResetPassword} className="reset-password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={loading}
            />
          </div>

          {message && (
            <div className={`message ${messageType}`}>
              {messageType === 'success' ? '✓' : '✗'} {message}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
