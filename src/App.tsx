import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './utils/errorBoundary';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Campaigns } from './components/Campaigns';
import EditCampaign from './components/EditCampaign';
import { SequenceEditorChat } from './components/SequenceEditorChat';
import { Inbox } from './components/Inbox';
import { AdminPanel } from './components/AdminPanel';
import { Settings } from './components/Settings';
import { Targeting } from './components/Targeting';
import { ListsManager } from './components/ListsManager';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen">
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="campaigns/:id/edit" element={<EditCampaign />} />
                  <Route path="campaigns/:id/chat" element={<SequenceEditorChat />} />
                  <Route path="booked" element={<Inbox />} />
                  <Route path="targeting" element={<Targeting />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="admin" element={<AdminPanel />} />
                </Route>
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;