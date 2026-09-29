import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldCheck, BrainCircuit, Users, Lock, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { role } = useAuth();
  const features = [
    {
      title: "AI Verification",
      desc: "Smart OCR and Face Recognition for seamless onboarding.",
      icon: <BrainCircuit size={28} className="text-primary-600 dark:text-primary-400" />
    },
    {
      title: "Real-time Monitoring",
      desc: "Live analytics and attendance tracking for invigilators.",
      icon: <Users size={28} className="text-slate-700 dark:text-slate-300" />
    },
    {
      title: "Bank-Grade Security",
      desc: "Ensuring fair play and zero cheating with advanced tech.",
      icon: <Lock size={28} className="text-slate-700 dark:text-slate-300" />
    }
  ];

  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="text-center pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-1.5 rounded-full mb-8 font-medium text-sm border border-slate-200 dark:border-slate-700">
            <ShieldCheck size={16} className="text-primary-600 dark:text-primary-400" />
            <span>Next-Gen Examination Ecosystem</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white leading-tight">
            Secure & Intelligent <br />
            <span className="text-primary-600 dark:text-primary-500">Examination Platform</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A secure, fair, and intelligent examination platform empowering students, invigilators, and administrators globally with enterprise-grade tools.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {!role ? (
              <Link to="/login" className="btn-primary text-base px-8 py-3">
                Get Started Securely <ChevronRight size={18} className="ml-2" />
              </Link>
            ) : role === 'student' ? (
              <Link to="/student" className="btn-primary text-base px-8 py-3">
                Go to My Dashboard <ChevronRight size={18} className="ml-2" />
              </Link>
            ) : (
              <Link to={`/${role}`} className="btn-primary text-base px-8 py-3">
                Access Staff Portal <ChevronRight size={18} className="ml-2" />
              </Link>
            )}
            {!role && (
              <a href="#features" className="btn-secondary text-base px-8 py-3">
                Learn More
              </a>
            )}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">Core Capabilities</h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">Powered by advanced AI and real-time data analytics.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-8 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-200 dark:border-slate-700">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white tracking-tight">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
      
      {/* Footer */}
      <footer className="text-center text-slate-500 dark:text-slate-500 pb-8 pt-8">
        <p className="text-sm">© 2026 SAMADHAN X. All rights reserved.</p>
      </footer>
    </div>
  );
}
