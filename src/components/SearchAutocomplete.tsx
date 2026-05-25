'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Clock } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/integrations/supabase/client'

interface SearchAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: SearchResult) => void
  placeholder?: string
  className?: string
}

interface SearchResult {
  type: 'listing' | 'post' | 'user'
  id: string
  title: string
  subtitle?: string
  image?: string
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search...',
  className = ''
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const debouncedSearch = useDebounce(value, 300)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Perform search
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setResults([])
      return
    }

    const performSearch = async () => {
      setIsLoading(true)
      try {
        const searchTerm = `%${debouncedSearch}%`

        // Search listings
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title, price, category, images')
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .eq('active', true)
          .limit(5)

        // Search users
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio')
          .or(`username.ilike.${searchTerm},display_name.ilike.${searchTerm}`)
          .limit(5)

        // Search posts
        const { data: posts } = await supabase
          .from('posts')
          .select('id, content, author, created_at')
          .ilike('content', searchTerm)
          .eq('visibility', 'public')
          .limit(5)

        const searchResults: SearchResult[] = [
          ...(listings || []).map(listing => ({
            type: 'listing' as const,
            id: listing.id,
            title: listing.title,
            subtitle: `$${listing.price} • ${listing.category}`,
            image: listing.images?.[0]
          })),
          ...(users || []).map(user => ({
            type: 'user' as const,
            id: user.id,
            title: user.display_name || user.username || 'User',
            subtitle: user.bio || `@${user.username}`,
            image: user.avatar_url || undefined
          })),
          ...(posts || []).map(post => ({
            type: 'post' as const,
            id: post.id,
            title: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
            subtitle: 'Post'
          }))
        ]

        setResults(searchResults)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    performSearch()
  }, [debouncedSearch])

  const handleSelect = (result: SearchResult) => {
    // Save to recent searches
    const updated = [result.title, ...recentSearches.filter(s => s !== result.title)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recent_searches', JSON.stringify(updated))

    onChange(result.title)
    setIsOpen(false)
    onSelect?.(result)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setIsOpen(true)
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (value || recentSearches.length > 0) && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center gap-3"
                  >
                    {result.image && (
                      <img
                        src={result.image}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {result.type}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : value && value.length >= 2 ? (
              <div className="p-4 text-center text-muted-foreground">
                No results found
              </div>
            ) : recentSearches.length > 0 ? (
              <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Recent Searches
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => onChange(search)}
                    className="w-full p-2 hover:bg-muted transition-colors text-left rounded"
                  >
                    {search}
                  </button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

