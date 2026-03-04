import React, { useState } from 'react';
import { verifyDocument } from '../api';

const QRVerifier = () => {
  const [verificationId, setVerificationId] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!verificationId) {
      alert('Please enter a document ID to verify');
      return;
    }
    
    setLoading(true);
    try {
      const response = await verifyDocument(verificationId);
      setVerificationResult(response.data);
    } catch (err) {
      console.error('Error verifying document:', err);
      alert('Error verifying document. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Verify Certificate</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={verificationId}
          onChange={(e) => setVerificationId(e.target.value)}
          placeholder="Enter certificate ID"
          className="flex-1 p-2 border border-gray-300 rounded"
        />
        <button
          onClick={handleVerify}
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
      
      {verificationResult && (
        <div className={`mt-4 p-4 rounded ${verificationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {verificationResult.valid ? (
            <>
              <p className="text-green-800 font-semibold">✓ Valid Certificate</p>
              <div className="mt-2 text-sm">
                <p><strong>Recipient:</strong> {verificationResult.recipient_name}</p>
                <p><strong>Event:</strong> {verificationResult.event_name}</p>
                <p><strong>Date:</strong> {verificationResult.date}</p>
                <p><strong>Role:</strong> {verificationResult.role}</p>
                <p><strong>Issued:</strong> {new Date(verificationResult.created_at).toLocaleString()}</p>
              </div>
            </>
          ) : (
            <p className="text-red-800 font-semibold">✗ Invalid Certificate</p>
          )}
        </div>
      )}
    </div>
  );
};

export default QRVerifier;