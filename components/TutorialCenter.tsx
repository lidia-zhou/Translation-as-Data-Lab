
import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { generateTutorialScript, speakTutorialPart, generateAtmosphericVideo } from '../services/geminiService';
import { SAMPLE_TUTORIAL_SCRIPT } from '../constants';

interface TutorialCenterProps {
  project: Project;
  onClose: () => void;
}

const TutorialCenter: React.FC<TutorialCenterProps> = ({ project, onClose }) => {
  const [chapters, setChapters] = useState<{ title: string, content: string }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const audioRef = useRef<AudioBufferSourceNode | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initTutorial = async () => {
    setIsLoading(true);
    
    // Check if we are in Sample Project and if API is missing
    const isSample = project.id.startsWith('sample-');
    const hasKey = !!process.env.API_KEY;

    if (isSample && !hasKey) {
        // Use static pre-baked content
        setChapters(SAMPLE_TUTORIAL_SCRIPT);
        // Use a placeholder high-quality abstract background video URL
        setVideoUrl("https://assets.mixkit.co/videos/preview/mixkit-abstract-flow-of-indigo-liquid-waves-33061-large.mp4");
        setUseAI(false);
    } else {
        // Try to use AI if key exists, otherwise fallback to sample if applicable
        if (hasKey) {
            try {
                const script = await generateTutorialScript(project);
                setChapters(script);
                const video = await generateAtmosphericVideo(`A cinematic, high resolution slow motion shot of glowing knowledge lines connecting across a dark world map, academic and ethereal.`);
                setVideoUrl(video);
                setUseAI(true);
            } catch (e) {
                if (isSample) setChapters(SAMPLE_TUTORIAL_SCRIPT);
            }
        } else if (isSample) {
            setChapters(SAMPLE_TUTORIAL_SCRIPT);
            setVideoUrl("https://assets.mixkit.co/videos/preview/mixkit-abstract-flow-of-indigo-liquid-waves-33061-large.mp4");
        }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initTutorial();
    return () => {
        window.speechSynthesis.cancel();
        audioRef.current?.stop();
    };
  }, []);

  const playChapter = async (idx: number) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      audioRef.current?.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    if (useAI && process.env.API_KEY) {
        // Use Gemini TTS
        const buffer = await speakTutorialPart(chapters[idx].content);
        if (buffer) {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => {
            setIsSpeaking(false);
            if (idx < chapters.length - 1) setCurrentIdx(idx + 1);
          };
          source.start(0);
          audioRef.current = source;
        } else {
          fallbackSpeech(idx);
        }
    } else {
        fallbackSpeech(idx);
    }
  };

  const fallbackSpeech = (idx: number) => {
    const utterance = new SpeechSynthesisUtterance(chapters[idx].content);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onend = () => {
        setIsSpeaking(false);
        if (idx < chapters.length - 1) setCurrentIdx(idx + 1);
    };
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[700] flex flex-col items-center justify-center text-white p-10 animate-fadeIn">
        <div className="w-16 h-16 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl font-bold serif">准备实验室导览...</h2>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[700] flex flex-col overflow-hidden animate-fadeIn">
      <div className="relative h-[60%] w-full bg-slate-950 overflow-hidden flex items-center justify-center">
        {videoUrl ? (
          <video 
            src={videoUrl} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-slate-950"></div>
        )}
        
        <div className="relative z-10 text-center space-y-6 max-w-4xl px-10">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Archival Tutorial • Stage {currentIdx + 1}</div>
          <h2 className="text-5xl font-bold text-white serif tracking-tight drop-shadow-2xl">{chapters[currentIdx]?.title}</h2>
          <div className="h-1 w-20 bg-indigo-500 mx-auto rounded-full"></div>
        </div>

        <button onClick={onClose} className="absolute top-10 right-10 text-white text-5xl font-light hover:text-indigo-400 transition-all leading-none z-50">&times;</button>
        
        {!useAI && !process.env.API_KEY && (
             <div className="absolute bottom-10 left-10 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Local Mode (No API)</span>
             </div>
        )}
      </div>

      <div className="flex-1 bg-white p-12 flex flex-col justify-between border-t border-slate-100">
        <div className="max-w-3xl mx-auto text-center">
           <p className="text-2xl font-serif text-slate-800 leading-relaxed italic">
             "{chapters[currentIdx]?.content}"
           </p>
        </div>

        <div className="max-w-xl mx-auto w-full flex flex-col items-center space-y-6">
           <button 
             onClick={() => playChapter(currentIdx)}
             className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isSpeaking ? 'bg-indigo-600 text-white scale-110 shadow-indigo-200' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
           >
              {isSpeaking ? (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-6 bg-white rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-10 bg-white rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-6 bg-white rounded-full animate-bounce delay-150"></div>
                </div>
              ) : (
                <span className="text-3xl ml-1">▶</span>
              )}
           </button>
           
           <div className="flex gap-3 w-full">
              {chapters.map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => {
                    setCurrentIdx(i);
                    setIsSpeaking(false);
                    window.speechSynthesis.cancel();
                    audioRef.current?.stop();
                  }}
                  className={`flex-1 h-1.5 rounded-full transition-all ${i === currentIdx ? 'bg-indigo-600' : 'bg-slate-100 hover:bg-slate-200'}`}
                />
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialCenter;
