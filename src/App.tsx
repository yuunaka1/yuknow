import React, { useState } from 'react';
import { Settings, BookOpen, BrainCircuit, Headphones, HelpCircle, MessageSquare, Globe } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import Quiz from './components/Quiz';
import ShadowingPlayer from './components/ShadowingPlayer';
import Coaching from './components/Coaching';
import LiveTranslation from './components/LiveTranslation';
import MonologueREST from './components/MonologueREST';
import readmeText from '../README.md?raw';
import packageJson from '../package.json';

type View = 'dashboard' | 'settings' | 'quiz' | 'shadowing' | 'coaching' | 'translation' | 'monologue2' | 'help';

function App() {
  const [view, setView] = useState<View>('settings');
  
  const [googleClientId, setGoogleClientId] = useLocalStorage('uknow_google_client_id', '');
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('uknow_gemini_api_key', '');
  const [docId, setDocId] = useLocalStorage('uknow_doc_id', '');
  const [geminiModel, setGeminiModel] = useLocalStorage('uknow_gemini_model', 'gemini-3.1-flash-lite-preview');
  const [translationModel, setTranslationModel] = useLocalStorage('uknow_translation_model', 'gemini-2.5-flash-native-audio-preview-12-2025');
  
  const isFlashcardConfigured = googleClientId && geminiApiKey && docId;
  const isShadowingConfigured = !!geminiApiKey;
  
  // 初期ステートで設定が完了していればダッシュボードを開く
  React.useEffect(() => {
    if (isFlashcardConfigured && view === 'settings') {
      setView('dashboard');
    } else if (isShadowingConfigured && !isFlashcardConfigured && view === 'settings') {
      setView('shadowing');
    }
  }, []);

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'clamp(1rem, 4vw, 2rem)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', margin: 0 }}>
          <BrainCircuit color="var(--brand-primary)" />
          <span className="text-gradient">// yuKnow</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal', fontFamily: 'monospace', marginLeft: '0.5rem' }}>
            v{packageJson.version}
          </span>
        </h1>
        <nav style={{ display: 'flex', gap: 'clamp(0.25rem, 2vw, 0.5rem)', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${view === 'shadowing' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('shadowing')}
            disabled={!isShadowingConfigured}
          >
            <Headphones size={18} /> Shadowing
          </button>
          <button 
            className={`btn ${view === 'coaching' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('coaching')}
            disabled={!isShadowingConfigured}
          >
            <MessageSquare size={18} /> Coaching
          </button>
          <button 
            className={`btn ${view === 'translation' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('translation')}
            disabled={!geminiApiKey}
          >
            <Globe size={18} /> Monologue
          </button>
          <button 
            className={`btn ${view === 'monologue2' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('monologue2')}
            disabled={!geminiApiKey}
          >
            <Globe size={18} /> Monologue 2
          </button>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('dashboard')}
            disabled={!isFlashcardConfigured}
          >
            <BookOpen size={18} /> Flashcards
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
            geminiModel={geminiModel}
            setGeminiModel={setGeminiModel}
            translationModel={translationModel}
            setTranslationModel={setTranslationModel}
            docId={docId}
            setDocId={setDocId}
          />
        )}
        
        {view === 'dashboard' && isFlashcardConfigured && (
          <Dashboard
            googleClientId={googleClientId}
            geminiApiKey={geminiApiKey}
            geminiModel={geminiModel}
            docId={docId}
            onStartQuiz={() => setView('quiz')}
          />
        )}

        {view === 'quiz' && (
          <Quiz onComplete={() => setView('dashboard')} />
        )}

        {view === 'shadowing' && isShadowingConfigured && (
          <ShadowingPlayer geminiApiKey={geminiApiKey} geminiModel={geminiModel} />
        )}

        {view === 'coaching' && isShadowingConfigured && (
          <Coaching geminiApiKey={geminiApiKey} geminiModel={geminiModel} />
        )}
        
        {view === 'translation' && geminiApiKey && (
          <LiveTranslation geminiApiKey={geminiApiKey} modelName={translationModel} title="MONOLOGUE" />
        )}
        
        {view === 'monologue2' && geminiApiKey && (
          <MonologueREST geminiApiKey={geminiApiKey} textModelName={geminiModel} title="MONOLOGUE 2 (3.1 TTS)" />
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
