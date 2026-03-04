import React, { useState } from 'react';
import { adminCreateUser } from '../api';
import '../styles/AdminModals.css';

const AddUser = ({ onClose, onUserAdded }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user'
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await adminCreateUser(formData);
      setMessage('User created successfully!');
      setFormData({ username: '', password: '', role: 'user' });
      if (onUserAdded) onUserAdded();
    } catch (error) {
      setMessage('Error creating user: ' + (error.response?.data?.error || error.message));
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New User</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Role:</label>
            <select name="role" value={formData.role} onChange={handleChange} className="custom-select">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUser;