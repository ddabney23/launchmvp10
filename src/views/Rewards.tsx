'use client'

import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Star, Gift, CreditCard, TrendingUp, Award, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserBadges, getAllBadges, getLeaderboard, getUserPointsHistory } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

interface RewardItemProps {
  id: string;
  name: string;
  credits: number;
  icon: string;
  userCredits: number;
}

function RewardItem({ id, name, credits, icon, userCredits }: RewardItemProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRedeeming, setIsRedeeming] = useState(false);

  const canAfford = userCredits >= credits;

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gamification/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: id, credits }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Redemption failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Redemption Successful! 🎉",
        description: `You've redeemed ${name}. New balance: ${data.newBalance} credits`,
      });
      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsRedeeming(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsRedeeming(false);
    },
  });

  const handleRedeem = () => {
    if (!canAfford) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${credits - userCredits} more credits to redeem this reward.`,
        variant: "destructive",
      });
      return;
    }

    setIsRedeeming(true);
    redeemMutation.mutate();
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{credits} credits</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={canAfford ? "default" : "outline"}
        disabled={!canAfford || isRedeeming}
        onClick={handleRedeem}
      >
        {isRedeeming ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : canAfford ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          "🔒"
        )}
      </Button>
    </div>
  );
}

export default function Rewards() {
  const { user, profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "weekly" | "monthly" | "all_time">("all_time");

  const { data: userBadges, isLoading: badgesLoading } = useQuery({
    queryKey: ["userBadges", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getUserBadges(user.id);
    },
    enabled: !!user?.id,
  });

  const { data: allBadges, isLoading: allBadgesLoading } = useQuery({
    queryKey: ["allBadges"],
    queryFn: () => getAllBadges(),
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard", selectedPeriod],
    queryFn: () => getLeaderboard(selectedPeriod, 100),
    enabled: !!user,
  });

  const { data: pointsHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["pointsHistory", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return getUserPointsHistory(user.id, 50);
    },
    enabled: !!user?.id,
  });

  useRealtimeInvalidate(
    `leaderboard:rewards:${selectedPeriod}`,
    'leaderboard',
    [['leaderboard'], ['userBadges']],
    { enabled: !!user }
  );

  useRealtimeInvalidate(
    `user-badges:rewards:${user?.id ?? 'anon'}`,
    'user_badges',
    [['userBadges']],
    { enabled: !!user?.id, filter: user?.id ? `user_id=eq.${user.id}` : undefined }
  );

  const badges = userBadges || [];
  const allBadgesList = allBadges || [];
  const leaderboard = leaderboardData || [];
  const history = pointsHistory || [];

  // Find user's rank
  const userRank = leaderboard.findIndex((entry) => entry.user_id === user?.id) + 1;
  const userPoints = profile?.points || 0;

  // Calculate next badge progress
  const nextBadgeThresholds = [
    { points: 50, name: "Member" },
    { points: 100, name: "Contributor" },
    { points: 250, name: "Active" },
    { points: 500, name: "Dedicated" },
    { points: 1000, name: "Power User" },
  ];

  const nextBadge = nextBadgeThresholds.find((threshold) => userPoints < threshold.points);
  const previousBadge = nextBadgeThresholds
    .slice()
    .reverse()
    .find((threshold) => userPoints >= threshold.points);

  const progressToNext =
    nextBadge && previousBadge
      ? ((userPoints - previousBadge.points) / (nextBadge.points - previousBadge.points)) * 100
      : nextBadge && userPoints < nextBadge.points
      ? (userPoints / nextBadge.points) * 100
      : 100;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PageShell>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
            Rewards & Gamification
          </h1>
          <p className="text-muted-foreground">Track your progress and unlock achievements</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-primary" />
                        {userPoints}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Credits</p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        <CreditCard className="h-6 w-6 text-secondary" />
                        {profile?.credits || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Badges Earned</p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        <Star className="h-6 w-6 text-warning" />
                        {badges.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Next Badge Progress */}
            {nextBadge && (
              <Card>
                <CardHeader>
                  <CardTitle>Next Badge: {nextBadge.name}</CardTitle>
                  <CardDescription>
                    {nextBadge.points - userPoints} points until you unlock the {nextBadge.name} badge
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{previousBadge?.points || 0} pts</span>
                      <span>{nextBadge.points} pts</span>
                    </div>
                    <Progress value={progressToNext} className="h-2" />
                    <div className="text-center text-sm text-muted-foreground">
                      {userPoints} / {nextBadge.points} points
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="badges" className="w-full">
              <TabsList>
                <TabsTrigger value="badges">My Badges</TabsTrigger>
                <TabsTrigger value="available">Available Badges</TabsTrigger>
                <TabsTrigger value="history">Points History</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              </TabsList>

              <TabsContent value="badges" className="space-y-4">
                {badgesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : badges.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <p className="text-muted-foreground">No badges earned yet. Start engaging to earn badges!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {badges.map((badge) => (
                      <Card key={badge.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Award className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{badge.name}</CardTitle>
                              {badge.awarded_at && (
                                <CardDescription>
                                  Earned {formatDistanceToNow(new Date(badge.awarded_at), { addSuffix: true })}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {badge.description && <p className="text-sm text-muted-foreground">{badge.description}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="available" className="space-y-4">
                {allBadgesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allBadgesList.map((badge) => {
                      const isEarned = badges.some((b) => b.id === badge.id);
                      return (
                        <Card
                          key={badge.id}
                          className={`hover:shadow-lg transition-shadow ${isEarned ? "border-primary" : "opacity-75"}`}
                        >
                          <CardHeader>
                            <div className="flex items-center gap-4">
                              <div
                                className={`h-12 w-12 rounded-full flex items-center justify-center ${
                                  isEarned ? "bg-primary/10" : "bg-muted"
                                }`}
                              >
                                <Award className={`h-6 w-6 ${isEarned ? "text-primary" : "text-muted-foreground"}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg">{badge.name}</CardTitle>
                                  {isEarned && <Badge variant="default">Earned</Badge>}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {badge.description && <p className="text-sm text-muted-foreground">{badge.description}</p>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : history.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <p className="text-muted-foreground">No points history yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {history.map((entry, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{entry.reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(entry.awarded_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">+{entry.points}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaderboard" className="space-y-4">
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly", "all_time"] as const).map((period) => (
                    <Button
                      key={period}
                      variant={selectedPeriod === period ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPeriod(period)}
                    >
                      {period.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Button>
                  ))}
                </div>

                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <p className="text-muted-foreground">No leaderboard data available</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <Card
                        key={entry.user_id}
                        className={entry.user_id === user?.id ? "border-primary" : ""}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 font-bold">
                              {index + 1}
                            </div>
                            <Avatar>
                              <AvatarImage src={entry.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {entry.profile?.username?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">
                                {entry.profile?.display_name || entry.profile?.username || "Unknown"}
                                {entry.user_id === user?.id && " (You)"}
                              </p>
                              <p className="text-sm text-muted-foreground">@{entry.profile?.username}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">{entry.points} pts</p>
                              {entry.rank && <p className="text-xs text-muted-foreground">Rank #{entry.rank}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Redeem Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Redeem Credits
                </CardTitle>
                <CardDescription>Use your credits for discounts and perks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4 border rounded-lg bg-linear-to-br from-primary/10 to-secondary/10">
                  <p className="text-3xl font-bold text-secondary">{profile?.credits || 0}</p>
                  <p className="text-sm text-muted-foreground">Available Credits</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Available Rewards:</h4>
                  
                  {/* Discount Rewards */}
                  <RewardItem
                    id="discount-5"
                    name="5% Discount"
                    credits={50}
                    icon="🎟️"
                    userCredits={profile?.credits || 0}
                  />
                  <RewardItem
                    id="discount-10"
                    name="10% Discount"
                    credits={100}
                    icon="🎫"
                    userCredits={profile?.credits || 0}
                  />
                  <RewardItem
                    id="discount-15"
                    name="15% Discount"
                    credits={150}
                    icon="🎟️"
                    userCredits={profile?.credits || 0}
                  />
                  <RewardItem
                    id="discount-20"
                    name="20% Discount"
                    credits={200}
                    icon="🎫"
                    userCredits={profile?.credits || 0}
                  />
                  <RewardItem
                    id="free-shipping"
                    name="Free Shipping"
                    credits={75}
                    icon="📦"
                    userCredits={profile?.credits || 0}
                  />
                  
                  {/* Gift Card Rewards */}
                  <div className="pt-2 border-t">
                    <h4 className="text-sm font-semibold mb-3">Gift Cards:</h4>
                    <RewardItem
                      id="gift-card-10"
                      name="$10 Gift Card"
                      credits={500}
                      icon="💳"
                      userCredits={profile?.credits || 0}
                    />
                    <RewardItem
                      id="gift-card-25"
                      name="$25 Gift Card"
                      credits={1000}
                      icon="💳"
                      userCredits={profile?.credits || 0}
                    />
                    <RewardItem
                      id="gift-card-50"
                      name="$50 Gift Card"
                      credits={1800}
                      icon="💳"
                      userCredits={profile?.credits || 0}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {userRank > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Rank</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-primary mb-2">#{userRank}</div>
                    <p className="text-sm text-muted-foreground">out of {leaderboard.length} users</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageShell>
    </div>
  );
}

