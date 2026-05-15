/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Send, 
  Hash, 
  MapPin, 
  Calendar, 
  Newspaper, 
  Image as ImageIcon,
  Loader2,
  Share2,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateNews, generateNewsImage, type GeneratedNews } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOGO_URL = "https://i.postimg.cc/brKwkSQD/recrea-este-logo-en-fondo-202605012011.jpg";

export default function App() {
  const [facts, setFacts] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedNews | null>(null);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!facts.trim()) return;
    
    setIsGenerating(true);
    setResult(null);
    setGeneratedImg(null);
    
    try {
      const news = await generateNews(facts);
      setResult(news);
      
      if (!image) {
        const aiImg = await generateNewsImage(news.headline);
        setGeneratedImg(aiImg);
      }
    } catch (error) {
      console.error("Error generating news:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `${result.headline}\n\n${result.lead}\n\n${result.body}\n\n${result.hashtags.join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white border-[8px] border-white shadow-2xl overflow-hidden font-sans">
      {/* Sidebar: Generator Controls */}
      <aside className="w-full md:w-[360px] bg-zinc-900 text-white p-8 flex flex-col justify-between z-20 shrink-0 overflow-y-auto">
        <div className="space-y-8">
          <div className="mb-4">
            <img 
              src={LOGO_URL} 
              alt="RECREA Logo" 
              className="w-16 h-16 rounded-full border-2 border-white mb-4 object-cover"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-4xl font-display font-black tracking-tighter leading-none italic uppercase">
              RECREA<span className="text-red-500">.</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mt-1 font-bold">
              Quindío News Architect
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">
                Hechos del Quindío
              </label>
              <textarea
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Ej: Avances en el Túnel de la Línea y su impacto en el turismo..."
                className="w-full bg-zinc-800 border border-zinc-700 p-4 text-xs h-32 focus:outline-none focus:border-red-600 resize-none transition-all placeholder:opacity-30"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">
                Acciones Multimedia
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full h-16 border-2 border-dashed border-zinc-700 flex items-center justify-center text-[10px] uppercase tracking-widest text-zinc-500 hover:border-red-600 transition-all cursor-pointer group",
                  image && "border-red-600 bg-red-600/10"
                )}
              >
                {image ? (
                  <span className="text-red-400">Imagen Cargada ✓</span>
                ) : (
                  <span className="group-hover:text-red-500">Subir Fotografía</span>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <button
                onClick={() => { setImage(null); setFacts(''); setResult(null); }}
                className="text-[9px] uppercase tracking-widest text-zinc-600 hover:text-red-400 transition-colors"
              >
                Resetear Editor
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !facts.trim()}
          className={cn(
            "mt-8 w-full py-5 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
            isGenerating || !facts.trim() 
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
              : "bg-white text-black hover:bg-red-600 hover:text-white"
          )}
        >
          {isGenerating ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            'Generar Publicación'
          )}
        </button>
      </aside>

      {/* Main Viewport: Editorial Preview */}
      <main className="flex-1 relative bg-editorial-bone p-6 md:p-12 overflow-y-auto editorial-grid">
        <AnimatePresence mode="wait">
          {!result && !isGenerating && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-4"
            >
              <Newspaper size={64} className="opacity-10" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-black italic opacity-20">Esperando contenido</p>
                <p className="text-xs italic opacity-30 mt-2 max-w-xs">Define los hechos para construir la narrativa de hoy.</p>
              </div>
            </motion.div>
          )}

          {isGenerating && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center"
            >
              <div className="w-16 h-1 bg-red-600 animate-pulse mb-8" />
              <p className="text-4xl font-display font-black uppercase italic tracking-tighter animate-bounce">Architecting News...</p>
            </motion.div>
          )}

          {result && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full space-y-8"
            >
              {/* Header */}
              <div className="border-b-2 border-zinc-900 pb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between font-display gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      Editorial Quindío
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      {new Date().toLocaleDateString('es-CO', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                    Marca: RECREA Network
                  </span>
                </div>
                <h2 className="text-5xl md:text-7xl font-display font-black uppercase leading-[0.85] tracking-tighter">
                  {result.headline.split(' ').map((word, i) => (
                    <span key={i} className={i % 3 === 1 ? 'italic text-red-600' : ''}>
                      {word}{' '}
                    </span>
                  ))}
                </h2>
              </div>

              {/* Grid Content */}
              <div className="grid lg:grid-cols-3 gap-12 flex-1 min-h-0">
                {/* Visual Area */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="relative group aspect-[4/3] bg-zinc-200 overflow-hidden shadow-2xl border border-zinc-200">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                    <img 
                      src={image || generatedImg || ""} 
                      alt="News Visual" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-6 left-6 z-20 text-white">
                      <p className="text-[40px] font-display font-black italic tracking-tighter leading-none">RECREA</p>
                      <p className="text-[9px] uppercase tracking-widest opacity-80 mt-1">Publicidad & Noticias Regionales</p>
                    </div>
                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                      <div className="bg-white/90 backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                        AI Content
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-l-4 border-red-600 pl-6 py-2">
                    <p className="text-xl md:text-2xl font-serif italic text-zinc-700 leading-relaxed italic">
                      "{result.lead}"
                    </p>
                  </div>
                </div>

                {/* Meta & Hashtags */}
                <div className="flex flex-col justify-between py-2">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Desarrollo</h3>
                      <div className="prose prose-zinc prose-sm leading-relaxed text-zinc-600 font-sans">
                        <ReactMarkdown>{result.body}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-zinc-200">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Smart Hashtags</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.hashtags.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="bg-zinc-900 text-white font-mono text-[9px] px-2 py-1.5 uppercase hover:bg-red-600 transition-colors cursor-default"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-8">
                    <div className="bg-zinc-900 p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center text-white">
                        <div className="space-y-0.5">
                          <p className="text-[8px] uppercase tracking-widest opacity-40">Prioridad Difusión</p>
                          <p className="text-xs font-black uppercase tracking-tighter">Máxima Relevancia</p>
                        </div>
                        <div className="flex gap-1.5">
                          {[1, 2, 3].map(i => (
                            <div key={i} className={cn("w-2 h-2 rounded-full", i === 1 ? 'bg-red-600' : 'bg-zinc-700')} />
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={copyToClipboard}
                        className={cn(
                          "w-full py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                          copied ? "bg-green-600 text-white" : "bg-white text-black hover:bg-zinc-200"
                        )}
                      >
                        {copied ? 'CONTENIDO COPIADO' : 'COPIAR ARTE FINAL'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
