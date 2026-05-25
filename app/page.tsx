import Index from '@/views/Index'
import { createClient } from '@/integrations/supabase/client'

// Fetch news on the server side
async function getLatestNews() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return []
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
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


