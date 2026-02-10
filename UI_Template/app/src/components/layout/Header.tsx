import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from '@/contexts/AuthContext';
import { navItems } from '@/data/vendors';
import { cn } from '@/lib/utils';
import { changeService } from '@/services/changeService';

interface HeaderProps {
  isScrolled: boolean;
}

export function Header({ isScrolled }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const changes = await changeService.getChanges();
        const pending = changes.filter(c => c.status === 'pending').length;
        setPendingCount(pending);
      } catch (error) {
        console.error('Failed to fetch pending count', error);
      }
    };
    fetchPendingCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-custom-expo border-b",
        isScrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm border-gray-200 py-2'
          : 'bg-white border-transparent py-4'
      )}
    >
      <div className="px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section - Logo & Nav */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
                  NSPM
                </h1>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Firewall Analyzer</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-orange-50 text-orange-700 bg-opacity-100"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    {item.label}
                    {item.badge && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px] rounded-sm">
                        {item.badge}
                      </Badge>
                    )}
                    {item.id === 'changes' && pendingCount > 0 && !item.badge && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px] rounded-sm">
                        {pendingCount}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Center Section - Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className={cn("relative transition-all duration-300", searchFocused && "scale-[1.02]")}>
              <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors", searchFocused ? "text-orange-500" : "text-gray-400")} />
              <Input
                type="text"
                placeholder="Search resources..."
                className={cn(
                  "w-full pl-10 bg-gray-50 border-gray-200 focus-visible:ring-orange-500/20 transition-all",
                  searchFocused && "bg-white shadow-lg shadow-orange-500/5 border-orange-200"
                )}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5 text-gray-600" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <div className="flex flex-col gap-4 mt-6">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                          location.pathname === item.path
                            ? "bg-orange-50 text-orange-700"
                            : "text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700 hover:bg-orange-50">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 text-center text-sm text-gray-500">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-1 hover:bg-orange-50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-sm">
                    <span className="font-bold text-xs">{user?.full_name?.[0] || 'U'}</span>
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium text-gray-700 leading-none">{user?.full_name || 'Admin User'}</p>
                    <p className="text-[10px] text-gray-500 leading-none mt-1">{user?.email || 'admin@nspm.com'}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
