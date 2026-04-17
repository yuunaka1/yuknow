import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, Zap, LogOut, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// --- Types ---
type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
}

// --- Audio Output Player (24kHz PCM) ---
class AudioStreamPlayer {
  audioContext: AudioContext;
  nextStartTime: number;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.nextStartTime = this.audioContext.currentTime;
  }

  async playPcmData(base64Pcm: string, sampleRate = 24000) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, sampleRate);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05; 
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stop() {
    this.audioContext.close();
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.nextStartTime = this.audioContext.currentTime;
  }
}

// --- Audio Input Recorder (16kHz PCM) ---
class AudioRecorder {
  audioContext: AudioContext | null = null;
  mediaStreamSrc: MediaStreamAudioSourceNode | null = null;
  processor: ScriptProcessorNode | null = null;
  stream: MediaStream | null = null;
  gainNode: GainNode | null = null;

  async start(onPcmChunk: (base64: string) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.mediaStreamSrc = this.audioContext.createMediaStreamSource(this.stream);
    
    // ScriptProcessor is deprecated but works uniformly across browsers for raw PCM capture
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    // Prevent mic echo
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;

    this.mediaStreamSrc.connect(this.processor);
    this.processor.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      // Ensure Float32 is within [-1, 1] then convert to 16-bit PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
         binary += String.fromCharCode(bytes[i]);
      }
      const chunk = btoa(binary);
      onPcmChunk(chunk);
    };
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.mediaStreamSrc) {
      this.mediaStreamSrc.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
  }
}

