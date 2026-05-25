import Index from '@/views/Index'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Fetch news on the server side
async function getLatestNews() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return []
    }

    const supabase = await createClient()
    
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


