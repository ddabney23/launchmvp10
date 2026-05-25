'use client'

/**
 * Admin Only Component
 * Conditionally renders children only for admin users
 */

import { useAuth } from "@/hooks/useAuth";
import { isAdminEmail } from "@/lib/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.is_admin || isAdminEmail(user?.email);

  if (!isAdmin) {
    return (
      fallback || (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this section. Admin access required.
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}

