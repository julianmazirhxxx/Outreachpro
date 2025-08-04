import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { SecurityManager } from '../utils/security';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { Plus, Users, Target, Calendar, TrendingUp, Crown, Star, Zap, Phone, MessageSquare, Mail, ArrowUpRight, ArrowDownRight, BarChart3, Clock } from 'lucide-react';
import { Play, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Campaign {
  id: string;
  avatar: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

interface CampaignMetrics {
  id: string;
  offer: string | null;
  status: string | null;
  created_at: string;
  totalLeads: number;
  callsSent: number;
  smsSent: number;
  whatsappSent: number;
  emailsSent: number;
  totalSent: number;
  replies: number;
  bookings: number;
  replyRate: number;
  bookingRate: number;
  engagementRate: number;
}

interface DashboardStats {
  totalCampaigns: number;
  totalVolume: number;
  volumeSent: number;
  bookedLeads: number;
  activeLeads: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { handleAsyncError } = useErrorHandler();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics[]>([]);
  const [updatingCampaign, setUpdatingCampaign] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    totalVolume: 0,
    volumeSent: 0,
    bookedLeads: 0,
    activeLeads: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchCampaignMetrics();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    await executeAsync(async () => {
      if (!user) return;

      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (campaignsError) throw campaignsError;

      // Fetch stats
      const [campaignsCount, bookedCount, volumeData, volumeSentData] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('lead_sequence_progress')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('conversation_history')
          .select('id', { count: 'exact' })
          .eq('from_role', 'ai')
          .in('campaign_id', campaignsData?.map(c => c.id) || []),
      ]);

      const activeLeadsCount = await supabase
        .from('uploaded_leads')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .in('status', ['pending', 'called', 'contacted', 'emailed']);

      setCampaigns(campaignsData || []);
      setStats({
        totalCampaigns: campaignsCount.count || 0,
        totalVolume: volumeData.count || 0,
        volumeSent: volumeSentData.count || 0,
        bookedLeads: bookedCount.count || 0,
        activeLeads: activeLeadsCount.count || 0,
      });
    }, {
      errorMessage: 'Failed to load dashboard data'
    });
  };

  const fetchCampaignMetrics = async () => {
    if (!user) return;

    // Check if Supabase is configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - cannot toggle campaign status');
      return;
    }
    
    // Check if Supabase is configured before making requests
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - skipping campaign metrics fetch');
      setCampaignMetrics([]);
      return;
    }

    try {
      // Check environment configuration before making requests
      const envValidation = SecurityManager.validateEnvironment();
      if (!envValidation.isValid) {
        console.error('Environment validation failed:', envValidation.errors);
        // Set empty data to prevent UI crashes
        setCampaigns([]);
        setMetrics({
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalLeads: 0,
          totalBookings: 0,
          conversionRate: 0,
          avgResponseTime: 0
        });
        setRecentActivity([]);
        return;
      }

      // Fetch campaigns with basic info
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, offer, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (campaignsError) throw campaignsError;

      if (!campaignsData || campaignsData.length === 0) {
        setCampaignMetrics([]);
        return;
      }

      // Fetch metrics for each campaign
      const metricsPromises = campaignsData.map(async (campaign) => {
        // Get total leads for this campaign
        const { data: leadsData } = await supabase
          .from('uploaded_leads')
          .select('id')
          .eq('campaign_id', campaign.id);

        // Get conversation history for outbound messages
        const { data: conversationData } = await supabase
          .from('conversation_history')
          .select('channel, from_role')
          .eq('campaign_id', campaign.id);

        // Get replies (inbound messages)
        const { data: repliesData } = await supabase
          .from('conversation_history')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('from_role', 'lead');

        // Get bookings
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('id')
          .eq('campaign_id', campaign.id);

        // Calculate metrics
        const totalLeads = leadsData?.length || 0;
        const outboundMessages = conversationData?.filter(c => c.from_role === 'ai') || [];
        
        const callsSent = outboundMessages.filter(c => c.channel === 'vapi').length;
        const smsSent = outboundMessages.filter(c => c.channel === 'sms').length;
        const whatsappSent = outboundMessages.filter(c => c.channel === 'whatsapp').length;
        const emailsSent = outboundMessages.filter(c => c.channel === 'email').length;
        const totalSent = callsSent + smsSent + whatsappSent + emailsSent;
        
        const replies = repliesData?.length || 0;
        const bookings = bookingsData?.length || 0;
        
        const replyRate = totalSent > 0 ? (replies / totalSent) * 100 : 0;
        const bookingRate = totalLeads > 0 ? (bookings / totalLeads) * 100 : 0;
        const engagementRate = totalSent > 0 ? ((replies + bookings) / totalSent) * 100 : 0;

        return {
          id: campaign.id,
          offer: campaign.offer,
          status: campaign.status,
          created_at: campaign.created_at,
          totalLeads,
          callsSent,
          smsSent,
          whatsappSent,
          emailsSent,
          totalSent,
          replies,
          bookings,
          replyRate,
          bookingRate,
          engagementRate,
        };
      });

      const metrics = await Promise.all(metricsPromises);
      setCampaignMetrics(metrics);
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
      // Set empty metrics on error to prevent UI issues
      setCampaignMetrics([]);
      
      // Only show error in development
      if (import.meta.env.DEV) {
        console.error('Campaign metrics fetch failed:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <LoadingSpinner size="lg" message="Loading dashboard..." className="h-64" />
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Dashboard Error"
        message={error}
        onRetry={fetchDashboardData}
        onDismiss={() => setError('')}
        className="m-6"
      />
    );
  }

  if (theme === 'gold') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Zap className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold gold-text-gradient">Elite Dashboard</h1>
            </div>
            <p className="text-gray-400">
              Welcome back, <span className="text-yellow-400 font-medium">{user?.user_metadata?.full_name || user?.email}</span>
            </p>
          </div>
          <Link
            to="/campaigns"
            className="inline-flex items-center px-6 py-3 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
          <div className="black-card p-6 rounded-xl gold-border hover:gold-shadow transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 gold-gradient rounded-lg shadow-lg">
                <Target className="h-6 w-6 text-black" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.totalCampaigns}
                </p>
                <p className="text-sm text-gray-400">Elite Campaigns</p>
              </div>
            </div>
          </div>

          <div className="black-card p-6 rounded-xl gold-border hover:gold-shadow transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 gold-gradient rounded-lg shadow-lg">
                <TrendingUp className="h-6 w-6 text-black" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.totalVolume.toLocaleString()}
                </p>
                <p className="text-sm text-gray-400">Volume</p>
              </div>
            </div>
          </div>

          <div className="black-card p-6 rounded-xl gold-border hover:gold-shadow transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 gold-gradient rounded-lg shadow-lg">
                <BarChart3 className="h-6 w-6 text-black" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.totalVolume > 0 ? Math.round((stats.volumeSent / stats.totalVolume) * 100) : 0}%
                </p>
                <p className="text-sm text-gray-400">Volume Sent</p>
              </div>
            </div>
          </div>

          <div className="black-card p-6 rounded-xl gold-border hover:gold-shadow transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 gold-gradient rounded-lg shadow-lg">
                <Calendar className="h-6 w-6 text-black" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.bookedLeads}
                </p>
                <p className="text-sm text-gray-400">Booked Leads</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="black-card rounded-xl gold-border shadow-2xl">
          <div className="px-6 py-4 border-b border-yellow-400/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-gray-200">
                  Campaign Performance
                </h2>
              </div>
              <Link
                to="/campaigns"
                className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="p-6">
            {campaignMetrics.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 gold-gradient rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Target className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">
                  Ready to dominate your market?
                </h3>
                <p className="text-gray-400 mb-6">
                  Create your first elite campaign and start converting high-value leads.
                </p>
                <Link
                  to="/campaigns"
                  className="inline-flex items-center px-6 py-3 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200 shadow-lg"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Launch Elite Campaign
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {campaignMetrics.map((campaign) => (
                  <Link
                    key={campaign.id}
                    to={`/campaigns/${campaign.id}/edit`}
                    className="block p-6 border border-yellow-400/20 rounded-lg hover:bg-yellow-400/5 transition-all duration-200 hover:border-yellow-400/40 hover:shadow-lg"
                  >
                    {/* Campaign Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 gold-gradient rounded-lg flex items-center justify-center shadow-lg">
                          <Target className="h-5 w-5 text-black" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-200 text-lg">
                            {campaign.offer || 'Elite Campaign'}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Created {new Date(campaign.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            campaign.status === 'active'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : campaign.status === 'paused'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}
                        >
                          {campaign.status === 'active' && <Zap className="h-3 w-3 mr-1" />}
                          {campaign.status || 'Draft'}
                        </span>
                        
                        {(campaign.status === 'active' || campaign.status === 'paused') && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleCampaignStatus(campaign.id, campaign.status || 'draft');
                            }}
                            disabled={updatingCampaign === campaign.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              updatingCampaign === campaign.id
                                ? 'opacity-50 cursor-not-allowed'
                                : theme === 'gold'
                                  ? 'text-yellow-400 hover:bg-yellow-400/10'
                                  : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                          >
                            {updatingCampaign === campaign.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : campaign.status === 'active' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {/* Total Leads */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Users className="h-4 w-4 text-yellow-400 mr-1" />
                          <span className="text-xs text-gray-400">Leads</span>
                        </div>
                        <p className="text-xl font-bold text-yellow-400">{campaign.totalLeads.toLocaleString()}</p>
                      </div>

                      {/* Volume Sent */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <ArrowUpRight className="h-4 w-4 text-blue-400 mr-1" />
                          <span className="text-xs text-gray-400">Sent</span>
                        </div>
                        <p className="text-xl font-bold text-blue-400">{campaign.totalSent.toLocaleString()}</p>
                        <div className="flex justify-center space-x-2 mt-1">
                          {campaign.callsSent > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Phone className="h-3 w-3 mr-1" />
                              {campaign.callsSent.toLocaleString()}
                            </div>
                          )}
                          {campaign.smsSent > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {campaign.smsSent.toLocaleString()}
                            </div>
                          )}
                          {campaign.emailsSent > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Mail className="h-3 w-3 mr-1" />
                              {campaign.emailsSent.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Replies */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <ArrowDownRight className="h-4 w-4 text-green-400 mr-1" />
                          <span className="text-xs text-gray-400">Replies</span>
                        </div>
                        <p className="text-xl font-bold text-green-400">{campaign.replies.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {campaign.replyRate.toFixed(1)}% rate
                        </p>
                      </div>

                      {/* Bookings */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Calendar className="h-4 w-4 text-purple-400 mr-1" />
                          <span className="text-xs text-gray-400">Booked</span>
                        </div>
                        <p className="text-xl font-bold text-purple-400">{campaign.bookings.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {campaign.bookingRate.toFixed(1)}% rate
                        </p>
                      </div>

                      {/* Engagement Rate */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="h-4 w-4 text-orange-400 mr-1" />
                          <span className="text-xs text-gray-400">Engagement</span>
                        </div>
                        <p className="text-xl font-bold text-orange-400">
                          {campaign.engagementRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Overall rate
                        </p>
                      </div>

                      {/* Performance Indicator */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <BarChart3 className="h-4 w-4 text-yellow-400 mr-1" />
                          <span className="text-xs text-gray-400">Score</span>
                        </div>
                        <p className={`text-xl font-bold ${
                          campaign.engagementRate >= 15 ? 'text-green-400' :
                          campaign.engagementRate >= 8 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {campaign.engagementRate >= 15 ? 'A+' :
                           campaign.engagementRate >= 12 ? 'A' :
                           campaign.engagementRate >= 8 ? 'B' :
                           campaign.engagementRate >= 5 ? 'C' : 'D'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Performance
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Blue theme (original design)
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {user?.user_metadata?.full_name || user?.email}
          </p>
        </div>
        <Link
          to="/campaigns"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Campaigns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalVolume.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Volume Sent</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalVolume > 0 ? Math.round((stats.volumeSent / stats.totalVolume) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Booked Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.bookedLeads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Campaigns</h2>
            <Link
              to="/campaigns"
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all
            </Link>
          </div>
        </div>
        
        <div className="p-0">
          {campaignMetrics.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Target className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first campaign to start tracking performance.
              </p>
              <div className="mt-6">
                <Link
                  to="/campaigns"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Replies
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reply Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bookings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Channels
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaignMetrics.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Target className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {campaign.offer || 'Untitled Campaign'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Created {new Date(campaign.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          campaign.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {campaign.status?.replace('_', ' ') || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.totalLeads.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.totalSent.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.replies.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          campaign.replyRate >= 10 ? 'text-green-600' :
                          campaign.replyRate >= 5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {campaign.replyRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.bookings.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          campaign.bookingRate >= 5 ? 'text-green-600' :
                          campaign.bookingRate >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {campaign.bookingRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-4 text-sm">
                          {campaign.callsSent > 0 && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-green-600 mr-1" />
                              <span>{campaign.callsSent}</span>
                            </div>
                          )}
                          {campaign.smsSent > 0 && (
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-blue-600 mr-1" />
                              <span>{campaign.smsSent}</span>
                            </div>
                          )}
                          {campaign.whatsappSent > 0 && (
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-green-600 mr-1" />
                              <span>{campaign.whatsappSent}</span>
                            </div>
                          )}
                          {campaign.emailsSent > 0 && (
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 text-purple-600 mr-1" />
                              <span>{campaign.emailsSent}</span>
                            </div>
                          )}
                          {campaign.totalSent === 0 && (
                            <span className="text-gray-400">No activity</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}