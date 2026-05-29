'use client'

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Menu, Newspaper, MessageSquare, Rss, LogOut, Settings, Shield, Store, Users, Gift, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { isAdminEmail } from "@/lib/admin";
import { useAuth } from "@/hooks/useAuth";

export const Navigation = () => {
  const pathname = usePathname();
  const { toast } = useToast();
  const { getItemCount } = useCart();
  const { user, profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartItemCount = getItemCount();

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out successfully" });
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (path === "/home") return pathname === "/home" || pathname === "/";
    if (path.startsWith("/groups")) return pathname.startsWith("/groups");
    if (path.startsWith("/profile")) return pathname.startsWith("/profile");
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const profilePath = profile?.id ? `/profile/${profile.id}` : "/home";

  const navItems = [
    { path: "/home", icon: Home, label: "Home", showBadge: false },
    { path: "/feed", icon: Rss, label: "Feed", showBadge: false },
    { path: "/marketplace", icon: ShoppingBag, label: "Shop", showBadge: false },
    { path: "/news", icon: Newspaper, label: "News", showBadge: false },
    { path: "/rewards", icon: Gift, label: "Rewards", showBadge: false },
    { path: "/cart", icon: ShoppingCart, label: "Cart", showBadge: true },
  ];

  return (
    <>
      <nav 
        className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            href="/home" 
            className="text-2xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent"
            aria-label="Optimix Home"
          >
            Optimix
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/home">
                <Button variant={isActive("/home") ? "default" : "ghost"} size="icon" aria-label="Home">
                  <Home className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/feed">
                <Button variant={isActive("/feed") ? "default" : "ghost"} size="icon" aria-label="Feed">
                  <Rss className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant={isActive("/marketplace") ? "default" : "ghost"} size="icon" aria-label="Marketplace">
                  <ShoppingBag className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/groups">
                <Button variant={isActive("/groups") ? "default" : "ghost"} size="icon" aria-label="Groups">
                  <Users className="h-5 w-5" />
                </Button>
              </Link>

              <Link href="/cart">
                <Button variant={isActive("/cart") ? "default" : "ghost"} size="icon" aria-label="Cart" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">
                      {cartItemCount > 9 ? "9+" : cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>

            {/* Single instance — duplicate mounts caused realtime channel collision */}
            <NotificationsDropdown />

            {profile && (
              <Link href={profilePath} className="hidden md:block" aria-label="Your profile">
                <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/50 transition-all">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-primary-foreground">
                    {profile.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}

          <div className="flex md:hidden items-center gap-2">
            {profile && (
              <Link href={profilePath} aria-label="Your profile">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-primary-foreground text-xs">
                    {profile.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-[380px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                
                <div className="mt-6 space-y-4">
                  {profile && (
                    <>
                      <Link 
                        href={profilePath}
                        onClick={handleNavClick}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-primary-foreground">
                            {profile.username?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{profile.display_name || profile.username}</p>
                          <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                        </div>
                      </Link>
                      <Separator />
                    </>
                  )}

                  <div className="space-y-2">
                    <Link href="/news" onClick={handleNavClick}>
                      <Button variant={isActive("/news") ? "default" : "ghost"} className="w-full justify-start gap-3">
                        <Newspaper className="h-5 w-5" />
                        News
                      </Button>
                    </Link>

                    <Link href="/rewards" onClick={handleNavClick}>
                      <Button variant={isActive("/rewards") ? "default" : "ghost"} className="w-full justify-start gap-3">
                        <Gift className="h-5 w-5" />
                        Rewards
                      </Button>
                    </Link>

                    <Link href="/messages" onClick={handleNavClick}>
                      <Button variant={isActive("/messages") ? "default" : "ghost"} className="w-full justify-start gap-3">
                        <MessageSquare className="h-5 w-5" />
                        Messages
                      </Button>
                    </Link>

                    {profile && (profile.is_admin || isAdminEmail(user?.email)) && (
                      <Link href="/admin" onClick={handleNavClick}>
                        <Button variant={isActive("/admin") ? "default" : "ghost"} className="w-full justify-start gap-3">
                          <Shield className="h-5 w-5" />
                          Admin Dashboard
                        </Button>
                      </Link>
                    )}

                    {profile?.is_vendor && (
                      <Link href="/vendor/dashboard" onClick={handleNavClick}>
                        <Button variant={isActive("/vendor/dashboard") ? "default" : "ghost"} className="w-full justify-start gap-3">
                          <Store className="h-5 w-5" />
                          Vendor Dashboard
                        </Button>
                      </Link>
                    )}

                    <Link href="/settings" onClick={handleNavClick}>
                      <Button variant={isActive("/settings") ? "default" : "ghost"} className="w-full justify-start gap-3">
                        <Settings className="h-5 w-5" />
                        Settings
                      </Button>
                    </Link>
                  </div>

                  <Separator />

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          </div>
        </div>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-inset-bottom md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.label} href={item.path} className="flex-1">
                <Button
                  variant={active ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-12 flex flex-col gap-1 relative"
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                  {item.showBadge && cartItemCount > 0 && (
                    <Badge variant="destructive" className="absolute top-0 right-1 h-4 min-w-4 px-1 text-[10px]">
                      {cartItemCount > 9 ? "9+" : cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};
