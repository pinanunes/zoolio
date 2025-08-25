import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PaginaLogin from './pages/PaginaLogin';
import PaginaRegisto from './pages/PaginaRegisto';
import PaginaChat from './pages/PaginaChat';
import PaginaEsqueciPassword from './pages/PaginaEsqueciPassword';
import PaginaUpdatePassword from './pages/PaginaUpdatePassword';
import FrontOffice from './pages/FrontOffice';
import BackOffice from './pages/BackOffice';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  // This component will now only be rendered when loading is false.
  // We still keep the check as a fallback.
  if (loading) {
    return null; // Or a minimal spinner
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return null; // Or a minimal spinner
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (user.role !== 'professor' && user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  const { loading } = useAuth();
  
  // --- THIS IS THE KEY CHANGE ---
  // The loading screen is now the ONLY thing that can render while loading is true.
  // This prevents the Routes from rendering prematurely.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#1e293b' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg animate-pulse" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
            <span className="text-white font-bold text-2xl">Z</span>
          </div>
          <p className="text-white text-lg mb-2">A verificar sessão...</p>
          <p className="text-gray-400 text-sm">
            Se esta mensagem persistir, tente atualizar a página
          </p>
          <div className="mt-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Atualizar Página
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // This part will now only render after loading is false.
  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin />} />
      <Route path="/register" element={<PaginaRegisto />} />
      <Route path="/forgot-password" element={<PaginaEsqueciPassword />} />
      <Route path="/update-password" element={<PaginaUpdatePassword />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <FrontOffice />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/chat"
        element={
          <PrivateRoute>
            <Navigate to="/" />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/backoffice/*"
        element={
          <AdminRoute>
            <BackOffice />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default App;