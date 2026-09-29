import { motion } from 'framer-motion';
import { 
  FileEdit, 
  Sparkles, 
  ShieldAlert, 
  Sliders, 
  History, 
  CheckCircle2, 
  Lock, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Card } from '../components/Card';

export default function LandingPage() {
  const modules = [
    {
      title: "Marking Workspace",
      desc: "Distraction-free high-resolution digital script viewer with instant question navigation, rubric sidebars, and point-and-click score calculation.",
      icon: <FileEdit size={26} className="text-primary-600 dark:text-primary-400" />
    },
    {
      title: "AI Assist",
      desc: "Smart handwriting OCR transcription, keyword and model-answer alignment scores, and intelligent step-wise rubric suggestions.",
      icon: <Sparkles size={26} className="text-indigo-600 dark:text-indigo-400" />
    },
    {
      title: "Anomaly Detection",
      desc: "Real-time algorithmic surveillance flagging rapid grading violations (< 15s), uncalibrated variance spikes, and atypical score distributions.",
      icon: <ShieldAlert size={26} className="text-red-600 dark:text-red-400" />
    },
    {
      title: "Moderation & Dashboards",
      desc: "Blind sample audits, targeted review workflows for disputed evaluations, quota velocity tracking, and tamper-proof controller score sign-off.",
      icon: <Sliders size={26} className="text-emerald-600 dark:text-emerald-400" />
    }
  ];

  const differentiators = [
    {
      title: "Cryptographic Audit Trail",
      desc: "Every rubric click, score revision, and page view is immutably timestamped with evaluator credentials and stored for regulatory compliance.",
      icon: <History size={24} className="text-primary-500" />
    },
    {
      title: "Active Calibration Windows",
      desc: "Standardized benchmark scripts ensure all examiners maintain cohort grading consistency before evaluating live answer sheets.",
      icon: <CheckCircle2 size={24} className="text-emerald-500" />
    },
    {
      title: "Secure Marking Mode",
      desc: "Full browser focus enforcement, blur/tab-switch prevention, watermarked overlays, and session-locked biometric identity verification.",
      icon: <Lock size={24} className="text-amber-500" />
    }
  ];

  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="text-center pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          {/* Top Pill Tag - exact style like reference screenshot */}
          <div className="inline-flex items-center space-x-2 bg-blue-50/80 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 px-3.5 py-1.5 rounded-full mb-8 font-mono text-xs border border-blue-200/80 dark:border-primary-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
            <span className="font-semibold tracking-wide uppercase">PS 26121 · ON-SCREEN MARKING · SMART INDIA HACKATHON 2026</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-slate-900 dark:text-white leading-[1.15]">
            Answer-sheet evaluation, turned into a <br className="hidden sm:inline" />
            <span className="text-primary-600 dark:text-primary-400">calibrated, tamper-proof workflow.</span>
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-9 leading-relaxed font-normal">
            A decision-support layer beside examiners and controllers — transcribes handwriting, correlates rubric compliance, and flags evaluation anomalies ahead of sign-off.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
            <a 
              href="#modules" 
              className="btn-primary px-6 py-3 rounded-full text-sm font-semibold shadow-md shadow-primary-500/10 hover:shadow-primary-500/20"
            >
              <span>Explore Modules</span>
              <ArrowRight size={16} className="ml-2" />
            </a>
            <a 
              href="#differentiators" 
              className="btn-secondary px-6 py-3 rounded-full text-sm font-semibold"
            >
              <span>System Architecture ↓</span>
            </a>
          </div>

          {/* Pitch Problem Statement Card */}
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 text-left max-w-3xl mx-auto mb-6 shadow-sm">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-xl mt-0.5 border border-blue-100 dark:border-primary-800/40">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">The Challenge: Slow, Error-Prone Manual Evaluation</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Traditional paper grading suffers from physical loss in transit, calculation errors in manual mark tallying, erratic evaluation velocities, and lack of real-time oversight. Boards face weeks of post-exam delays and expensive re-totaling disputes.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4 Core Modules */}
      <section id="modules" className="py-12 border-t border-slate-200/80 dark:border-slate-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">4 Comprehensive Modules</h2>
          <p className="text-slate-600 dark:text-slate-400 text-base max-w-2xl mx-auto">
            Architected specifically for high-stakes university and public service examination cycles.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((mod, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="h-full flex flex-col justify-between p-6 hover:border-primary-500/50 hover:shadow-md transition-all group">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform border border-slate-200 dark:border-slate-700">
                    {mod.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white tracking-tight">{mod.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400">
                  <span>Module Details</span>
                  <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* The Differentiators */}
      <section id="differentiators" className="py-12 border-t border-slate-200/80 dark:border-slate-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">Built-In Trust & Differentiators</h2>
          <p className="text-slate-600 dark:text-slate-400 text-base max-w-2xl mx-auto">
            Enterprise-grade governance layers ensuring 100% defense against grading bias and tampering.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {differentiators.map((diff, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.15, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="p-8 h-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-700">
                  {diff.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">{diff.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {diff.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-slate-500 dark:text-slate-500 pb-8 pt-8 border-t border-slate-200 dark:border-slate-800">
        <p className="text-sm">© 2026 SAMADHAN X – On-Screen Marking System. All rights reserved.</p>
      </footer>
    </div>
  );
}
