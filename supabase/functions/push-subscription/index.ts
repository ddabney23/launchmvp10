/**
 * Push Subscription Management
 * Handles storing and managing push notification subscriptions
 * Works with both Clerk and Supabase auth
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body first (for Clerk users, user_id is in body)
    let requestBody: any = {};
    if (req.method !== "GET") {
      try {
        requestBody = await req.json();
      } catch {
        // Body might be empty or invalid
      }
    }

    // Get user ID - try from body first (Clerk), then from auth (Supabase)
    let userId: string | null = requestBody.user_id || null;

    // Try to get from Supabase auth if not in body
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        );

        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        if (user) {
          userId = user.id;
        }
      }
    }

    // If still no user ID, try to extract from anon key (fallback)
    if (!userId) {
      // For Clerk users, we require user_id in body
      if (!requestBody.user_id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - User ID required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = requestBody.user_id;
    }

    const { method } = req;

    // Initialize admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    if (method === "POST") {
      // Subscribe to push notifications
      const subscriptionData: PushSubscriptionData = requestBody;

      if (!subscriptionData.endpoint || !subscriptionData.keys) {
        return new Response(
          JSON.stringify({ error: "Invalid subscription data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertError } = await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: subscriptionData.endpoint,
            p256dh_key: subscriptionData.keys.p256dh,
            auth_key: subscriptionData.keys.auth,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (insertError) {
        console.error("Error storing subscription:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to store subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscription stored" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (method === "DELETE") {
      // Unsubscribe from push notifications
      const { endpoint } = requestBody;

      if (!endpoint) {
        return new Response(
          JSON.stringify({ error: "Endpoint required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      if (deleteError) {
        console.error("Error deleting subscription:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscription removed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (method === "GET") {
      // Get user's subscriptions
      const { data, error } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key")
        .eq("user_id", userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to get subscriptions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ subscriptions: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error("Push subscription error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
