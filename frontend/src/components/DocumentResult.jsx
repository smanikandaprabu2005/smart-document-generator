import React from "react";
import '../styles/DocumentResult.css'
const DocumentResult = ({ result, onDownload, inline }) => {
  // Hide button after download
  const handleClick = (e) => {
    if (onDownload) onDownload();
  };
  return (
    <span className={inline ? "download-row inline" : "download-row"}>
      {result?.pdf_blob_url && (
        <a
          className="download-btn"
          href={result.pdf_blob_url}
          download={result.filename || "document.pdf"}
          onClick={handleClick}
        >
          Download PDF
        </a>
      )}
      {result?.zip_blob_url && (
        <a
          className="download-btn"
          href={result.zip_blob_url}
          download={result.filename || "certificates.zip"}
          onClick={handleClick}
        >
          Download ZIP of Certificates
        </a>
      )}
    </span>
  );
};


export default DocumentResult;
