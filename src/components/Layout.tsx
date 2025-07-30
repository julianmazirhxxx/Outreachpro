import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingSpinner } from './common/LoadingSpinner';
import { 
  BarChart3, 
  Target, 
  Users, 
  Calendar, 
  Search, 
  Settings, 
  LogOut,
  Crown,
  Zap,
  MessageSquare,
  TrendingUp,
  User
} from 'lucide-react';

export function Layout() {
  const { user, signOut, loading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Campaigns', href: '/campaigns', icon: Target },
    { name: 'Performance', href: '/leads', icon: TrendingUp },
    { name: 'Inbox', href: '/booked', icon: MessageSquare },
    { name: 'New Leads', href: '/targeting', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`min-h-screen ${
      theme === 'gold' 
        ? 'bg-gradient-to-br from-black via-gray-900 to-black'
        : 'bg-gray-50'
    }`}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 ${
        theme === 'gold' 
          ? 'bg-black border-r border-yellow-400/20'
          : 'bg-white border-r border-gray-200'
      } transform transition-transform duration-200 ease-in-out`}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-6 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className={`flex items-center space-x-3`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
            }`}>
              <BarChart3 className={`h-5 w-5 ${
                theme === 'gold' ? 'text-black' : 'text-white'
              }`} />
            </div>
            <span className={`text-xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-blue-600'
            }`}>
              Outreach
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? theme === 'gold'
                        ? 'gold-gradient text-black'
                        : 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : theme === 'gold'
                        ? 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-400/10'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive
                      ? theme === 'gold'
                        ? 'text-black'
                        : 'text-blue-700'
                      : theme === 'gold'
                        ? 'text-gray-400 group-hover:text-yellow-400'
                        : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className={`absolute bottom-0 w-full p-4 border-t ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              theme === 'gold' ? 'bg-yellow-400/20' : 'bg-gray-100'
            }`}>
              <User className={`h-5 w-5 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-600'
              }`} />
            </div>
            <div className="ml-3 flex-1">
              <p className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className={`text-xs ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Member
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              }`}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}