import React, { useState } from 'react';
import { Settings, BookOpen, BrainCircuit, Headphones, HelpCircle } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import Quiz from './components/Quiz';
import ShadowingPlayer from './components/ShadowingPlayer';
import readmeText from '../README.md?raw';

type View = 'dashboard' | 'settings' | 'quiz' | 'shadowing' | 'help';

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
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'clamp(1rem, 4vw, 2rem)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
          <BrainCircuit color="var(--brand-primary)" />
          <span className="text-gradient">// yuKnow</span>
        </h1>
        <nav style={{ display: 'flex', gap: 'clamp(0.25rem, 2vw, 0.5rem)', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('dashboard')}
            disabled={!isConfigured}
          >
            <BookOpen size={18} /> Flashcards
          </button>
          <button 
            className={`btn ${view === 'shadowing' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('shadowing')}
            disabled={!isConfigured}
          >
            <Headphones size={18} /> Shadowing
          </button>
          <button 
            className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('settings')}
          >
            <Settings size={18} /> Settings
          </button>
          <button 
            className={`btn ${view === 'help' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('help')}
          >
            <HelpCircle size={18} /> Help
          </button>
        </nav>
      </header>
      
      <main 
        className={view === 'shadowing' ? '' : 'glass-panel'} 
        style={view === 'shadowing' ? {} : { padding: 'clamp(1rem, 4vw, 2rem)' }}
      >
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

        {view === 'shadowing' && isConfigured && (
          <ShadowingPlayer geminiApiKey={geminiApiKey} />
        )}
        
        {view === 'help' && (
          <div className="animate-fade-in" style={{ overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={24} /> Documentation
            </h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.85rem' }}>
              {readmeText}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
