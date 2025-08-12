import React from 'react';
import fmvLogo from '../assets/fmv_logo.png';

const Footer = () => {
  return (
    <footer className="py-6 px-4 border-t" style={{ 
      backgroundColor: '#1e293b', 
      borderColor: '#475569' 
    }}>
      <div className="max-w-4xl mx-auto text-center">
        {/* FMV Logo */}
        <div className="mb-4">
          <img 
            src={fmvLogo} 
            alt="Faculdade de Medicina Veterinária - Universidade de Lisboa"
            className="h-18 mx-auto opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
        
        {/* Copyright */}
        <div className="text-sm text-gray-400">
          © 2025 Faculdade de Medicina Veterinária - Universidade de Lisboa
        </div>
      </div>
    </footer>
  );
};

export default Footer;
