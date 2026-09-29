import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, LogIn } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { AlertBell } from '../components/common/AlertBell';
import logo from '../assets/logo.jpg';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    const links: { path: string; label: string }[] = [];
    
    if (role === 'examiner') {
      // Examiner: My queue | Theme toggle | Logout
      links.push({ path: '/examiner', label: 'My queue' });
    } else if (role === 'moderator') {
      // Moderator: Queue | Alerts | Theme toggle | Logout
      links.push({ path: '/moderator', label: 'Queue' });
      links.push({ path: '/controller/alerts', label: 'Alerts' });
    } else if (role === 'controller') {
      // Controller: Dashboard | Exams | Sheets | Examiners | Alerts | Audit | Export | Theme toggle | Logout
      links.push({ path: '/controller', label: 'Dashboard' });
      links.push({ path: '/controller/exams', label: 'Exams' });
      links.push({ path: '/controller/sheets', label: 'Sheets' });
      links.push({ path: '/controller/examiners', label: 'Examiners' });
      links.push({ path: '/controller/alerts', label: 'Alerts' });
      links.push({ path: '/controller/audit', label: 'Audit' });
      links.push({ path: '/controller/export', label: 'Export' });
    }
    
    return links;
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary-500/30 relative overflow-x-hidden">
      {/* Light mode top soft sky-blue glow reminiscent of reference enterprise UI */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-blue-100/40 via-blue-50/20 to-transparent pointer-events-none -z-10 rounded-full blur-3xl dark:opacity-0" />
      
      {/* Enterprise Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <Link to={role ? (role === 'examiner' ? '/examiner' : role === 'moderator' ? '/moderator' : '/controller') : '/'} className="flex items-center space-x-3 hover:opacity-95 transition-opacity">
              <div className="overflow-hidden rounded-full h-10 w-10 border border-slate-200 dark:border-slate-800 flex items-center justify-center bg-white shadow-sm">
                <img src={logo} alt="SAMADHAN X Logo" className="h-9 w-9 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                  SAMADHAN X
                </span>
                <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 leading-tight">
                  On-Screen Marking
                </span>
              </div>
            </Link>
            
            <div className="hidden md:flex space-x-1 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                    location.pathname === link.path 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              
              {/* AlertBell with live count badge from useAlerts */}
              {role && <AlertBell className="mr-1" />}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </button>

              {/* Logout / Login */}
              {!role ? (
                <Link to="/login" className="nav-link flex items-center text-primary-600 dark:text-primary-400 font-semibold text-xs ml-2">
                  <LogIn size={16} className="mr-1.5" /> Login
                </Link>
              ) : (
                <button 
                  onClick={handleLogout} 
                  className="nav-link flex items-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-xs ml-2 py-1.5 px-3 rounded-lg"
                >
                  <LogOut size={16} className="mr-1.5" /> Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}

