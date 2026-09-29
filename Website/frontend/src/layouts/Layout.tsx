import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, Shield, User, Users, LogOut, LogIn } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
    const links: { path: string; label: string; icon?: React.ReactNode }[] = [{ path: '/', label: 'Home' }];
    
    if (role === 'student') {
      links.push({ path: '/student', label: 'Student Dashboard', icon: <User size={18} className="mr-2 inline" /> });
    } else if (role === 'invigilator') {
      links.push({ path: '/invigilator', label: 'Invigilator Panel', icon: <Users size={18} className="mr-2 inline" /> });
    } else if (role === 'admin') {
      links.push({ path: '/admin', label: 'Admin Command', icon: <Shield size={18} className="mr-2 inline" /> });
      links.push({ path: '/invigilator', label: 'Invigilator Panel', icon: <Users size={18} className="mr-2 inline" /> });
    }
    
    return links;
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary-500/30">
      {/* Enterprise Navigation */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <Link to="/" className="flex items-center space-x-3 hover:opacity-95 transition-opacity">
              <div className="overflow-hidden rounded-full h-10 w-10 border border-slate-200 dark:border-slate-800 flex items-center justify-center bg-white">
                <img src={logo} alt="SAMADHAN X Logo" className="h-9 w-9 object-contain" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">SAMADHAN X</span>
            </Link>
            
            <div className="hidden md:flex space-x-1 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link flex items-center ${
                    location.pathname === link.path ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' : ''
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              
              {!role ? (
                <Link to="/login" className="nav-link flex items-center text-primary-600 dark:text-primary-400 font-semibold">
                  <LogIn size={18} className="mr-2" /> Login
                </Link>
              ) : (
                <button onClick={handleLogout} className="nav-link flex items-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold">
                  <LogOut size={18} className="mr-2" /> Logout
                </button>
              )}
              
              <button
                onClick={toggleTheme}
                className="ml-2 p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
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

