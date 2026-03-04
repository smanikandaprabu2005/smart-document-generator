import React, { useState, useEffect } from 'react';
import '../styles/AdminModals.css';
import { API_URL } from '../api';

const ShowUsers = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', role: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        setError('Failed to load users: ' + response.statusText);
      }
    } catch (err) {
      setError('Failed to load users: ' + err.message);
    }
    setLoading(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({ username: user.username, role: user.role });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      const response = await fetch(`${API_URL}/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setEditingUser(null);
        fetchUsers(); // Refresh the list
      } else if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user: ' + err.message);
    }
  };

  const handleDelete = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setDeleteConfirm(null);
        fetchUsers(); // Refresh the list
      } else if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Failed to delete user: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>All Users</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading">Loading users...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...users].sort((a, b) => a.id - b.id).map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleEdit(user)}
                            className="edit-btn"
                            disabled={user.username === 'admin'} // Prevent editing admin user
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(user)}
                            className="delete-btn"
                            disabled={user.username === 'admin'} // Prevent deleting admin user
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="no-users">No users found</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content medium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="close-btn" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Username:</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role:</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingUser(null)} className="cancel-btn">Cancel</button>
                <button type="submit" className="submit-btn">Update User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="close-btn" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete user "{deleteConfirm.username}"?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(null)} className="cancel-btn">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="delete-confirm-btn">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowUsers;