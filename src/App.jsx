import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PaginaLogin from './pages/PaginaLogin';
import PaginaRegisto from './pages/PaginaRegisto';
import PaginaChat from './pages/PaginaChat';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#1e293b' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg animate-pulse" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <p className="text-white">A carregar...</p>
        </div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#1e293b' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg animate-pulse" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <p className="text-white">A carregar...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin />} />
      <Route path="/register" element={<PaginaRegisto />} />
      <Route
        path="/chat"
        element={
          <PrivateRoute>
            <PaginaChat />
          </PrivateRoute>
        }
      />
      {/* Redirect root to login or chat depending on auth status */}
      <Route
        path="/"
        element={
          <Navigate to={user ? "/chat" : "/login"} />
        }
      />
    </Routes>
  );
}

export default App;
