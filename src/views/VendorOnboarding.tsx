'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// CLERK MIGRATION: Updated to use Clerk instead of Supabase Auth
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X, CheckCircle2, ArrowLeft, ArrowRight, Building2, Image as ImageIcon, DollarSign, CreditCard, Sparkles, Zap, Crown, Info, Save, Eye, AlertCircle } from "lucide-react";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
// CLERK MIGRATION: Updated imports
import { updateProfile, uploadFile, getProfile, startConnectOnboarding, getConnectStatus } from "@/lib/api";
import { isOnboardingComplete } from "@/lib/profile-utils";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

// Step 1: Business Info
const BusinessInfoSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  category: z.string().min(1, "Category is required"),
  phone_number: z.string().min(10, "Phone number is required").regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number format"),
  business_id: z.string().optional(),
  tax_id: z.string().optional(),
});

// Step 2: Vendor Profile
const VendorProfileSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  banner_url: z.string().optional(),
  logo_url: z.string().optional(),
  tags: z.string().optional(),
});

// Step 3: First Product
const FirstProductSchema = z.object({
  title: z.string().min(1, "Product title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(0.01, "Price must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  image_url: z.string().optional(),
});

// Step 4: Subscription Plan
const SubscriptionPlanSchema = z.object({
  tier: z.enum(["free", "basic", "pro", "premium"]),
});

// Step 5: Payout Method (placeholder)
const PayoutMethodSchema = z.object({
  method: z.enum(["stripe", "bank", "paypal"]),
  account_details: z.string().optional(),
});

type BusinessInfo = z.infer<typeof BusinessInfoSchema>;
type VendorProfile = z.infer<typeof VendorProfileSchema>;
type FirstProduct = z.infer<typeof FirstProductSchema>;
type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
type PayoutMethod = z.infer<typeof PayoutMethodSchema>;

export default function VendorOnboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [businessIdFile, setBusinessIdFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const businessForm = useForm<BusinessInfo>({
    resolver: zodResolver(BusinessInfoSchema),
    defaultValues: {
      business_name: "",
      category: "",
      phone_number: "",
      business_id: "",
      tax_id: "",
    },
  });

  const profileForm = useForm<VendorProfile>({
    resolver: zodResolver(VendorProfileSchema),
    defaultValues: {
      description: "",
      banner_url: "",
      logo_url: "",
      tags: "",
    },
  });

  const productForm = useForm<FirstProduct>({
    resolver: zodResolver(FirstProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      category: "",
      image_url: "",
    },
  });

  const subscriptionForm = useForm<SubscriptionPlan>({
    resolver: zodResolver(SubscriptionPlanSchema),
    defaultValues: {
      tier: "free",
    },
  });

  const payoutForm = useForm<PayoutMethod>({
    resolver: zodResolver(PayoutMethodSchema),
    defaultValues: {
      method: "stripe",
      account_details: "",
    },
  });

  // CLERK MIGRATION: Use Clerk user hook
  const { user, loading: authLoading, refetch, setProfile } = useAuth();
  const isLoaded = !authLoading;
  const authUserId = user?.id;

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!authUserId) {
      router.push("/auth");
      return;
    }
    
    setUserId(authUserId);
    
    // Load saved draft from localStorage
    const savedDraft = localStorage.getItem(`vendor_onboarding_draft_${authUserId}`);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.businessForm) businessForm.reset(draft.businessForm);
        if (draft.profileForm) profileForm.reset(draft.profileForm);
        if (draft.productForm) productForm.reset(draft.productForm);
        if (draft.subscriptionForm) subscriptionForm.reset(draft.subscriptionForm);
        if (draft.payoutForm) payoutForm.reset(draft.payoutForm);
        if (draft.currentStep) setCurrentStep(draft.currentStep);
        if (draft.bannerPreview) setBannerPreview(draft.bannerPreview);
        if (draft.logoPreview) setLogoPreview(draft.logoPreview);
        if (draft.productImagePreview) setProductImagePreview(draft.productImagePreview);
      } catch (e) {
        console.warn('Failed to load draft:', e);
      }
    }
    
    setLoading(false);
  }, [authUserId, isLoaded, router, businessForm, profileForm, productForm, subscriptionForm, payoutForm]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!userId || loading) return;
    
    const draft = {
      businessForm: businessForm.getValues(),
      profileForm: profileForm.getValues(),
      productForm: productForm.getValues(),
      subscriptionForm: subscriptionForm.getValues(),
      payoutForm: payoutForm.getValues(),
      currentStep,
      bannerPreview,
      logoPreview,
      productImagePreview,
    };
    
    localStorage.setItem(`vendor_onboarding_draft_${userId}`, JSON.stringify(draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentStep, bannerPreview, logoPreview, productImagePreview]);

  // Clear draft after successful submission
  const clearDraft = () => {
    if (userId) {
      localStorage.removeItem(`vendor_onboarding_draft_${userId}`);
    }
  };

  const handleFileUpload = async (file: File, bucket: string, path: string): Promise<string> => {
    return await uploadFile(bucket, path, file);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Banner must be less than 10MB",
        variant: "destructive",
      });
      return;
    }
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    setProductImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProductImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBusinessIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File must be less than 10MB",
        variant: "destructive",
      });
      return;
    }
    setBusinessIdFile(file);
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await businessForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please complete all required fields before proceeding.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await profileForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please complete all required fields before proceeding.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      const isValid = await productForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please complete all required fields before proceeding.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      const isValid = await subscriptionForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please select a subscription plan.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(5);
    } else if (currentStep === 5) {
      const isValid = await payoutForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please select a payout method.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(6);
    }
  };

  const handleSaveDraft = () => {
    if (!userId) return;
    const draft = {
      businessForm: businessForm.getValues(),
      profileForm: profileForm.getValues(),
      productForm: productForm.getValues(),
      subscriptionForm: subscriptionForm.getValues(),
      payoutForm: payoutForm.getValues(),
      currentStep,
      bannerPreview,
      logoPreview,
      productImagePreview,
    };
    localStorage.setItem(`vendor_onboarding_draft_${userId}`, JSON.stringify(draft));
    toast({
      title: "Draft Saved",
      description: "Your progress has been saved. You can continue later.",
    });
  };

  const handleStripeConnect = async () => {
    if (!userId) return;
    setConnectLoading(true);
    try {
      const result = await startConnectOnboarding();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start Stripe Connect onboarding",
        variant: "destructive",
      });
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "Please sign in to continue",
        variant: "destructive",
      });
      return;
    }

    // Verify user is still authenticated before submission
    if (!user || !isLoaded) {
      toast({
        title: "Authentication Error",
        description: "Your session may have expired. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    console.log('[VENDOR ONBOARDING] Starting submission with user:', {
      userId: userId?.substring(0, 10) + '...',
      isLoaded,
      hasUser: !!user,
    });

    // Validate all forms before submission
    const businessValid = await businessForm.trigger();
    const profileValid = await profileForm.trigger();
    
    if (!businessValid || !profileValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const businessData = businessForm.getValues();
      const profileData = profileForm.getValues();
      const productData = productForm.getValues();

      // Step 1: Upload files (banner, logo, business ID, product image)
      let bannerUrl = profileData.banner_url;
      let logoUrl = profileData.logo_url;
      let businessIdDocumentUrl = "";
      let productImageUrl = productData.image_url;

      // Upload files with error handling (non-blocking - continue even if uploads fail)
      try {
        // Upload banner if provided
        if (bannerFile) {
          try {
            bannerUrl = await handleFileUpload(bannerFile, "vendor-assets", `${userId}/banner.${bannerFile.name.split(".").pop()}`);
            console.log('[VENDOR ONBOARDING] Banner uploaded:', bannerUrl);
          } catch (bannerError) {
            console.warn('[VENDOR ONBOARDING] Banner upload failed (non-critical):', bannerError);
            // Continue without banner
          }
        }

        // Upload logo if provided
        if (logoFile) {
          try {
            logoUrl = await handleFileUpload(logoFile, "vendor-assets", `${userId}/logo.${logoFile.name.split(".").pop()}`);
            console.log('[VENDOR ONBOARDING] Logo uploaded:', logoUrl);
          } catch (logoError) {
            console.warn('[VENDOR ONBOARDING] Logo upload failed (non-critical):', logoError);
            // Continue without logo
          }
        }

        // Upload business ID document if provided
        if (businessIdFile) {
          try {
            businessIdDocumentUrl = await handleFileUpload(businessIdFile, "vendor-docs", `${userId}/business-id-${Date.now()}.${businessIdFile.name.split(".").pop()}`);
            console.log('[VENDOR ONBOARDING] Business ID document uploaded:', businessIdDocumentUrl);
          } catch (docError) {
            console.warn('[VENDOR ONBOARDING] Business ID document upload failed (non-critical):', docError);
            // Continue without document
          }
        }

        // Upload product image if provided
        if (productImageFile) {
          try {
            productImageUrl = await handleFileUpload(productImageFile, "listings", `${userId}/product-${Date.now()}.${productImageFile.name.split(".").pop()}`);
            console.log('[VENDOR ONBOARDING] Product image uploaded:', productImageUrl);
          } catch (productError) {
            console.warn('[VENDOR ONBOARDING] Product image upload failed (non-critical):', productError);
            // Continue without product image
          }
        }
      } catch (uploadError) {
        console.error('[VENDOR ONBOARDING] File upload error:', uploadError);
        // Don't fail the whole process - files are optional
        toast({
          title: "File Upload Warning",
          description: "Some files failed to upload, but continuing with application submission.",
          variant: "default",
        });
      }

      // Step 2: Submit vendor application to API
      const applicationPayload: any = {
        businessName: businessData.business_name,
        businessType: businessData.category,
        businessAddress: {
          street: "",
          city: "",
          state: "",
          zip: "",
          country: "US",
        },
        phoneNumber: businessData.phone_number,
        notes: `Banner: ${bannerUrl || 'none'}, Logo: ${logoUrl || 'none'}`,
        idDocumentUrl: businessIdDocumentUrl && businessIdDocumentUrl.startsWith('http') ? businessIdDocumentUrl : null,
        businessLicenseUrl: null, // Optional - can be added later
      };

      // Only include optional fields if they have values
      if (businessData.tax_id) {
        applicationPayload.taxId = businessData.tax_id;
      }

      console.log('[VENDOR ONBOARDING] Submitting application payload:', applicationPayload);
      console.log('[VENDOR ONBOARDING] Payload JSON:', JSON.stringify(applicationPayload, null, 2));

      // Add timeout and retry logic for network issues
      let applicationResponse: Response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          applicationResponse = await Promise.race([
            fetch('/api/vendor/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include', // Include cookies for Clerk auth
              cache: 'no-store', // Prevent caching
              body: JSON.stringify(applicationPayload),
            }),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 30000)
            )
          ]) as Response;
          break; // Success, exit retry loop
        } catch (networkError) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw new Error(
              networkError instanceof Error && networkError.message === 'Request timeout'
                ? 'Request timed out. Please check your internet connection and try again.'
                : 'Network error. Please check your internet connection and try again.'
            );
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          console.log(`[VENDOR ONBOARDING] Retrying request (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        }
      }

      console.log('[VENDOR ONBOARDING] Application submission response status:', applicationResponse.status);
      console.log('[VENDOR ONBOARDING] Response headers:', Object.fromEntries(applicationResponse.headers.entries()));

      if (!applicationResponse.ok) {
        const status = applicationResponse.status;
        const statusText = applicationResponse.statusText;
        let errorData: any = {};
        let responseText = '';
        
        try {
          // Clone the response so we can read it multiple times if needed
          const clonedResponse = applicationResponse.clone();
          
          // Try to get response as text first to see what we're dealing with
          responseText = await clonedResponse.text();
          console.log('[VENDOR ONBOARDING] Raw error response text (length:', responseText.length, '):', responseText.substring(0, 500));
          
          if (responseText && responseText.trim().length > 0) {
            // Try to parse as JSON
            try {
              errorData = JSON.parse(responseText);
              console.log('[VENDOR ONBOARDING] Successfully parsed error response as JSON:', errorData);
              
              // Verify it has content
              if (!errorData || typeof errorData !== 'object' || Object.keys(errorData).length === 0) {
                console.warn('[VENDOR ONBOARDING] Parsed JSON but got empty object, using text as error');
                errorData = { error: responseText };
              }
            } catch (parseError) {
              console.warn('[VENDOR ONBOARDING] Failed to parse as JSON, using text as error:', parseError);
              errorData = { error: responseText };
            }
          } else {
            console.warn('[VENDOR ONBOARDING] Empty response body');
            errorData = { error: `HTTP ${status}: ${statusText} (empty response body)` };
          }
        } catch (e) {
          console.error('[VENDOR ONBOARDING] Failed to read error response:', e);
          errorData = { error: `HTTP ${status}: ${statusText} (failed to read response: ${e instanceof Error ? e.message : String(e)})` };
        }
        
        // Log detailed error information
        console.error('Vendor application submission error:', {
          status,
          statusText,
          responseText: responseText || 'N/A (parsed as JSON)',
          errorData,
          errorDataKeys: errorData ? Object.keys(errorData) : [],
          errorDataStringified: JSON.stringify(errorData),
          headers: Object.fromEntries(applicationResponse.headers.entries()),
          url: applicationResponse.url,
        });
        
        // If errorData is empty or invalid, create error from status code
        if (!errorData || typeof errorData !== 'object' || Object.keys(errorData).length === 0 || (!errorData.error && !errorData.message && !errorData.success)) {
          console.warn('[VENDOR ONBOARDING] Empty or invalid error data, creating error from HTTP status');
          if (status === 401) {
            errorData = { success: false, error: 'Authentication failed. Please sign in again.', code: 'UNAUTHORIZED', type: 'auth_error' };
          } else if (status === 400) {
            errorData = { success: false, error: 'Invalid request data. Please check your input.', code: 'BAD_REQUEST', type: 'parse_error' };
          } else if (status === 403) {
            errorData = { success: false, error: 'Access forbidden.', code: 'FORBIDDEN' };
          } else if (status === 404) {
            errorData = { success: false, error: 'Resource not found.', code: 'NOT_FOUND' };
          } else if (status === 500) {
            errorData = { success: false, error: 'Internal server error. Please try again later.', code: 'INTERNAL_ERROR' };
          } else if (status === 429) {
            errorData = { success: false, error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT' };
          } else {
            errorData = { success: false, error: `Request failed (${status} ${statusText})`, code: 'UNKNOWN_ERROR' };
          }
        }
        
        // Ensure errorData has an error message
        if (!errorData.error && !errorData.message) {
          const fallbackMessage = errorData.details 
            ? (typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details))
            : `Request failed with status ${status}`;
          errorData.error = fallbackMessage;
        }
        
        // Determine user-friendly error message based on error type
        let userMessage = 'Failed to submit vendor application';
        let errorTitle = 'Submission Error';
        
        if (errorData.type === 'database_error' && errorData.details?.includes('does not exist')) {
          errorTitle = 'Database Setup Required';
          userMessage = 'The vendor applications table is missing. Please contact support or check the setup documentation.';
          toast({
            title: errorTitle,
            description: userMessage,
            variant: 'destructive',
            duration: 10000,
          });
        } else if (errorData.code === 'DUPLICATE_APPLICATION' || errorData.code === 'ALREADY_VERIFIED' || errorData.error?.includes('already have') || errorData.error?.includes('pending') || errorData.error?.includes('already a verified')) {
          errorTitle = errorData.code === 'ALREADY_VERIFIED' ? 'Already Verified' : 'Application Already Submitted';
          userMessage = errorData.error || errorData.message || (errorData.code === 'ALREADY_VERIFIED' 
            ? 'You are already a verified vendor.' 
            : 'You already have a pending verification application. Please wait for it to be reviewed.');
          toast({
            title: errorTitle,
            description: userMessage,
            variant: 'default',
            duration: 8000,
          });
          // Redirect to vendor dashboard to see status (don't throw error)
          setTimeout(async () => {
            try {
              const profile = await getProfile(userId);
              router.push(profile?.id && profile.id !== userId ? `/vendor/${profile.id}` : '/vendor');
            } catch {
              router.push('/vendor/dashboard');
            }
          }, 2000);
          setSubmitting(false);
          return; // Exit early, don't throw error
        } else if (errorData.type === 'auth_error' || status === 401 || errorData.code === 'UNAUTHORIZED' || errorData.error?.includes('Authentication')) {
          errorTitle = 'Authentication Error';
          userMessage = errorData.error || errorData.message || errorData.details || 'Please sign in again to continue.';
          toast({
            title: errorTitle,
            description: userMessage,
            variant: 'destructive',
            duration: 5000,
          });
          // Redirect to sign in if authentication failed
          setTimeout(() => {
            router.push('/auth?redirect_url=' + encodeURIComponent(window.location.pathname));
          }, 2000);
        } else if (errorData.type === 'parse_error' || status === 400) {
          errorTitle = 'Invalid Data';
          if (Array.isArray(errorData.details)) {
            const validationErrors = errorData.details.map((issue: any) => 
              `${issue.path?.join('.') || 'field'}: ${issue.message}`
            ).join(', ');
            userMessage = `Please check your input: ${validationErrors}`;
          } else {
            userMessage = errorData.error || errorData.details || 'Please check your input and try again.';
          }
          toast({
            title: errorTitle,
            description: userMessage,
            variant: 'destructive',
          });
        } else {
          userMessage = errorData.error || 
            errorData.details || 
            (typeof errorData.details === 'object' ? JSON.stringify(errorData.details) : errorData.details) ||
            errorData.message ||
            `Failed to submit vendor application (${status} ${statusText})`;
          toast({
            title: errorTitle,
            description: userMessage,
            variant: 'destructive',
            duration: 8000,
          });
        }
        
        throw new Error(userMessage);
      }

      console.log('[VENDOR ONBOARDING] Application submitted successfully!');
      
      // Parse response with error handling
      let applicationResult: any;
      try {
        // Use .json() instead of .text() for better error handling
        applicationResult = await applicationResponse.json();
        console.log('[VENDOR ONBOARDING] Parsed application result:', applicationResult);
      } catch (parseError) {
        console.error('[VENDOR ONBOARDING] Response parsing error:', parseError);
        // Try to get text response for debugging
        try {
          const responseText = await applicationResponse.text();
          console.error('[VENDOR ONBOARDING] Raw response text:', responseText);
        } catch (textError) {
          console.error('[VENDOR ONBOARDING] Could not read response as text:', textError);
        }
        throw new Error(
          parseError instanceof Error 
            ? `Failed to parse server response: ${parseError.message}` 
            : 'Failed to parse server response'
        );
      }
      
      // Verify response structure
      if (!applicationResult || typeof applicationResult !== 'object') {
        throw new Error('Invalid response format from server');
      }

      // Check if response indicates success
      if (applicationResult.success === false) {
        throw new Error(applicationResult.error || 'Application submission failed');
      }

      // Verify we got a valid application ID
      const applicationId = applicationResult?.data?.application?.id || applicationResult?.application?.id;
      if (!applicationId) {
        console.warn('[VENDOR ONBOARDING] No application ID in response, but continuing...');
      }

      // Get profile UUID from the application response if available
      const profileIdFromResponse = applicationResult?.data?.application?.user_id || applicationResult?.application?.user_id;
      console.log('[VENDOR ONBOARDING] Profile ID from response:', profileIdFromResponse);

      // Step 3: Update profile with vendor info (banner, logo, bio) and mark onboarding complete
      // Note: The API route already sets is_vendor=true, but we update other fields here
      console.log('[VENDOR ONBOARDING] Updating profile with vendor details...');
      const profileUpdate: Record<string, unknown> = {
        bio: profileData.description || undefined,
        onboarding_completed: true,
      };

      if (logoUrl && logoUrl.startsWith('http')) {
        profileUpdate.avatar_url = logoUrl;
      }

      let vendorProfile = await updateProfile(userId, profileUpdate);
      setProfile(vendorProfile);

      try {
        await refetch();
        vendorProfile = await getProfile(userId);
        setProfile(vendorProfile);
      } catch (refreshError) {
        console.warn('[VENDOR ONBOARDING] Profile refresh after update:', refreshError);
      }

      if (!isOnboardingComplete(vendorProfile)) {
        const errorMsg =
          'Application was submitted but onboarding could not be marked complete. Please try again or contact support.';
        toast({
          title: 'Profile update required',
          description: errorMsg,
          variant: 'destructive',
        });
        throw new Error(errorMsg);
      }

      console.log('[VENDOR ONBOARDING] Profile updated successfully');

      // Step 4: Create subscription
      const subscriptionData = subscriptionForm.getValues();
      console.log('[VENDOR ONBOARDING] Creating subscription...', subscriptionData);
      try {
        const subscriptionResponse = await fetch("/api/vendor/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            tier: subscriptionData.tier,
          }),
        });

        if (!subscriptionResponse.ok) {
          const errorData = await subscriptionResponse.json().catch(() => ({}));
          console.warn('[VENDOR ONBOARDING] Subscription creation failed (non-critical):', errorData);
          // Don't throw - subscription will default to free tier
        } else {
          console.log('[VENDOR ONBOARDING] Subscription created successfully');
        }
      } catch (subscriptionError) {
        console.error('Failed to create subscription:', subscriptionError);
        // Don't fail the whole process if subscription creation fails
      }

      // Step 5: Create first product via API (optional - only if product data is provided)
      if (productData.title && productData.description) {
        console.log('[VENDOR ONBOARDING] Creating first product...');
        try {
          // Don't pass vendor - API route will automatically use current user's profile UUID
          const listingResponse = await fetch("/api/listings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: productData.title,
              description: productData.description,
              price: productData.price,
              category: productData.category,
              images: productImageUrl ? [productImageUrl] : [],
              active: false, // Don't activate until vendor is approved
            }),
          });
          
          if (!listingResponse.ok) {
            const errorData = await listingResponse.json().catch(() => ({}));
            console.warn('[VENDOR ONBOARDING] Listing creation failed (non-critical):', errorData);
            // Don't throw - listing creation is optional
          }
        } catch (listingError) {
          console.error('Failed to create listing:', listingError);
          // Don't fail the whole process if listing creation fails
        }
      }

      console.log('[VENDOR ONBOARDING] All steps complete, showing success message');
      
      // Get profile UUID for redirect (userId is Clerk ID, need profile UUID for route)
      let profileId = profileIdFromResponse;
      
      // If we didn't get profileId from response, try to fetch it
      if (!profileId) {
        console.log('[VENDOR ONBOARDING] Profile ID not in response, fetching profile...');
        try {
          const profile = await getProfile(userId);
          if (profile?.id) {
            profileId = profile.id;
            console.log('[VENDOR ONBOARDING] Got profile UUID from getProfile:', profileId);
          } else {
            console.warn('[VENDOR ONBOARDING] Profile returned but no ID, will use Clerk ID as fallback');
            profileId = userId; // Fallback to Clerk ID
          }
        } catch (profileError) {
          console.warn('[VENDOR ONBOARDING] Failed to get profile UUID:', profileError);
          // Fallback to Clerk ID - VendorDashboard can handle both Clerk ID and UUID
          profileId = userId;
        }
      } else {
        console.log('[VENDOR ONBOARDING] Using profile UUID from application response:', profileId);
      }
      
      // Invalidate queries to refresh data for admin and user
      try {
        queryClient.invalidateQueries({ queryKey: ["admin", "vendor-applications"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
        queryClient.invalidateQueries({ queryKey: ["profile", userId] });
        queryClient.invalidateQueries({ queryKey: ["vendorProfile", profileId] });
        queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
        console.log('[VENDOR ONBOARDING] Queries invalidated for admin and user refresh');
      } catch (e) {
        console.warn('[VENDOR ONBOARDING] Query invalidation failed (non-critical):', e);
      }
      
      toast({
        title: "Vendor onboarding complete! 🎉",
        description: "Your vendor application has been submitted for review. You'll be notified once it's approved.",
        duration: 5000,
      });

      console.log('[VENDOR ONBOARDING] Redirecting to /vendor/' + profileId);
      
      // Clear draft after successful submission
      clearDraft();
      
      // Small delay to ensure toast is visible
      setTimeout(() => {
        router.push(`/vendor/${profileId}`);
      }, 1000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete onboarding'
      console.error('Vendor onboarding error:', error);
      
      // Only show toast if we haven't already shown one in the error handling above
      // The error handling in the API response section already shows toasts for specific errors
      if (!errorMessage.includes('Database Setup Required') && 
          !errorMessage.includes('Authentication Error') &&
          !errorMessage.includes('Invalid Data') &&
          !errorMessage.includes('Submission Error')) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
          duration: 8000,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (currentStep / 6) * 100;
  const steps = [
    { number: 1, title: "Business Info", icon: Building2 },
    { number: 2, title: "Profile Setup", icon: ImageIcon },
    { number: 3, title: "First Product", icon: DollarSign },
    { number: 4, title: "Subscription", icon: Sparkles },
    { number: 5, title: "Payout", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10 p-3 sm:p-4">
      <Card className="w-full max-w-3xl shadow-primary">
        <CardHeader className="space-y-3 sm:space-y-4 p-4 sm:p-6">
          <div>
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              Vendor Onboarding
            </CardTitle>
            <CardDescription className="text-sm">Complete these steps to set up your vendor account</CardDescription>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSaveDraft}
              className="text-xs sm:text-sm"
            >
              <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Save Draft
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs sm:text-sm"
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              // Check if step is valid
              let isStepValid = false;
              if (step.number === 1) {
                isStepValid = businessForm.formState.isValid && !!businessForm.watch("business_name") && !!businessForm.watch("category");
              } else if (step.number === 2) {
                isStepValid = profileForm.formState.isValid && !!profileForm.watch("description");
              } else if (step.number === 3) {
                isStepValid = productForm.formState.isValid && !!productForm.watch("title") && !!productForm.watch("description");
              } else if (step.number === 4) {
                isStepValid = !!subscriptionForm.watch("tier");
              } else if (step.number === 5) {
                isStepValid = !!payoutForm.watch("method");
              }
              
              return (
                <div key={step.number} className="flex flex-col items-center gap-1 sm:gap-2 flex-1 min-w-0">
                  <div
                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? "bg-primary text-white"
                        : isActive
                        ? isStepValid
                          ? "bg-primary text-white ring-2 sm:ring-4 ring-primary/20"
                          : "bg-destructive text-white ring-2 sm:ring-4 ring-destructive/20"
                        : isStepValid
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : isActive && !isStepValid ? (
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : isStepValid && !isActive ? (
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs text-center truncate w-full px-0.5 ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* Step 1: Business Info */}
          {currentStep === 1 && (
            <form className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  {...businessForm.register("business_name")}
                  placeholder="e.g., ABC Company"
                />
                {businessForm.formState.errors.business_name && (
                  <p className="text-sm text-destructive">{businessForm.formState.errors.business_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Business Category *</Label>
                <Select
                  value={businessForm.watch("category")}
                  onValueChange={(value) => businessForm.setValue("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                    <SelectItem value="Clothing">Clothing</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {businessForm.formState.errors.category && (
                  <p className="text-sm text-destructive">{businessForm.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Business Phone Number *</Label>
                <Input
                  id="phone_number"
                  {...businessForm.register("phone_number")}
                  placeholder="e.g., +1 (555) 123-4567"
                  type="tel"
                />
                {businessForm.formState.errors.phone_number && (
                  <p className="text-sm text-destructive">{businessForm.formState.errors.phone_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_id">Business ID / Registration Number</Label>
                <Input
                  id="business_id"
                  {...businessForm.register("business_id")}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  {...businessForm.register("tax_id")}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_id_file">Upload Business ID Document</Label>
                <Input
                  id="business_id_file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleBusinessIdUpload}
                />
                {businessIdFile && (
                  <p className="text-sm text-muted-foreground">Selected: {businessIdFile.name}</p>
                )}
              </div>
            </form>
          )}

          {/* Step 2: Profile Setup */}
          {currentStep === 2 && (
            <form className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Store Banner</Label>
                  <div className="relative">
                    {bannerPreview ? (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden">
                        <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setBannerFile(null);
                            setBannerPreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label
                        htmlFor="banner"
                        className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload banner</span>
                      </label>
                    )}
                    <Input
                      id="banner"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBannerChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={logoPreview || undefined} />
                      <AvatarFallback>
                        <ImageIcon className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Label htmlFor="logo" className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Logo
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Store Description *</Label>
                <Textarea
                  id="description"
                  {...profileForm.register("description")}
                  placeholder="Tell customers about your store..."
                  rows={6}
                />
                {profileForm.formState.errors.description && (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  {...profileForm.register("tags")}
                  placeholder="e.g., organic, local, handmade"
                />
              </div>
            </form>
          )}

          {/* Step 3: First Product */}
          {currentStep === 3 && (
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product_title">Product Title *</Label>
                <Input
                  id="product_title"
                  {...productForm.register("title")}
                  placeholder="e.g., Organic Coffee Beans"
                />
                {productForm.formState.errors.title && (
                  <p className="text-sm text-destructive">{productForm.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_description">Description *</Label>
                <Textarea
                  id="product_description"
                  {...productForm.register("description")}
                  placeholder="Describe your product..."
                  rows={4}
                />
                {productForm.formState.errors.description && (
                  <p className="text-sm text-destructive">{productForm.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_price">Price (USD) *</Label>
                  <Input
                    id="product_price"
                    type="number"
                    step="0.01"
                    min="0"
                    {...productForm.register("price", { valueAsNumber: true })}
                    placeholder="0.00"
                    className="min-h-[44px]"
                  />
                  {productForm.formState.errors.price && (
                    <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_category">Category *</Label>
                  <Select
                    value={productForm.watch("category")}
                    onValueChange={(value) => productForm.setValue("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                      <SelectItem value="Clothing">Clothing</SelectItem>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {productForm.formState.errors.category && (
                    <p className="text-sm text-destructive">{productForm.formState.errors.category.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Image</Label>
                {productImagePreview ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden">
                    <img src={productImagePreview} alt="Product preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setProductImageFile(null);
                        setProductImagePreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="product_image"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload product image</span>
                  </label>
                )}
                <Input
                  id="product_image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProductImageChange}
                />
              </div>
            </form>
          )}

          {/* Step 4: Subscription Plan */}
          {currentStep === 4 && (
            <TooltipProvider>
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Choose Your Subscription Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a plan that fits your business needs. You can upgrade or downgrade anytime.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['free', 'basic', 'pro', 'premium'] as const).map((tier) => {
                    const config = SUBSCRIPTION_TIERS[tier]
                    const isSelected = subscriptionForm.watch("tier") === tier
                    
                    return (
                      <Tooltip key={tier}>
                        <TooltipTrigger asChild>
                          <Card
                            className={`cursor-pointer transition-all hover:border-primary ${
                              isSelected ? 'border-primary ring-2 ring-primary' : ''
                            }`}
                            onClick={() => subscriptionForm.setValue("tier", tier)}
                          >
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{config.name}</CardTitle>
                                {tier === 'free' && <Sparkles className="h-5 w-5 text-muted-foreground" />}
                                {tier === 'basic' && <Zap className="h-5 w-5 text-blue-500" />}
                                {tier === 'pro' && <Crown className="h-5 w-5 text-yellow-500" />}
                                {tier === 'premium' && <Crown className="h-5 w-5 text-purple-500" />}
                              </div>
                              <div className="mt-2">
                                <span className="text-3xl font-bold">${config.price}</span>
                                {config.price > 0 && <span className="text-muted-foreground">/month</span>}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium">
                                    {config.listingLimit === -1 ? 'Unlimited' : config.listingLimit} Listings
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {config.transactionFee}% transaction fee
                                  </p>
                                </div>
                                <ul className="text-sm space-y-1">
                                  {config.features.slice(0, 3).map((feature, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-primary" />
                                      <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                                    </li>
                                  ))}
                                  {config.features.length > 3 && (
                                    <li className="text-xs text-muted-foreground">
                                      +{config.features.length - 3} more features
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{config.name} Features:</p>
                            <ul className="text-xs space-y-1">
                              {config.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                                  <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs pt-2 border-t">
                              <strong>Transaction Fee:</strong> {config.transactionFee}% per sale
                            </p>
                            <p className="text-xs">
                              <strong>Listing Limit:</strong> {config.listingLimit === -1 ? 'Unlimited' : `${config.listingLimit} listings`}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Free tier is perfect for getting started. You can upgrade anytime to unlock more features and lower transaction fees.
                  </p>
                </div>
              </div>
            </TooltipProvider>
          )}

          {/* Step 5: Payout Method */}
          {currentStep === 5 && (
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="payout_method">Payout Method *</Label>
                <Select
                  value={payoutForm.watch("method")}
                  onValueChange={(value: "stripe" | "bank" | "paypal") => payoutForm.setValue("method", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe Connect (Recommended)</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutForm.watch("method") === "stripe" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Stripe Connect Setup</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Stripe Connect allows you to receive payments directly. You can set it up now or after your application is approved.
                    </p>
                    <Button
                      type="button"
                      onClick={handleStripeConnect}
                      disabled={connectLoading}
                      className="mt-2"
                    >
                      {connectLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Set Up Stripe Connect
                        </>
                      )}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {payoutForm.watch("method") === "bank" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Bank Transfer</AlertTitle>
                  <AlertDescription>
                    Bank transfer setup will be available after your vendor application is approved. You'll receive instructions via email.
                  </AlertDescription>
                </Alert>
              )}

              {payoutForm.watch("method") === "paypal" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>PayPal</AlertTitle>
                  <AlertDescription>
                    PayPal setup will be available after your vendor application is approved. You'll receive instructions via email.
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> You can change your payout method anytime after approval. Stripe Connect is recommended for fastest payouts and lowest fees.
                </p>
              </div>
            </form>
          )}

          {/* Step 6: Complete */}
          {currentStep === 6 && (
            <div className="text-center space-y-6 py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your vendor application has been submitted. You'll receive a notification once it's been reviewed and
                  approved.
                </p>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {showPreview && currentStep < 6 && (
            <div className="mt-6 p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Preview</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-background rounded-lg border">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Business Information</p>
                    <p className="text-xs text-muted-foreground">
                      Name: {businessForm.watch("business_name") || "Not set"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Category: {businessForm.watch("category") || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-background rounded-lg border">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Profile</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Description: {profileForm.watch("description") || "Not set"}
                    </p>
                    {bannerPreview && (
                      <img src={bannerPreview} alt="Banner preview" className="w-full h-24 object-cover rounded" />
                    )}
                    {logoPreview && (
                      <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-cover rounded" />
                    )}
                  </div>
                </div>
                <div className="p-4 bg-background rounded-lg border">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">First Product</p>
                    <p className="text-xs text-muted-foreground">
                      Title: {productForm.watch("title") || "Not set"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Price: ${productForm.watch("price") || "0.00"}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-background rounded-lg border">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Subscription</p>
                    <Badge>
                      {SUBSCRIPTION_TIERS[subscriptionForm.watch("tier") || "free"].name}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 mt-6 sm:mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  router.push("/onboarding");
                }
              }}
              disabled={submitting}
              className="w-full sm:w-auto min-h-[44px]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {currentStep === 1 ? "Back" : "Previous"}
            </Button>

            {currentStep < 6 ? (
              <Button onClick={handleNext} disabled={submitting} className="w-full sm:w-auto min-h-[44px]">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto min-h-[44px]">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

