import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Phone, MessageSquare, Mail, Calendar, Clock, TrendingUp, Users, Target } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company_name?: string;
  job_title?: string;
  status: string;
  created_at: string;
  calls_made_this_week: number;
  sms_sent_this_week: number;
  whatsapp_sent_this_week: number;
  last_called_at?: string;
  last_sms_sent_at?: string;
  last_whatsapp_sent_at?: string;
  replied: boolean;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  weekly_call_limit: number;
  weekly_sms_limit: number;
  weekly_whatsapp_limit: number;
}

export function LeadsTracker() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    callsMade: 0,
    smsSent: 0,
    whatsappSent: 0,
    emailsSent: 0,
    replied: 0,
    booked: 0
  });

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchLeads();
      fetchStats();
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, status, weekly_call_limit, weekly_sms_limit, weekly_whatsapp_limit')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      if (data && data.length > 0) {
        setSelectedCampaign(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchLeads = async () => {
    if (!selectedCampaign) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', selectedCampaign)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedCampaign) return;

    try {
      // Get leads stats
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('calls_made_this_week, sms_sent_this_week, whatsapp_sent_this_week, replied')
        .eq('campaign_id', selectedCampaign);

      if (leadsError) throw leadsError;

      // Get email stats from activity history
      const { data: emailData, error: emailError } = await supabase
        .from('lead_activity_history')
        .select('id')
        .eq('campaign_id', selectedCampaign)
        .eq('type', 'email');

      if (emailError) throw emailError;

      // Get bookings count
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('campaign_id', selectedCampaign);

      if (bookingsError) throw bookingsError;

      const totalLeads = leadsData?.length || 0;
      const callsMade = leadsData?.reduce((sum, lead) => sum + (lead.calls_made_this_week || 0), 0) || 0;
      const smsSent = leadsData?.reduce((sum, lead) => sum + (lead.sms_sent_this_week || 0), 0) || 0;
      const whatsappSent = leadsData?.reduce((sum, lead) => sum + (lead.whatsapp_sent_this_week || 0), 0) || 0;
      const emailsSent = emailData?.length || 0;
      const replied = leadsData?.filter(lead => lead.replied).length || 0;
      const booked = bookingsData?.length || 0;

      setStats({
        totalLeads,
        callsMade,
        smsSent,
        whatsappSent,
        emailsSent,
        replied,
        booked
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-blue-100 text-blue-800';
      case 'replied': return 'bg-green-100 text-green-800';
      case 'booked': return 'bg-purple-100 text-purple-800';
      case 'not_interested': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return <div>Please log in to view leads tracker.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leads Tracker</h1>
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCampaign && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Phone className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Calls Made</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.callsMade}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">SMS Sent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.smsSent}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <MessageSquare className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">WhatsApp</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.whatsappSent}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Mail className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Emails Sent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.emailsSent}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Replied</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.replied}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Booked</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.booked}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Leads Overview</h3>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activity This Week
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                            {lead.company_name && (
                              <div className="text-sm text-gray-500">{lead.company_name}</div>
                            )}
                            {lead.job_title && (
                              <div className="text-sm text-gray-500">{lead.job_title}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.phone}</div>
                          {lead.email && (
                            <div className="text-sm text-gray-500">{lead.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                            {lead.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-4 text-sm">
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-green-600 mr-1" />
                              <span>{lead.calls_made_this_week}</span>
                            </div>
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-blue-600 mr-1" />
                              <span>{lead.sms_sent_this_week}</span>
                            </div>
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-green-600 mr-1" />
                              <span>{lead.whatsapp_sent_this_week}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {lead.last_called_at && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-green-600 mr-1" />
                              <span>{formatDate(lead.last_called_at)}</span>
                            </div>
                          )}
                          {lead.last_sms_sent_at && (
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-blue-600 mr-1" />
                              <span>{formatDate(lead.last_sms_sent_at)}</span>
                            </div>
                          )}
                          {lead.last_whatsapp_sent_at && (
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-green-600 mr-1" />
                              <span>{formatDate(lead.last_whatsapp_sent_at)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {leads.length === 0 && (
                  <div className="text-center py-12">
                    <Target className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No leads found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Upload leads to this campaign to start tracking their progress.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}