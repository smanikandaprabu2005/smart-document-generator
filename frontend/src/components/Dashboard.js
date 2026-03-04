import React, { useState, useEffect } from "react";
import "../../styles/Dashboard.css";

const cards = [
  { title: "Letter", desc: "Generate official letters" },
  { title: "Circular", desc: "Create circulars easily" },
  { title: "Certificate", desc: "Generate certificates" },
  { title: "Notice", desc: "Design notices" },
  { title: "Report", desc: "Build structured reports" },
];

export default function Dashboard({ onSelect }) {
  const [current, setCurrent] = useState(0);

  // Auto-slide every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % cards.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Manual navigation
  const nextSlide = () => setCurrent((prev) => (prev + 1) % cards.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + cards.length) % cards.length);

  return (
    <div className="carousel-container">
      <button className="nav-btn left" onClick={prevSlide}>&lt;</button>

      <div className="carousel-slider">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`carousel-card ${index === current ? "active" : ""}`}
            onClick={() => onSelect(card.title)}
          >
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>

      <button className="nav-btn right" onClick={nextSlide}>&gt;</button>
    </div>
  );
}
