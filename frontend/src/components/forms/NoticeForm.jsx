import React, { useState } from "react";
import DocumentResult from "../DocumentResult";
import PlaceholderModal from "../PlaceholderModal";
import { uploadTemplate } from "../../api";
import "../../styles/NoticeForm.css";
const NoticeForm = ({ onSubmit }) => {
  const [Title, setTitle] = useState("");
  const [Name1, setName1] = useState("");
  const [Name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [venue, setvenue] = useState("");
  const [template, setTemplate] = useState("notice_template.docx");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [uploadedTemplate, setUploadedTemplate] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadLoading(true);
    try {
      const response = await uploadTemplate(file, "notice");
      setUploadedTemplate(response.filename);
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
    const res = await onSubmit({
      docType: "notice",
      Title,
      Name1,
      Name2,
      date,
      venue,
      template: uploadedTemplate || template,
    });
    setResult(res);
    setLoading(false);
  };

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => {
      setResult(null);
      setDownloaded(false);
    }, 300);
  };

  const noticePlaceholders = [
    { name: "{{title}}", description: "Title of the notice" },
    { name: "{{name}}", description: "Name of the first person" },
    { name: "{{name2}}", description: "Name of the second person" },
    { name: "{{date}}", description: "Date of the notice" },
    { name: "{{venue}}", description: "Venue details" },
    { name: "{{no}}", description: "Notice/Sdg number" },
    { name: "{{sdg_image}}", description: "SDG (Sustainable Development Goals) image" },
    { name: "{{main_image}}", description: "Main/header image for the notice" },
  ];

  return (
    <form className="notice-form" onSubmit={handleSubmit}>
      <div style={{position: 'relative'}}>
        <PlaceholderModal placeholders={noticePlaceholders} title="Notice" />
        <h2>Generate Notice</h2>
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

      <label>Template (Default)</label>
      <select value={template} onChange={e => setTemplate(e.target.value)} required disabled={!!uploadedTemplate}>
        <option value="notice_template.docx">NSS Notice</option>
        <option value="IE1_template.docx">IE Chapter1 Notice</option>
        <option value="IE2_template.docx">IE Chapter2 Notice</option>
      </select>

      <label>Notice Title</label>
      <input
        type="text"
        value={Title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="E.g., Fee Payment Deadline"
        required
      />

      <label>Person 1 Name</label>
      <input
        type="text"
        value={Name1}
        onChange={(e) => setName1(e.target.value)}
        required
      />
      <label>Person 2 Name</label>
      <input
        type="text"
        value={Name2}
        onChange={(e) => setName2(e.target.value)}
        required
      />

      <label>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <label>venue</label>
      <textarea
        value={venue}
        onChange={(e) => setvenue(e.target.value)}
        placeholder="Provide venue"
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

export default NoticeForm;