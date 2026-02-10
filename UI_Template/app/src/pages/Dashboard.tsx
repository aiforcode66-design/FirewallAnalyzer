import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  Server,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  FileText,
  GitBranch,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dashboardService } from '@/services/dashboardService';
import type { DashboardActivity, TrafficPoint } from '@/services/dashboardService';
import { vendorService } from '@/services/deviceService';
import type { DashboardStats } from '@/types';
import type { Vendor } from '@/services/deviceService';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: string; // Tailwind text color class, e.g., 'text-blue-500'
  bgColor: string; // Tailwind bg color class, e.g., 'bg-blue-50'
  delay?: number;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  color,
  bgColor,
  delay = 0,
}: StatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power3.out' }
      );
    }
  }, [delay]);

  return (
    <Card
      ref={cardRef}
      className="group hover:shadow-lg transition-all duration-300 border-none shadow-sm bg-white"
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{value}</span>
            </div>
          </div>
          <div className={cn("p-3 rounded-xl transition-colors", bgColor, "group-hover:bg-opacity-80")}>
            <Icon className={cn("h-6 w-6", color)} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
                trend === 'up' ? 'bg-green-50 text-green-700' : trend === 'down' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
              )}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              ) : null}
              {trendValue}
            </span>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activityFeed, setActivityFeed] = useState<DashboardActivity[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, vendorsData, activityData, trafficDataRes] = await Promise.all([
          dashboardService.getStats(),
          vendorService.getVendors(),
          dashboardService.getActivity().catch(() => []),
          dashboardService.getTraffic(7).catch(() => [])
        ]);
        setStats(statsData);
        setVendors(vendorsData);
        setActivityFeed(activityData);
        setTrafficData(trafficDataRes);
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err.response?.data?.detail || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-lg font-medium text-gray-900">{error || 'Something went wrong'}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Overview</h1>
          <p className="text-gray-500 mt-1">
            Welcome back! Here's your firewall infrastructure at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Updated: Just now
          </Button>

        </div>
      </div>

      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.totalDevices}
          description="Active firewalls"
          icon={Server}
          trend="up"
          trendValue="+1"
          color="text-blue-600"
          bgColor="bg-blue-50"
          delay={0}
        />
        <StatCard
          title="Security Score"
          value={stats.securityScore}
          description="Overall posture"
          icon={Shield}
          trend={stats.securityScore >= 80 ? 'up' : 'neutral'}
          trendValue={stats.securityScore >= 80 ? 'Strong' : 'Avg'}
          color="text-green-600"
          bgColor="bg-green-50"
          delay={0.1}
        />
        <StatCard
          title="Optimization"
          value={`${stats.optimizationScore}%`}
          description="Rule efficiency"
          icon={Zap}
          trend="neutral"
          trendValue="Stable"
          color="text-orange-600"
          bgColor="bg-orange-50"
          delay={0.2}
        />
        <StatCard
          title="Total Rules"
          value={stats.totalRules.toLocaleString()}
          description={`${stats.unusedRules} unused detected`}
          icon={FileText}
          trend="down"
          trendValue="Cleanup needed"
          color="text-purple-600"
          bgColor="bg-purple-50"
          delay={0.3}
        />
      </div>

      {/* 2. Middle Section: Chart + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart (2/3 width) */}
        <Card className="lg:col-span-2 border-none shadow-sm h-[400px]">
          <CardHeader className="pb-2">
            <CardTitle>Traffic & Rule Activity</CardTitle>
            <CardDescription>Processed impact events over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRules" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="traffic"
                  stackId="1"
                  stroke="#f97316"
                  fill="url(#colorTraffic)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="rules"
                  stackId="2"
                  stroke="#3b82f6"
                  fill="url(#colorRules)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Action Center (1/3 width) */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm h-full max-h-[400px] flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-gray-500" />
                Action Center
              </CardTitle>
              <CardDescription>Recommended optimizations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {/* Item 1: Unused Rules */}
              {stats.unusedRules > 0 ? (
                <div className="group flex gap-4 p-4 rounded-xl bg-orange-50/50 border border-orange-100 hover:border-orange-200 hover:bg-orange-50 transition-all cursor-pointer">
                  <div className="mt-1 flex-shrink-0">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">Cleanup Unused Rules</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {stats.unusedRules} rules haven't been hit in 30+ days.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex gap-3 items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800">All rules optimized!</p>
                </div>
              )}

              {/* Item 2: Pending Changes */}
              {stats.pendingChanges > 0 && (
                <div className="group flex gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="mt-1 flex-shrink-0">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <GitBranch className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Pending Approvals</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {stats.pendingChanges} changes waiting for review.
                    </p>
                  </div>
                </div>
              )}

              {/* Item 3: Optimization Suggestion */}
              <div className="group flex gap-4 p-4 rounded-xl bg-purple-50/50 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-all cursor-pointer">
                <div className="mt-1 flex-shrink-0">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">Optimize Objects</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {stats.unusedObjectsCount} unused objects found.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Bottom Section: Recent Activity & Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              View All &rarr;
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {activityFeed.length > 0 ? (
                activityFeed.slice(0, 5).map((activity, i) => (
                  <div key={activity.id} className={cn(
                    "flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer",
                    i !== activityFeed.length - 1 && "border-b border-gray-50"
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      activity.type === 'alert' ? 'bg-red-500' :
                        activity.type === 'change' ? 'bg-blue-500' : 'bg-green-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-muted-foreground text-sm">No recent activity recorded.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Status */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Connected Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vendors.map(vendor => (
                <div key={vendor.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm text-sm font-bold text-gray-700">
                      {vendor.displayName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{vendor.displayName}</span>
                  </div>
                  <Badge variant={vendor.supported ? "secondary" : "outline"} className={
                    vendor.supported
                      ? "bg-green-100 text-green-700 border-transparent"
                      : "text-gray-400"
                  }>
                    {vendor.supported ? "Online" : "Soon"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
