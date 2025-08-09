import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { 
  Plus, 
  Users, 
  Target, 
  Calendar, 
  TrendingUp, 
  BarChart3,
  Phone,
  MessageSquare,
  Mail,
  Crown,
  Zap,
  CheckCircle,
  ArrowUpRight,
  Eye,
  Activity,
  PieChart
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string | null;
  offer: string | null;
  status: string | null;
  created_at: string;
}

interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  bookedLeads: number;
  totalReplies: number;
  callsMade: number;
  smssSent: number;
  whatsappSent: number;
  emailsSent: number;
  responseRate: number;
  conversionRate: number;
}

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  total_leads: number;
  calls_made: number;
  sms_sent: number;
  whatsapp_sent: number;
  emails_sent: number;
  replies: number;
  bookings: number;
  response_rate: number;
  conversion_rate: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalLeads: 0,
    bookedLeads: 0,
    totalReplies: 0,
    callsMade: 0,
    smssSent: 0,
    whatsappSent: 0,
    emailsSent: 0,
    responseRate: 0,
    conversionRate: 0,
  });
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;

      setLoading(true);
      setError('');

      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch comprehensive stats
      const [
        leadsCount,
        bookingsCount,
        conversationData,
        emailTrackingData
      ] = await Promise.all([
        supabase
          .from('uploaded_leads')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('conversation_history')
          .select('campaign_id, channel, from_role')
          .in('campaign_id', campaignsData?.map(c => c.id) || []),
        supabase
          .from('email_tracking')
          .select('campaign_id')
          .eq('user_id', user.id)
      ]);

      // Calculate overall stats
      const totalLeads = leadsCount.count || 0;
      const bookedLeads = bookingsCount.count || 0;
      const conversations = conversationData.data || [];
      const emailTracking = emailTrackingData.data || [];

      const callsMade = conversations.filter(c => c.channel === 'vapi' && c.from_role === 'ai').length;
      const smssSent = conversations.filter(c => c.channel === 'sms' && c.from_role === 'ai').length;
      const whatsappSent = conversations.filter(c => c.channel === 'whatsapp' && c.from_role === 'ai').length;
      const emailsSent = emailTracking.length;
      const totalReplies = conversations.filter(c => c.from_role === 'lead').length;
      const totalOutbound = callsMade + smssSent + whatsappSent + emailsSent;

      const responseRate = totalOutbound > 0 ? (totalReplies / totalOutbound) * 100 : 0;
      const conversionRate = totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0;

      // Calculate per-campaign metrics
      const campaignMetricsData: CampaignMetrics[] = [];
      
      for (const campaign of campaignsData || []) {
        // Get leads for this campaign
        const { data: campaignLeads } = await supabase
          .from('uploaded_leads')
          .select('id')
          .eq('campaign_id', campaign.id);

        // Get conversations for this campaign
        const campaignConversations = conversations.filter(c => c.campaign_id === campaign.id);
        const campaignEmails = emailTracking.filter(e => e.campaign_id === campaign.id);

        // Get bookings for this campaign
        const { data: campaignBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('campaign_id', campaign.id);

        const campaignCalls = campaignConversations.filter(c => c.channel === 'vapi' && c.from_role === 'ai').length;
        const campaignSMS = campaignConversations.filter(c => c.channel === 'sms' && c.from_role === 'ai').length;
        const campaignWhatsApp = campaignConversations.filter(c => c.channel === 'whatsapp' && c.from_role === 'ai').length;
        const campaignEmailsSent = campaignEmails.length;
        const campaignReplies = campaignConversations.filter(c => c.from_role === 'lead').length;
        const campaignTotalOutbound = campaignCalls + campaignSMS + campaignWhatsApp + campaignEmailsSent;
        const campaignLeadsCount = campaignLeads?.length || 0;
        const campaignBookingsCount = campaignBookings?.length || 0;

        campaignMetricsData.push({
          campaign_id: campaign.id,
          campaign_name: campaign.offer || campaign.name || 'Untitled Campaign',
          total_leads: campaignLeadsCount,
          calls_made: campaignCalls,
          sms_sent: campaignSMS,
          whatsapp_sent: campaignWhatsApp,
          emails_sent: campaignEmailsSent,
          replies: campaignReplies,
          bookings: campaignBookingsCount,
          response_rate: campaignTotalOutbound > 0 ? (campaignReplies / campaignTotalOutbound) * 100 : 0,
          conversion_rate: campaignLeadsCount > 0 ? (campaignBookingsCount / campaignLeadsCount) * 100 : 0,
        });
      }

      setCampaigns(campaignsData || []);
      setStats({
        totalCampaigns: campaignsData?.length || 0,
        activeCampaigns: campaignsData?.filter(c => c.status === 'active').length || 0,
        totalLeads,
        bookedLeads,
        totalReplies,
        callsMade,
        smssSent,
        whatsappSent,
        emailsSent,
        responseRate,
        conversionRate,
      });
      setCampaignMetrics(campaignMetricsData);

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading dashboard..." className="h-64" />;
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            {theme === 'gold' ? (
              <Crown className="h-8 w-8 text-yellow-400" />
            ) : (
              <BarChart3 className="h-8 w-8 text-blue-600" />
            )}
            <h1 className={`text-3xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Dashboard
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Welcome back, {user?.user_metadata?.full_name || user?.email}
          </p>
        </div>
        <Link
          to="/campaigns"
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Link>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Target className={`h-6 w-6 ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {stats.totalCampaigns}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Campaigns
              </p>
              <p className={`text-xs ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                {stats.activeCampaigns} active
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
            }`}>
              <Users className={`h-6 w-6 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {stats.totalLeads.toLocaleString()}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Leads
              </p>
              <p className={`text-xs ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Across all campaigns
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <TrendingUp className={`h-6 w-6 ${
                theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {stats.responseRate.toFixed(1)}%
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Response Rate
              </p>
              <p className={`text-xs ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                {stats.totalReplies} replies
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <Calendar className={`h-6 w-6 ${
                theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {stats.bookedLeads}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Bookings
              </p>
              <p className={`text-xs ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                {stats.conversionRate.toFixed(1)}% conversion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outreach Activity */}
        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Outreach Activity
            </h3>
            <Activity className={`h-5 w-5 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Phone className={`h-5 w-5 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Calls Made
                </span>
              </div>
              <span className={`text-lg font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
              }`}>
                {stats.callsMade}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className={`h-5 w-5 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  SMS Sent
                </span>
              </div>
              <span className={`text-lg font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}>
                {stats.smssSent}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className={`h-5 w-5 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-emerald-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  WhatsApp Sent
                </span>
              </div>
              <span className={`text-lg font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-emerald-600'
              }`}>
                {stats.whatsappSent}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className={`h-5 w-5 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Emails Sent
                </span>
              </div>
              <span className={`text-lg font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
              }`}>
                {stats.emailsSent}
              </span>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Performance Overview
            </h3>
            <PieChart className={`h-5 w-5 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Response Rate
                </span>
                <span className={`text-sm font-bold ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`}>
                  {stats.responseRate.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full bg-gray-200 rounded-full h-2 ${
                theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div
                  className={`h-2 rounded-full ${
                    theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(stats.responseRate, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Conversion Rate
                </span>
                <span className={`text-sm font-bold ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                }`}>
                  {stats.conversionRate.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full bg-gray-200 rounded-full h-2 ${
                theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div
                  className={`h-2 rounded-full ${
                    theme === 'gold' ? 'bg-green-400' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(stats.conversionRate, 100)}%` }}
                />
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-yellow-400/10' : 'bg-blue-50'
            }`}>
              <div className={`text-sm font-medium ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Total Outreach Messages
              </div>
              <div className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}>
                {(stats.callsMade + stats.smssSent + stats.whatsappSent + stats.emailsSent).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`px-6 py-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Campaign Performance
            </h2>
            <Link
              to="/campaigns"
              className={`text-sm hover:underline ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}
            >
              View all campaigns
            </Link>
          </div>
        </div>
        
        <div className="p-6">
          {campaignMetrics.length === 0 ? (
            <div className="text-center py-12">
              <Target className={`mx-auto h-12 w-12 mb-4 ${
                theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                No campaigns found
              </h3>
              <p className={`mb-6 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Create your first campaign to start tracking performance.
              </p>
              <Link
                to="/campaigns"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${
                  theme === 'gold' ? 'bg-black/20' : 'bg-gray-50'
                }`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Campaign
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Leads
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Outreach
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Replies
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Bookings
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Performance
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'gold' ? 'divide-yellow-400/20' : 'divide-gray-200'
                }`}>
                  {campaignMetrics.map((metric) => (
                    <tr key={metric.campaign_id} className={`hover:${
                      theme === 'gold' ? 'bg-yellow-400/5' : 'bg-gray-50'
                    } transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                          }`}>
                            <Target className={`h-5 w-5 ${
                              theme === 'gold' ? 'text-black' : 'text-blue-600'
                            }`} />
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {metric.campaign_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
                        }`}>
                          {metric.total_leads.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className={`text-xs ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            📞 {metric.calls_made} calls
                          </div>
                          <div className={`text-xs ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            💬 {metric.sms_sent} SMS
                          </div>
                          <div className={`text-xs ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            📧 {metric.emails_sent} emails
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-green-400' : 'text-green-600'
                        }`}>
                          {metric.replies}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {metric.response_rate.toFixed(1)}% rate
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
                        }`}>
                          {metric.bookings}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {metric.conversion_rate.toFixed(1)}% rate
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            metric.response_rate >= 10
                              ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                              : metric.response_rate >= 5
                              ? theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                              : theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                          }`}>
                            {metric.response_rate >= 10 ? 'Excellent' : 
                             metric.response_rate >= 5 ? 'Good' : 'Needs Work'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/campaigns/${metric.campaign_id}/edit`}
                          className={`inline-flex items-center px-3 py-1 text-xs rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`px-6 py-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Recent Campaigns
            </h2>
            <Link
              to="/campaigns"
              className={`text-sm hover:underline ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}
            >
              View all
            </Link>
          </div>
        </div>
        
        <div className="p-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Target className={`mx-auto h-12 w-12 mb-4 ${
                theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                No campaigns found
              </h3>
              <p className={`mb-6 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Create your first campaign to start tracking performance.
              </p>
              <Link
                to="/campaigns"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => {
                const metrics = campaignMetrics.find(m => m.campaign_id === campaign.id);
                return (
                  <Link
                    key={campaign.id}
                    to={`/campaigns/${campaign.id}/edit`}
                    className={`block p-4 border rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 hover:bg-yellow-400/5'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                        }`}>
                          <Target className={`h-5 w-5 ${
                            theme === 'gold' ? 'text-black' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className={`font-semibold ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            {campaign.offer || campaign.name || 'Untitled Campaign'}
                          </h3>
                          <p className={`text-sm ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Created {new Date(campaign.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {metrics && (
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
                            }`}>
                              {metrics.total_leads} leads
                            </div>
                            <div className={`text-xs ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {metrics.response_rate.toFixed(1)}% response • {metrics.bookings} booked
                            </div>
                          </div>
                        )}
                        
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          campaign.status === 'active'
                            ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                            : theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {campaign.status || 'draft'}
                        </span>
                        
                        <ArrowUpRight className={`h-4 w-4 ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-400'
                        }`} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}