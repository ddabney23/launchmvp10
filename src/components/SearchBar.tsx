'use client'

/**
 * Search Bar Component
 * Provides search functionality with auto-complete
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";

interface SearchResult {
  id: string;
  type: "user" | "post" | "listing" | "group";
  title: string;
  subtitle?: string;
  url: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({ placeholder = "Search...", onSearch, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    setIsOpen(true);

    try {
      // Import supabase client
      const { supabase } = await import("@/integrations/supabase/client");

      // Perform search across multiple tables
      const [usersResult, postsResult, listingsResult] = await Promise.all([
        // Search users
        supabase
          .from("profiles")
          .select("id, username, display_name")
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(5),
        
        // Search posts
        supabase
          .from("posts")
          .select("id, content, author")
          .ilike("content", `%${searchQuery}%`)
          .limit(5),
        
        // Search listings
        supabase
          .from("listings")
          .select("id, title, description, vendor")
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(5),
      ]);

      const searchResults: SearchResult[] = [];

      // Add user results
      if (usersResult.data) {
        usersResult.data.forEach((user) => {
          searchResults.push({
            id: user.id,
            type: "user",
            title: user.display_name || user.username,
            subtitle: `@${user.username}`,
            url: `/profile/${user.id}`,
          });
        });
      }

      // Add post results
      if (postsResult.data) {
        postsResult.data.forEach((post) => {
          searchResults.push({
            id: post.id,
            type: "post",
            title: post.content.slice(0, 50) + (post.content.length > 50 ? "..." : ""),
            subtitle: "Post",
            url: `/post/${post.id}`,
          });
        });
      }

      // Add listing results
      if (listingsResult.data) {
        listingsResult.data.forEach((listing) => {
          searchResults.push({
            id: listing.id,
            type: "listing",
            title: listing.title,
            subtitle: listing.description?.slice(0, 50),
            url: `/listing/${listing.id}`,
          });
        });
      }

      setResults(searchResults);
      
      // Track search
      analytics.track("search_performed", {
        query: searchQuery,
        result_count: searchResults.length,
      });
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery("");
    if (onSearch) {
      onSearch(result.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (query.trim()) {
          // Navigate to search results page
          router.push(`/search?q=${encodeURIComponent(query)}`);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative w-full", className)}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim() && results.length > 0) {
                setIsOpen(true);
              }
            }}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 && query.trim() ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <>
                {results.length > 0 && (
                  <CommandGroup heading="Results">
                    {results.map((result, index) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={result.id}
                        onSelect={() => handleSelect(result)}
                        className={cn(
                          "cursor-pointer",
                          index === selectedIndex && "bg-accent"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{result.title}</span>
                          {result.subtitle && (
                            <span className="text-xs text-muted-foreground">
                              {result.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {query.trim() && (
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        router.push(`/search?q=${encodeURIComponent(query)}`);
                        setIsOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      View all results for "{query}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

