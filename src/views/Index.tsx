'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Users, Heart, TrendingUp, ShoppingBag, Gift, MessageSquare, Mail, Phone, MapPin, ArrowRight, Newspaper } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { News } from "@/lib/types";

interface IndexProps {
  initialNews?: News[]
}

const Index = ({ initialNews = [] }: IndexProps) => {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    // Only redirect if authenticated, don't block rendering
    if (user) {
      // Small delay to ensure page renders first
      setTimeout(() => {
        router.replace("/home");
      }, 100);
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            href="/" 
            className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            Optimix
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/news">
              <Button variant="ghost">News</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => router.push("/auth")}
            >
              Sign In
            </Button>
            <Button
              onClick={() => router.push("/auth")}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5">
          <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/80 to-background/95" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Turn Community
              </span>
              <br />
              <span className="text-foreground">Into Commerce</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Where social connection meets marketplace power. Share, discover,
              shop, and earn - all in one vibrant community.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => router.push("/auth")}
                className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-primary"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push("/news")}
                className="text-lg px-8 py-6"
              >
                <Newspaper className="mr-2 h-5 w-5" />
                Read News
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                About <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Optimix</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We're building the future of community-driven commerce
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Our Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    To create a platform where communities thrive through meaningful connections, 
                    local commerce, and shared experiences. We believe in empowering local businesses 
                    and bringing people together.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Our Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    To become the leading social marketplace platform that seamlessly integrates 
                    social networking with e-commerce, making it easier for communities to connect, 
                    share, and support local businesses.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services Section */}
      <section id="services" className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Our <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Services</span>
            </h2>
            <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
              Everything you need to connect, shop, and grow in one platform
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Social Connection</h3>
                <p className="text-muted-foreground">
                  Share your moments, follow friends, and build meaningful
                  connections through engaging content and real-time interactions.
                </p>
              </Card>

              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2" style={{ animationDelay: "0.1s" }}>
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center mb-4">
                  <ShoppingBag className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Local Marketplace</h3>
                <p className="text-muted-foreground">
                  Discover and support local vendors. Shop from verified
                  businesses in your community with secure transactions.
                </p>
              </Card>

              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2" style={{ animationDelay: "0.2s" }}>
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Gamification</h3>
                <p className="text-muted-foreground">
                  Gain points for every interaction. Unlock badges, climb
                  leaderboards, and get exclusive perks and rewards.
                </p>
              </Card>

              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-Time Messaging</h3>
                <p className="text-muted-foreground">
                  Connect with vendors and community members through instant
                  messaging. Build relationships and get support when you need it.
                </p>
              </Card>

              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center mb-4">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Rewards & Badges</h3>
                <p className="text-muted-foreground">
                  Earn rewards for your activity. Collect badges, participate in
                  challenges, and unlock special benefits as you engage with the community.
                </p>
              </Card>

              <Card className="p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-all animate-slide-up border-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center mb-4">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Community Groups</h3>
                <p className="text-muted-foreground">
                  Join or create groups based on your interests. Connect with
                  like-minded people and discover new opportunities together.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Section */}
      <section id="news" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2">
                  Latest <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">News</span>
                </h2>
                <p className="text-muted-foreground">
                  Stay updated with the latest from Optimix
                </p>
              </div>
              <Link href="/news">
                <Button variant="outline">
                  View All News
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {initialNews && initialNews.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                {initialNews.map((news) => (
                  <Link key={news.id} href={`/news/${news.id}`}>
                    <Card className="h-full hover:shadow-hover transition-all cursor-pointer border-2">
                      {news.image_url && (
                        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                          <OptimizedImage
                            src={news.image_url}
                            alt={news.title}
                            className="object-cover w-full h-full"
                          />
                          {news.is_pinned && (
                            <Badge className="absolute top-2 right-2">Pinned</Badge>
                          )}
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{news.title}</CardTitle>
                        <CardDescription>
                          {news.created_at && formatDistanceToNow(new Date(news.created_at), { addSuffix: true })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {news.content}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No news articles available yet</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get In <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Touch</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Email</h3>
                      <p className="text-muted-foreground">support@optimix.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Phone</h3>
                      <p className="text-muted-foreground">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Address</h3>
                      <p className="text-muted-foreground">
                        123 Community Street<br />
                        San Francisco, CA 94102
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Send Us a Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        className="w-full px-4 py-2 rounded-md border border-input bg-background"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="w-full px-4 py-2 rounded-md border border-input bg-background"
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium mb-2">
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={4}
                        className="w-full px-4 py-2 rounded-md border border-input bg-background"
                        placeholder="Your message..."
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary">
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6 p-12 rounded-3xl bg-card border-2 border-primary/20 shadow-primary">
            <h2 className="text-3xl md:text-5xl font-bold">
              Ready to Join the Movement?
            </h2>
            <p className="text-xl text-muted-foreground">
              Start connecting, sharing, and growing with your community today.
            </p>
            <Button
              size="lg"
              onClick={() => router.push("/auth")}
              className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-primary"
            >
              Create Your Account
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
                Optimix
              </h3>
              <p className="text-sm text-muted-foreground">
                Connecting communities through social commerce.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/" className="text-muted-foreground hover:text-foreground">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/news" className="text-muted-foreground hover:text-foreground">
                    News
                  </Link>
                </li>
                <li>
                  <a href="#about" className="text-muted-foreground hover:text-foreground">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#services" className="text-muted-foreground hover:text-foreground">
                    Services
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#contact" className="text-muted-foreground hover:text-foreground">
                    Contact Us
                  </a>
                </li>
                <li>
                  <Link href="/auth" className="text-muted-foreground hover:text-foreground">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/auth" className="text-muted-foreground hover:text-foreground">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>support@optimix.com</li>
                <li>+1 (555) 123-4567</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Optimix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
