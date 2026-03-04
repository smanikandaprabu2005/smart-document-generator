import React, { useState } from "react";
import DocumentResult from "../DocumentResult";
import PlaceholderModal from "../PlaceholderModal";
import { uploadTemplate } from "../../api";
import "../../styles/certificateForm.css";
const CertificateForm = ({ onSubmit }) => {
  const [Name1, setName1] = useState("");
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState("");
  const [role, setRole] = useState("");
  const [signatureFile, setSignatureFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [uploadedTemplate, setUploadedTemplate] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // data URL
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadLoading(true);
    try {
      const response = await uploadTemplate(file, "certificate");
      setUploadedTemplate(response.filename);
      setTemplateFile(null); // clear input
      alert(`Template uploaded successfully: ${response.filename}`);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDownloaded(false);
    let signature = "";
    if (signatureFile) {
      signature = await toBase64(signatureFile);
    }
    let res;
    if (csvFile) {
      res = await onSubmit({
        docType: "certificate",
        csvFile,
        template: uploadedTemplate, // use uploaded template if available
      });
    } else {
      res = await onSubmit({
        docType: "certificate",
        Name1,
        eventName,
        date,
        role,
        template: uploadedTemplate, // use uploaded template if available
      });
    }
    setResult(res);
    setLoading(false);
  };

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => {
      setResult(null);
      setDownloaded(false);
    }, 300); // short delay to allow download to start
  };

  const certificatePlaceholders = [
    { name: "{{name}}", description: "Name of the certificate recipient" },
    { name: "{{event}}", description: "Name of the event" },
    { name: "{{date}}", description: "Date of the event" },
    { name: "{{role}}", description: "Role or position of the recipient" },
    { name: "{{signature}}", description: "Signature image (if uploaded)" },
  ];

  return (
    <form className="certificate-form" onSubmit={handleSubmit}>
      <div style={{position: 'relative'}}>
        <PlaceholderModal placeholders={certificatePlaceholders} title="Certificate" />
        <h2>Generate Certificate</h2>
      </div>

      <label>Upload Template (Word File) - Optional</label>
      <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
        <input
          type="file"
          accept=".docx"
          onChange={handleTemplateUpload}
          disabled={uploadLoading}
        />
        {uploadLoading && <span>Uploading...</span>}
        {uploadedTemplate && <span style={{color: '#00e5ff'}}>✓ {uploadedTemplate.split('/').pop()}</span>}
      </div>

      <label>Upload CSV/Excel for Bulk Certificates</label>
      <input
        type="file"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        onChange={e => setCsvFile(e.target.files[0])}
      />

      <div style={{margin: '10px 0', color: '#888'}}>Or fill details for a single certificate:</div>

      <label>Recipient Name</label>
      <input
        type="text"
        value={Name1}
        onChange={(e) => setName1(e.target.value)}
        required={!csvFile}
        disabled={!!csvFile}
      />

      <label>Event Name</label>
      <input
        type="text"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        required={!csvFile}
        disabled={!!csvFile}
      />

      <label>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required={!csvFile}
        disabled={!!csvFile}
      />

      <label>Role</label>
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Participant, Winner, Volunteer..."
        required={!csvFile}
        disabled={!!csvFile}
      />

      <div className="button-row">
        {!loading && (!result || downloaded) && (
          <button type="submit" className="primary-btn">Generate</button>
        )}
        {loading && (
          <div className="loading-spinner small"></div>
        )}
        {!loading && result && !downloaded && (
          <DocumentResult result={result} onDownload={handleDownload} inline />
        )}
      </div>
    </form>
  );
};

export default CertificateForm;