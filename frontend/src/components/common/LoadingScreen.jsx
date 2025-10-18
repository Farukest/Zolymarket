import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ message = "Loading Polymarket FHEVM..." }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        {/* Animated Logo/Icon */}
        <div className="loading-icon">
          <div className="dice-container">
            <div className="dice">
              <div className="dice-face dice-face-1">
                <div className="dot"></div>
              </div>
              <div className="dice-face dice-face-2">
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <div className="dice-face dice-face-3">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <div className="dice-face dice-face-4">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <div className="dice-face dice-face-5">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <div className="dice-face dice-face-6">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <div className="loading-brand">
          <h1 className="brand-text">
            <span className="poly-text">Poly</span>
            <span className="market-text">market</span>
          </h1>
          <div className="brand-subtitle">Fully Homomorphic Encryption</div>
        </div>

        {/* Loading Progress */}
        <div className="loading-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <div className="loading-message">{message}</div>
        </div>

        {/* Floating Particles */}
        <div className="particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;