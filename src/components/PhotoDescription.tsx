import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Play, Square, RefreshCcw, Loader, AlertTriangle, FileText } from 'lucide-react';
import { evaluatePhotoDescriptionWithGemini } from '../utils/gemini';
import ReactMarkdown from 'react-markdown';

type PracticePhase = 'idle' | 'prep' | 'speaking' | 'evaluating' | 'result' | 'error';

const SAMPLE_PHOTOS = [
  { id: '1', url: './photos/photo1.jpg', title: 'Office Meeting' },
  { id: '2', url: './photos/photo2.jpg', title: 'Airport Terminal' },
  { id: '3', url: './photos/photo3.jpg', title: 'Outdoor Cafe' },
  { id: '4', url: './photos/photo4.jpg', title: 'Construction Site' },
  { id: '5', url: './photos/photo5.jpg', title: 'Classroom Lecture' },
  { id: '6', url: './photos/photo6.jpg', title: 'Hotel Reception' },
];

export default function PhotoDescription({ geminiApiKey, geminiModel }: { geminiApiKey: string, geminiModel: string }) {
  const [phase, setPhase] = useState<PracticePhase>('idle');
  const [currentPhoto, setCurrentPhoto] = useState(SAMPLE_PHOTOS[0]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultMarkdown, setResultMarkdown] = useState("");
  
  // Audio state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer reference
  const timerRef = useRef<number | null>(null);

  // Clean timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current!);
  }, []);

  const getRandomPhoto = () => {
    const available = SAMPLE_PHOTOS.filter(p => p.id !== currentPhoto.id);
    const random = available[Math.floor(Math.random() * available.length)];
    setCurrentPhoto(random);
    setPhase('idle');
    setResultMarkdown("");
  };

  const startPrep = () => {
    setPhase('prep');
    setTimeLeft(45); // 45 seconds prep
    
    clearInterval(timerRef.current!);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          startSpeaking();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startSpeaking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processEvaluation(audioBlob);
      };

      mediaRecorder.start();
      setPhase('speaking');
      setTimeLeft(45); // 45 seconds speak

      clearInterval(timerRef.current!);
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            stopSpeaking();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (e: any) {
      console.error(e);
      setErrorMsg("マイクへのアクセスが拒否されたか、エラーが発生しました。");
      setPhase('error');
    }
  };

  const stopTimer = () => {
     clearInterval(timerRef.current!);
  }

  const stopSpeaking = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const processEvaluation = async (audioBlob: Blob) => {
    setPhase('evaluating');
    try {
      // 1. Fetch the image to get a blob
      const imgResponse = await fetch(currentPhoto.url);
      const imgBlob = await imgResponse.blob();

      // 2. Transcribe and evaluate multimodally via our new gemini function
      const evaluation = await evaluatePhotoDescriptionWithGemini(
        geminiApiKey,
        imgBlob,
        audioBlob,
        geminiModel
      );
      
      setResultMarkdown(evaluation);
      setPhase('result');
      
      // Save history logic here if needed (e.g., using localStorage)

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "評価中にエラーが発生しました。");
      setPhase('error');
    }
  };
  
  const resetPractice = () => {
    stopTimer();
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(t => t.stop());
    }
    setPhase('idle');
    setResultMarkdown("");
    setTimeLeft(0);
  };

  // UI Setup
  const mainColor = phase === 'speaking' ? '#ff3333' : phase === 'prep' ? '#ffaa00' : '#00ccff';
  const progressPercent = phase === 'prep' || phase === 'speaking' ? (timeLeft / 45) * 100 : 0;

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00ccff', margin: 0, fontSize: '1.25rem' }}>
          <Camera size={20} /> Photo Description
        </h2>
        
        {phase === 'result' && (
           <button 
             onClick={getRandomPhoto}
             className="btn btn-secondary"
             style={{ fontSize: '0.85rem' }}
           >
             <RefreshCcw size={16} /> NEXT PHOTO
           </button>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid #ff3333', borderRadius: '4px', color: '#ff3333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', flexDirection: 'row' }}>
        
        {/* Left Side: Photo Display & Controls */}
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ 
            width: '100%', 
            aspectRatio: '4/3', 
            backgroundColor: '#0a0a0a',
            border: `2px solid ${phase === 'idle' || phase === 'result' ? '#002244' : mainColor}`,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: `0 0 15px ${(phase === 'prep' || phase === 'speaking') ? mainColor + '44' : 'transparent'}`
          }}>
            <img 
              src={currentPhoto.url} 
              alt={currentPhoto.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Timer Overlay */}
            {(phase === 'prep' || phase === 'speaking') && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                color: 'white'
              }}>
                 <div style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '2px', background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '4px', marginBottom: '1rem', color: mainColor }}>
                   {phase === 'prep' ? 'PREPARATION TIME' : 'SPEAKING TIME'}
                 </div>
                 <div style={{ fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                   00:{timeLeft.toString().padStart(2, '0')}
                 </div>
                 
                 {/* Progress Bar under time */}
                 <div style={{ width: '60%', height: '6px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: mainColor, transition: 'width 1s linear' }} />
                 </div>
              </div>
            )}
          </div>
          
          {/* Controls Below Photo */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            {phase === 'idle' && (
              <>
                <button className="btn btn-primary" onClick={startPrep} style={{ padding: '0.75rem 2rem' }}>
                  <Play size={18} /> START PRACTICE
                </button>
                <button className="btn btn-secondary" onClick={getRandomPhoto} title="Change Photo">
                  <RefreshCcw size={18} />
                </button>
              </>
            )}
            
            {phase === 'prep' && (
              <button className="btn btn-primary" onClick={() => { clearInterval(timerRef.current!); startSpeaking(); }} style={{ padding: '0.75rem 2rem', backgroundColor: '#00ccff', color: 'black' }}>
                <Mic size={18} /> SKIP PREP (SPEAK NOW)
              </button>
            )}
            
            {phase === 'speaking' && (
              <button className="btn btn-secondary" onClick={() => { clearInterval(timerRef.current!); stopSpeaking(); }} style={{ padding: '0.75rem 2rem', color: '#ff3333', borderColor: '#ff3333' }}>
                <Square size={18} /> FINISH EARLY
              </button>
            )}

            {(phase === 'prep' || phase === 'speaking' || phase === 'error' || phase === 'result') && (
              <button className="btn btn-secondary" onClick={resetPractice} title="Abort/Reset">
                <RefreshCcw size={18} /> ABORT
              </button>
            )}
          </div>

          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <p><strong>Rules:</strong> You will have 45 seconds to prepare your response, and then 45 seconds to speak about the picture.</p>
            {phase === 'evaluating' && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', padding: '1rem', backgroundColor: 'rgba(0,204,255,0.1)', borderRadius: '4px' }}>
                 <Loader size={18} className="animate-spin" /> Analyzing your response with Gemini Multimodal Audio API...
               </div>
            )}
          </div>
        </div>

        {/* Right Side: Evaluation Results */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            flex: 1, 
            backgroundColor: '#050a14', 
            border: '1px solid #002244', 
            borderRadius: '8px', 
            padding: '1.5rem',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 250px)'
          }}>
            {!resultMarkdown && phase !== 'result' && (
               <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-tertiary)', opacity: 0.5 }}>
                 <FileText size={48} style={{ marginBottom: '1rem' }} />
                 <p>Your performance feedback will appear here.</p>
               </div>
            )}
            {resultMarkdown && (
              <div className="markdown-body" style={{ fontSize: '0.9rem' }}>
                <ReactMarkdown>{resultMarkdown}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
