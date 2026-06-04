import Index from '@/views/Index'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

// Fetch news on the server side
async function getLatestNews() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return []
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)

    if (error) {
      console.error('Failed to fetch news:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching news:', error)
    return []
  }
}

export default async function HomePage() {
  const latestNews = await getLatestNews()
  
  return <Index initialNews={latestNews} />
}