// --- Component ---
export default function GeminiLive({ geminiApiKey }: { geminiApiKey: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useLocalStorage<LogMessage[]>('uknow_geminilive_logs', []);
  const [errorDetails, setErrorDetails] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const modelOverride = "models/gemini-3.1-flash-live-preview";

  const addLog = useCallback((text: string, sender: 'user' | 'model' | 'system') => {
    setLogs(prev => {
      const arr = [...prev, { id: Math.random().toString(), text, sender }];
      return arr.slice(-150);
    });
  }, [setLogs]);

  const clearLogs = () => {
    if (window.confirm("Clear Live session logs?")) setLogs([]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);



  const startSession = async () => {
    if (!geminiApiKey) {
      addLog("API Key missing.", "system");
      return;
    }

    try {
      setAppState('connecting');
      setErrorDetails("");
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      // 1. Establish WebSocket
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`Connected to Multimodal Live API (${modelOverride})`, "system");
        
        // 2. Send Setup Message
        const setupMsg = {
          setup: {
            model: modelOverride,
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        stopSession();
        if (event.code !== 1000) { // Disconnected abnormally
           let detail = "";
           if (event.code === 1007) detail = "(1007: Unsupported Payload/Model Mismatch. Check if the model supports Live API.)";
           addLog(`Disconnected from API (${event.code}) ${detail}`, "system");
           setErrorDetails(`Disconnect code: ${event.code} ${detail}`);
           setAppState('error');
        } else {
           addLog("Session ended gracefully.", "system");
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setAppState('error');
        addLog("WebSocket Error occurred.", "system");
      };

      ws.onmessage = async (event) => {
        // Blob to JSON parsing if necessary, Gemini WS sometimes returns string or Blob.
        let msgStr = "";
        if (event.data instanceof Blob) {
           msgStr = await event.data.text();
        } else {
           msgStr = event.data;
        }

        try {
          const payload = JSON.parse(msgStr);

          // Handle Setup Complete
          if (payload.setupComplete) {
            setAppState('listening');
            addLog("Setup complete. Starting microphone...", "system");
            
            // Start recording and streaming!
            await recorderRef.current?.start((base64pcm) => {
               if (wsRef.current?.readyState === WebSocket.OPEN) {
                 const audioMessage = {
                   realtimeInput: {
                     audio: { mimeType: "audio/pcm;rate=16000", data: base64pcm }
                   }
                 };
                 wsRef.current.send(JSON.stringify(audioMessage));
               }
            });
          }

          // Handle Server Content (Responses)
          if (payload.serverContent) {
             const content = payload.serverContent;
             
             // Interrupt event
             if (content.interrupted) {
                addLog("Interrupted by user.", "system");
                playerRef.current?.stop();
                setAppState('listening');
             }

             // Model turn payload
             if (content.modelTurn) {
                if (content.modelTurn.parts) {
                   let textBuf = "";
                   for (const part of content.modelTurn.parts) {
                     if (part.text) {
                        textBuf += part.text;
                     }
                     if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                        // Play audio
                        setAppState('speaking');
                        await playerRef.current?.playPcmData(part.inlineData.data);
                     }
                   }
                   if (textBuf.trim()) {
                     addLog(textBuf, "model");
                   }
                }
             }

             // Transcriptions
             if (content.inputTranscription && content.inputTranscription.text) {
                // User's voice transcription
                addLog(content.inputTranscription.text, "user");
             }
             
             if (content.outputTranscription && content.outputTranscription.text) {
                // Model's voice transcription (if output is exclusively audio)
                addLog(content.outputTranscription.text, "model");
             }
             
             // Turn complete
             if (content.turnComplete) {
                setAppState('listening');
             }
          }

        } catch (e) {
          console.error("Message Parsing Error:", e);
        }
      };

    } catch (e: any) {
      console.error(e);
      setAppState('error');
      setErrorDetails(e.message);
      addLog(`Failed to start session: ${e.message}`, "system");
    }
  };

  const stopSession = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    
    playerRef.current?.stop();
    playerRef.current = null;
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setAppState(prev => (prev !== 'idle' && prev !== 'error' ? 'idle' : prev));
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);


  const btnBaseStyles = {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    border: '1px solid currentColor',
    transition: 'all 0.2s',
  };

  const statusColors = {
    idle: '#aaa',
    connecting: '#ffaa00',
    listening: '#00ff41',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    error: '#ff3333'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00ff41', margin: 0, fontSize: '1.25rem' }}>
          <Zap size={20} /> GEMINI LIVE MODE
        </h2>

        {/* Control Panel Inline */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: '#00ff41', backgroundColor: 'rgba(0, 255, 65, 0.1)' }}
            >
              <Mic size={16} /> START
            </button>
          ) : (
            <button 
              onClick={stopSession}
              style={{ ...btnBaseStyles, color: '#ff3333', backgroundColor: 'rgba(255, 51, 51, 0.1)' }}
            >
              <LogOut size={16} /> END
            </button>
          )}

          {/* State Indicator */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontWeight: 'bold', 
            color: currentColor,
            backgroundColor: 'rgba(0,0,0,0.4)',
            padding: '0.4rem 0.75rem',
            borderRadius: '4px',
            border: `1px solid ${currentColor}22`,
            fontSize: '0.85rem'
          }}>
            {(appState === 'connecting' || appState === 'processing') && <Loader size={14} className="animate-spin" />}
            {appState === 'error' && <AlertTriangle size={14} />}
            {appState === 'listening' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}`, animation: 'pulse 1.5s infinite' }}></div>}
            {appState === 'speaking' && <Globe size={14} className="animate-pulse" />}
            
            <span style={{ letterSpacing: '1px' }}>{appState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {errorDetails && (
         <div style={{ padding: '1rem', marginBottom: '2rem', color: '#ff3333', backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid #ff3333', borderRadius: '4px' }}>
            <AlertTriangle size={18} style={{ marginBottom: '0.5rem' }}/>
            <br />
            {errorDetails}
         </div>
      )}

      {/* Terminal Log */}
      <div style={{
        flex: 1,
        padding: '1rem',
        backgroundColor: '#0a0a00',
        border: '1px solid #005000',
        borderRadius: '4px',
        overflowY: 'auto',
        fontFamily: "'Fira Code', monospace"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#005000', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            WS_LIVE_STREAM_LOG
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={clearLogs}
              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
            >
              <Trash2 size={12} /> CLEAR
            </button>
          )}
        </div>
        
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Ready to establish WebSocket stream...</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? '#00ff41' : log.sender === 'user' ? '#888' : '#005000',
                fontSize: '0.9rem',
                fontStyle: log.sender === 'system' ? 'italic' : 'normal',
                opacity: log.sender === 'system' ? 0.7 : 1,
              }}
            >
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {log.sender === 'user' ? '> ' : log.sender === 'model' ? '< ' : '* '}
                {log.text}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

    </div>
  );
}
