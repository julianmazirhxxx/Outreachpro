@@ .. @@
 /*
   # Clean up all campaigns except live test campaign
   
   This migration removes all campaigns and their associated data except for the live test campaign:
   Campaign ID: be239e0b-d75e-4ffc-ba0c-b693d157cb89
   Campaign: "Get 15 Free Qualified Car Buyer Leads + AI Follow-up Assistant for Your Dealership"
   
   1. Removes all other campaign sequences and progress
   2. Removes all other leads and conversation history  
   3. Removes all other training resources and bookings
   4. Keeps only the live test campaign data
   
   This ensures the n8n engine only processes the live test campaign.
 */
 
 DO $$
 DECLARE
     live_campaign_id uuid := 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';
     deleted_count integer;
 BEGIN
     RAISE NOTICE 'Starting cleanup for live test campaign: %', live_campaign_id;
     
+    -- Step 1: Delete lead_activity_history for other campaigns (must be first due to foreign keys)
+    DELETE FROM lead_activity_history 
+    WHERE campaign_id != live_campaign_id;
+    GET DIAGNOSTICS deleted_count = ROW_COUNT;
+    RAISE NOTICE 'Deleted % lead_activity_history records from other campaigns', deleted_count;
+    
     -- Step 1: Delete conversation_history for other campaigns
     DELETE FROM conversation_history 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % conversation_history records from other campaigns', deleted_count;
     
-    -- Step 2: Delete lead_activity_history for other campaigns
-    DELETE FROM lead_activity_history 
-    WHERE campaign_id != live_campaign_id;
-    GET DIAGNOSTICS deleted_count = ROW_COUNT;
-    RAISE NOTICE 'Deleted % lead_activity_history records from other campaigns', deleted_count;
-    
-    -- Step 3: Delete training_resources for other campaigns
+    -- Step 2: Delete training_resources for other campaigns
     DELETE FROM training_resources 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % training_resources records from other campaigns', deleted_count;
     
-    -- Step 4: Delete bookings for other campaigns
+    -- Step 3: Delete bookings for other campaigns
     DELETE FROM bookings 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % bookings records from other campaigns', deleted_count;
     
-    -- Step 5: Delete campaign_sequences for other campaigns
+    -- Step 4: Delete campaign_sequences for other campaigns
     DELETE FROM campaign_sequences 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % campaign_sequences records from other campaigns', deleted_count;
     
-    -- Step 6: Delete lead_sequence_progress for other campaigns (CRITICAL for n8n)
+    -- Step 5: Delete lead_sequence_progress for other campaigns (CRITICAL for n8n)
     DELETE FROM lead_sequence_progress 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % lead_sequence_progress records from other campaigns', deleted_count;
     
-    -- Step 7: Delete uploaded_leads for other campaigns
+    -- Step 6: Delete uploaded_leads for other campaigns
     DELETE FROM uploaded_leads 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % uploaded_leads records from other campaigns', deleted_count;
     
-    -- Step 8: Delete leads for other campaigns
+    -- Step 7: Delete leads for other campaigns
     DELETE FROM leads 
     WHERE campaign_id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % leads records from other campaigns', deleted_count;
     
-    -- Step 9: Finally delete other campaigns
+    -- Step 8: Finally delete other campaigns
     DELETE FROM campaigns 
     WHERE id != live_campaign_id;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RAISE NOTICE 'Deleted % campaigns (keeping live test campaign)', deleted_count;