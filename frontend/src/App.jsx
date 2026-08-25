// App.jsx
import React, { useState, useEffect, useRef } from "react";
import { generateDocument, API_URL } from "./api";
import { generateBulkCertificates } from "./api";
import { getCurrentUser, isAuthenticated, logout } from "./api";
import DocumentResult from "./components/DocumentResult";
import LetterFormNew from "./components/forms/LetterFormNew";
import CertificateForm from "./components/forms/CertificateForm";
import CircularForm from "./components/forms/CircularForm";
import NoticeForm from "./components/forms/NoticeForm";
import Login from "./components/Login";
import AddUser from "./components/AddUser";
import ShowUsers from "./components/ShowUsers";
import ResetPassword from "./components/ResetPassword";
import "./styles/app.css";
import "./styles/Dashboard.css";

const App = () => {
  const [selectedType, setSelectedType] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [user, setUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check authentication on app load
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser && isAuthenticated()) {
      setUser(currentUser);
    }
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Cards data - role-based access
  const cards = user?.role === 'admin' 
    ? [
        { key: "letter", title: "Letter", desc: "GENERATE LETTER" },
        { key: "certificate", title: "Certificate", desc: "GENERATE CERTIFICATE" },
        { key: "circular", title: "Circular", desc: "GENERATE CIRCULAR" },
        { key: "notice", title: "Notice", desc: "GENERATE NOTICE" },
      ]
    : [
        { key: "notice", title: "Notice", desc: "GENERATE NOTICE" },
      ];

  // Slider logic
  const [currentIndex, setCurrentIndex] = useState(0);

const intervalRef = useRef(null);

  const startAutoSlide = () => {
    stopAutoSlide(); // clear old one before starting new
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 3000); // 3s auto-slide
  };

  const stopAutoSlide = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // start auto-slide on mount
  useEffect(() => {
    startAutoSlide();
    return () => stopAutoSlide(); // cleanup
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
    startAutoSlide(); // reset timer
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
    startAutoSlide(); // reset timer
  };

  const handleBack = () => {
    setSelectedType(null);
    setResult(null);
  };

  // Returns result for inline download in forms
  const handleSubmit = async (payload) => {
    let result;
    if (payload.docType === "certificate" && payload.csvFile) {
      result = await generateBulkCertificates(payload.csvFile);
    } else {
      result = await generateDocument(payload);
    }
    return result;
  };

  const handleDownload = () => {
    setDownloaded(true);
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setSelectedType(null);
    setResult(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`app${selectedType ? ' app-form-view' : ''}`}>
      {/* Welcome message in top left corner */}
      <div className="welcome-message" style={{
        position: 'absolute',
        top: '1rem',
        left: '2rem',
        zIndex: 1000,
        fontSize: '1.5rem',
        color: '#00e5ff',
        fontWeight: '600',
        textShadow: '0 0 10px rgba(0, 229, 255, 0.5)',
      }}>
        Welcome {user?.username} !
      </div>

      {/* Three-dot menu and logout in top right corner */}
      <div className="account-actions" style={{
        position: 'absolute',
        top: '1rem',
        right: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 1000,
      }}>
        {user?.role === 'admin' && (
          <div className="menu-container" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'none',
                border: 'none',
                color: '#00e5ff',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '4px',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(0, 229, 255, 0.1)'}
              onMouseOut={(e) => e.target.style.background = 'none'}
            >
              ⋮
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'linear-gradient(145deg, #0f1624, #1b2430)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0, 229, 255, 0.3)',
                minWidth: '200px',
                zIndex: 1001,
                animation: 'fadeIn 0.2s ease-out',
              }}>
                <button
                  onClick={() => {
                    setShowAddUser(true);
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: '#00e5ff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(0, 229, 255, 0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'none'}
                >
                  ➕ Add User
                </button>
                <button
                  onClick={() => {
                    setShowUsers(true);
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: '#00e5ff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderTop: '1px solid rgba(0, 229, 255, 0.1)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(0, 229, 255, 0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'none'}
                >
                  👥 Show Users
                </button>
                <button
                  onClick={() => {
                    setShowResetPassword(true);
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: '#00e5ff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '0 0 8px 8px',
                    borderTop: '1px solid rgba(0, 229, 255, 0.1)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(0, 229, 255, 0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'none'}
                >
                  🔐 Reset Password
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reset Password option for regular users */}
        {user?.role !== 'admin' && (
          <button
            onClick={() => setShowResetPassword(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#00e5ff',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '4px',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(0, 229, 255, 0.1)'}
            onMouseOut={(e) => e.target.style.background = 'none'}
            title="Reset Password"
          >
            🔐
          </button>
        )}


        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
          }}
          onMouseOver={(e) => {
            e.target.style.border = '2px solid #ff4757';
            e.target.style.background = 'rgba(255, 71, 87, 0.1)';
            e.target.style.boxShadow = '0 0 16px rgba(255, 71, 87, 0.4)';
            e.target.style.transform = 'scale(1.2)';
          }}
          onMouseOut={(e) => {
            e.target.style.border = 'none';
            e.target.style.background = 'none';
            e.target.style.boxShadow = 'none';
            e.target.style.transform = 'scale(1)';
          }}
          title="Logout"
        >
          <svg style={{ pointerEvents: 'none' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>

      <div className="title-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 2rem',
        marginTop: 6,
        marginBottom: 26,
        zIndex: 10,
        position: 'relative',
      }}>
        <h1 className="app-title" style={{
          textAlign: 'center',
          margin: 0,
          background: 'linear-gradient(135deg, #00e5ff 0%, #ff00cc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          textShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
        }}>Smart Document Generator</h1>
      </div>

      {/* Removed static container for spacing below the title */}

      {!selectedType && (
        <div
          className="slider-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            minHeight: 'calc(10vh - 120px)',
            marginBottom: 0,
            position: 'relative',
            zIndex: 5,
          }}
          onMouseEnter={stopAutoSlide}
          onMouseLeave={startAutoSlide}
        >
          <div className="slider-track"
            style={{
              '--viewport-width': `${viewportWidth}px`,
            }}
          >
            {/* Show previous, current, and next cards in a circular (infinite) manner */}
            {[-1, 0, 1].map((offset) => {
              const total = cards.length;
              let idx = (currentIndex + offset + total) % total;
              const c = cards[idx];
              // 2D circle: arrange 3 visible cards in a circle
              const angle = offset * 60; // -60deg (left), 0 (center), 60deg (right)
              const rad = (angle * Math.PI) / 180;
              // Responsive radii (smaller)
              const radiusX = Math.min(360, Math.max(110, viewportWidth * 0.28));
              const radiusY = Math.min(220, Math.max(110, viewportWidth * 0.16));
              const x = Math.sin(rad) * radiusX;
              // Keep the active card centered; only neighboring cards arc vertically.
              // Keep every card below the heading; the carousel varies horizontally.
              const y = 0;
              // Clamp card width for responsiveness (smaller)
              const isActive = offset === 0;
              const scale = isActive ? 1.254 : 1.0584; // 2% smaller than 1.28/1.08
              const z = isActive ? 2 : 1;
              const cardMax = isActive ? 560 : 360;
              const cardMin = isActive ? 220 : 160;
              const cardWidth = Math.max(cardMin, Math.min(cardMax, viewportWidth * (isActive ? 0.62 : 0.42), viewportHeight * (isActive ? 0.76 : 0.5)));
              const cardHeight = isActive ? Math.min(430, Math.max(300, viewportHeight * 0.54)) : Math.min(300, Math.max(220, viewportHeight * 0.4));
              // No effect styles
              const effectStyle = {};
              return (
                <div
                  key={c.key}
                  className={`card slide${isActive ? ' active' : ''}`}
                  onClick={() => {
                    // Role-based access control
                    if (c.key === 'notice' || user?.role === 'admin') {
                      setSelectedType(c.key);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)` ,
                    top: `calc(50% + ${y}px)` ,
                    width: cardWidth,
                    height: cardHeight,
                    zIndex: z,
                    opacity: isActive ? 1 : 0.7,
                    background: isActive
                      ? 'rgba(24,31,46,0.92)'
                      : 'rgba(24,31,46,0.75)',
                    backdropFilter: 'blur(8px) saturate(1.2)',
                    border: isActive ? 
                      ((c.key === 'notice' || user?.role === 'admin') ? '2.5px solid #00e5ff88' : '2.5px solid #66666688') : 
                      '1.5px solid #00e5ff33',
                    borderRadius: '32px',
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    transition: 'all 0.7s cubic-bezier(.4,2,.6,1)',
                    cursor: (isActive && (c.key === 'notice' || user?.role === 'admin')) ? 'pointer' : 
                            (isActive ? 'not-allowed' : 'grab'),
                    overflow: 'hidden',
                    ...effectStyle,
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div className={`card-icon icon-${c.key}`} style={{ borderRadius: '18px', marginBottom: 12, boxShadow: isActive ? '0 0 32px #00e5ffcc' : 'none', transition: 'box-shadow 0.5s' }} />
                    <h3 style={{
                      fontSize: isActive ? '2rem' : '1.2rem',
                      color: '#00e5ff',
                      marginBottom: 8,
                      textShadow: isActive ? '0 0 24px #00e5ff, 0 0 8px #fff2' : 'none',
                      transition: 'text-shadow 0.5s',
                    }}>{c.title}</h3>
                    <p style={{
                      fontSize: isActive ? '1.1rem' : '0.95rem',
                      color: '#fff',
                      opacity: 0.85,
                      textAlign: 'center',
                      margin: 0,
                    }}>{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buttons */}
          <button className="slider-btn prev-btn" onClick={handlePrev}>
            ‹
          </button>
          <button className="slider-btn next-btn" onClick={handleNext}>
            ›
          </button>

          {/* Dots */}
          <div className="dots">
            {cards.map((_, idx) => (
              <span
                key={idx}
                className={`dot ${idx === currentIndex ? "active" : ""}`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedType && (
        <div className="form-container">
          <button className="back-btn" onClick={handleBack}>
            ← Back
          </button>
          {selectedType === "letter" && user?.role === 'admin' && (
            <LetterFormNew onSubmit={handleSubmit} />
          )}
          {selectedType === "certificate" && user?.role === 'admin' && (
            <CertificateForm onSubmit={handleSubmit} />
          )}
          {selectedType === "circular" && user?.role === 'admin' && (
            <CircularForm onSubmit={handleSubmit} />
          )}
          {selectedType === "notice" && (
            <NoticeForm onSubmit={handleSubmit} />
          )}
          {/* Show access denied message for unauthorized forms */}
          {selectedType !== "notice" && user?.role !== 'admin' && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#ff4757',
              fontSize: '1.2rem',
              fontWeight: '500'
            }}>
              Access Denied: This form is only available to administrators.
            </div>
          )}
        </div>
      )}

      {/* Admin Modals */}
      {showAddUser && (
        <AddUser 
          onClose={() => setShowAddUser(false)} 
          onUserAdded={() => {
            // Could refresh users list if needed
          }}
        />
      )}
      {showUsers && (
        <ShowUsers 
          onClose={() => setShowUsers(false)} 
        />
      )}

      {/* Reset Password Modal - available for both admin and users */}
      {showResetPassword && user && (
        <ResetPassword
          onClose={() => setShowResetPassword(false)}
          currentUsername={user.username}
        />
      )}
    </div>
  );
};

export default App;
