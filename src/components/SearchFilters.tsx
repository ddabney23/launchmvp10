'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface SearchFiltersType {
  category?: string
  priceMin?: number
  priceMax?: number
  sortBy?: 'price_asc' | 'price_desc' | 'popular' | 'newest'
  listingType?: 'product' | 'service'
}

interface SearchFiltersProps {
  filters: SearchFiltersType
  onFiltersChange: (filters: SearchFiltersType) => void
  categories?: string[]
}

export function SearchFilters({ filters, onFiltersChange, categories = [] }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.priceMin || 0,
    filters.priceMax || 10000
  ])

  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof SearchFiltersType]
    return value !== undefined && value !== '' && value !== 'all'
  }).length

  const handleApplyFilters = () => {
    onFiltersChange({
      ...filters,
      priceMin: priceRange[0],
      priceMax: priceRange[1]
    })
    setIsOpen(false)
  }

  const handleClearFilters = () => {
    setPriceRange([0, 10000])
    onFiltersChange({})
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Filter className="mr-2 h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute top-full mt-2 right-0 w-80 z-50 shadow-lg">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={(value) =>
                    onFiltersChange({ ...filters, category: value === 'all' ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Listing Type Filter */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.listingType || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, listingType: value === 'all' ? undefined : (value as 'product' | 'service') })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="product">Products</SelectItem>
                  <SelectItem value="service">Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range Filter */}
            <div className="space-y-2">
              <Label>Price Range</Label>
              <div className="px-2">
                <Slider
                  value={priceRange}
                  onValueChange={(value) => setPriceRange(value as [number, number])}
                  min={0}
                  max={10000}
                  step={100}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}</span>
              </div>
            </div>

            {/* Sort By Filter */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select
                value={filters.sortBy || 'newest'}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, sortBy: value as typeof filters.sortBy })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="flex-1"
              >
                Clear All
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex-1"
              >
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

