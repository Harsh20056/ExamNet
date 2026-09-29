import React, { useState, useRef } from 'react';
// @ts-ignore
import Tesseract from 'tesseract.js';
import { jsPDF } from 'jspdf';
import { FileText, Image as ImageIcon, Loader2, Download, Radio } from 'lucide-react';

export default function ExamQuestionOCR() {
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://127.0.0.1:5000' : `https://zup-exam-backend-42.loca.lt`);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setText('');
      };
      reader.readAsDataURL(file);
    }
  };

  const extractText = async () => {
    if (!image) return;
    setLoading(true);
    setProgress(0);
    try {
      const { data: { text } } = await Tesseract.recognize(
        image,
        'eng',
        {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );
      setText(text);
    } catch (err) {
      console.error(err);
      alert('Failed to extract text. Please try again.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const generatePDF = () => {
    if (!text) return;
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 15, 15);
    doc.save('exam_questions.pdf');
  };

  const broadcastExam = async () => {
    if (!text) return;
    setBroadcasting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/broadcast-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperText: text })
      });
      if (!res.ok) throw new Error('Failed to broadcast');
      alert('Exam successfully broadcasted to all students! Timer (3 Hours) has started.');
    } catch (err) {
      console.error(err);
      alert('Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-6 mb-8">
      <div className="flex items-center mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-indigo-600 dark:text-indigo-400 mr-4">
          <FileText size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Exam Question Digitizer (OCR)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Upload an image of questions to extract text and convert it to a PDF document.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors h-64 relative overflow-hidden group"
          >
            {image ? (
              <>
                <img src={image} alt="Uploaded questions" className="absolute inset-0 w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">Click to change image</span>
                </div>
              </>
            ) : (
              <>
                <ImageIcon size={48} className="text-slate-400 mb-4" />
                <p className="font-medium text-slate-700 dark:text-slate-300">Click to upload image</p>
                <p className="text-sm text-slate-500 mt-1">PNG, JPG up to 10MB</p>
              </>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
          </div>

          <div className="flex space-x-3">
            <button 
              onClick={() => { setImage(null); setText(''); }}
              disabled={!image || loading}
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={extractText}
              disabled={!image || loading}
              className="flex-1 btn-primary py-2 px-4 text-sm flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Extracting... {progress}%
                </>
              ) : (
                'Extract Text (OCR)'
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col h-full space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Extracted text will appear here. You can also edit it before generating the PDF."
            className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:outline-none text-slate-700 dark:text-slate-300 min-h-[256px] text-sm"
          />
          <div className="flex space-x-3">
            <button 
              onClick={generatePDF}
              disabled={!text}
              className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              <Download size={18} className="mr-2" /> PDF
            </button>
            <button 
              onClick={broadcastExam}
              disabled={!text || broadcasting}
              className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              {broadcasting ? <Loader2 size={18} className="animate-spin mr-2" /> : <Radio size={18} className="mr-2" />}
              Broadcast Exam & Start Timer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
