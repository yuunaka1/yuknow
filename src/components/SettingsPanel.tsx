interface SettingsPanelProps {
  googleClientId: string;
  setGoogleClientId: (val: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  docId: string;
  setDocId: (val: string) => void;
}

export default function SettingsPanel({
  googleClientId, setGoogleClientId,
  geminiApiKey, setGeminiApiKey,
  docId, setDocId
}: SettingsPanelProps) {
  
  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem' }}>Settings & API Configuration</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Configure your private APIs to enable uKnow. Your keys are stored locally in your browser.
      </p>
      
      <div className="form-group">
        <label className="form-label" htmlFor="googleClientId">
          Google Client ID (OAuth 2.0)
        </label>
        <input 
          id="googleClientId"
          className="form-input" 
          type="text" 
          placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Required to read your private Google Docs securely.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiApiKey">
          Gemini API Key
        </label>
        <input 
          id="geminiApiKey"
          className="form-input" 
          type="password" 
          placeholder="AIzaSy..."
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Get this from Google AI Studio. We use gemini-3.1-flash-lite-preview.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="docId">
          Google Docs Document ID
        </label>
        <input 
          id="docId"
          className="form-input" 
          type="text" 
          placeholder="e.g. 1BxiMvs0XRY..."
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          The ID component from your Google Docs URL: https://docs.google.com/document/d/&lt;b&gt;[DOC_ID]&lt;/b&gt;/edit
        </p>
      </div>
      
      {geminiApiKey && !googleClientId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>Shadowing Ready!</strong> You can now use the Shadowing feature.
        </div>
      )}
      
      {googleClientId && geminiApiKey && docId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>All Systems Ready!</strong> You can now use both Flashcards and Shadowing.
        </div>
      )}
    </div>
  );
}
