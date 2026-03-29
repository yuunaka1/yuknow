import React, { useState } from 'react';
import { Settings, BookOpen, BrainCircuit } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import Quiz from './components/Quiz';

type View = 'dashboard' | 'settings' | 'quiz';

function App() {
  const [view, setView] = useState<View>('settings');
  
  const [googleClientId, setGoogleClientId] = useLocalStorage('uknow_google_client_id', '');
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('uknow_gemini_api_key', '');
  const [docId, setDocId] = useLocalStorage('uknow_doc_id', '');
  
  const isConfigured = googleClientId && geminiApiKey && docId;

  // 初期ステートで設定が完了していればダッシュボードを開く
  React.useEffect(() => {
    if (isConfigured && view === 'settings') {
      setView('dashboard');
    }
  }, []);

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
          <BrainCircuit color="var(--brand-primary)" />
          <span className="text-gradient">uKnow</span>
        </h1>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('dashboard')}
            disabled={!isConfigured}
            style={{ padding: '0.5rem 1rem' }}
          >
            <BookOpen size={18} /> Dashboard
          </button>
          <button 
            className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('settings')}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Settings size={18} /> Settings
          </button>
        </nav>
      </header>
      
      <main className="glass-panel" style={{ padding: '2rem' }}>
        {view === 'settings' && (
          <SettingsPanel 
            googleClientId={googleClientId}
            setGoogleClientId={setGoogleClientId}
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={setGeminiApiKey}
            docId={docId}
            setDocId={setDocId}
          />
        )}
        
        {view === 'dashboard' && isConfigured && (
          <Dashboard
            googleClientId={googleClientId}
            geminiApiKey={geminiApiKey}
            docId={docId}
            onStartQuiz={() => setView('quiz')}
          />
        )}

        {view === 'quiz' && (
          <Quiz onComplete={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}

export default App;
