"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { stripeConnectConfigSchema, type StripeConnectConfigData } from "@/helpers/zod/stripe-schemas";
import { createStripeConnectLink, getStripeAccountStatus, createStripeLoginLink, disconnectStripeAccount } from "@/app/actions/stripe-connect";
import { updateStripeConfig } from "@/app/actions/stripe-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  XCircle,
  DollarSign,
  Percent,
  Shield,
} from "lucide-react";

interface StripeConnectSetupProps {
  initialValues?: Partial<StripeConnectConfigData>;
  stripeAccountId?: string | null;
  onConfigUpdate?: (config: StripeConnectConfigData) => void;
  showInOnboarding?: boolean;
}

interface StripeAccountStatus {
  connected: boolean;
  status: string | null;
  account?: {
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements?: {
      currently_due?: string[] | null;
      eventually_due?: string[] | null;
    };
  };
}

export function StripeConnectSetup({ 
  initialValues = {
    depositType: "PERCENTAGE",
    depositValue: 2000, // 20%
    depositDescription: "Booking deposit",
    requireDeposit: true,
  },
  stripeAccountId,
  onConfigUpdate,
  showInOnboarding = false,
}: StripeConnectSetupProps) {
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<StripeConnectConfigData>({
    resolver: zodResolver(stripeConnectConfigSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const depositType = form.watch("depositType");
  const requireDeposit = form.watch("requireDeposit");

  // Load account status on mount if we have a Stripe account
  useState(() => {
    if (stripeAccountId) {
      checkAccountStatus();
    }
  });

  async function checkAccountStatus() {
    if (!stripeAccountId) return;
    
    setIsLoadingStatus(true);
    try {
      const status = await getStripeAccountStatus();
      setAccountStatus(status);
    } catch (error) {
      console.error("Failed to load Stripe account status:", error);
      toast.error("Failed to load payment account status");
    } finally {
      setIsLoadingStatus(false);
    }
  }

  async function handleConnectStripe() {
    const formData = new FormData();
    formData.append("refreshUrl", `${window.location.origin}/owner/settings?stripe_refresh=true`);
    formData.append("returnUrl", `${window.location.origin}/owner/settings?stripe_return=true`);
    console.log("Connecting with URLs:", formData.get("refreshUrl"), formData.get("returnUrl"));

    startTransition(async () => {
      try {
        const result = await createStripeConnectLink(formData);
        if (result.success && result.url) {
          // Redirect to Stripe Connect URL
          window.location.href = result.url;
        } else {
          console.error("Failed to create Stripe Connect link:", result.error);
          toast.error(result.error || "Failed to connect Stripe account. Please try again.");
        }
      } catch (error) {
        console.error("Failed to create Stripe Connect link:", error);
        toast.error("Failed to connect Stripe account. Please try again.");
      }
    });
  }

  async function handleOpenDashboard() {
    startTransition(async () => {
      try {
        const result = await createStripeLoginLink();
        if (result.success && result.url) {
          // Open Stripe Dashboard in a new tab
          window.open(result.url, '_blank');
        } else {
          console.error("Failed to open Stripe dashboard:", result.error);
          toast.error(result.error || "Failed to open Stripe dashboard. Please try again.");
        }
      } catch (error) {
        console.error("Failed to open Stripe dashboard:", error);
        toast.error("Failed to open Stripe dashboard. Please try again.");
      }
    });
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect your Stripe account? This will disable payment processing for your salon.")) {
      return;
    }

    startTransition(async () => {
      try {
        await disconnectStripeAccount();
        setAccountStatus(null);
        toast.success("Stripe account disconnected successfully");
      } catch (error) {
        console.error("Failed to disconnect Stripe account:", error);
        toast.error("Failed to disconnect Stripe account. Please try again.");
      }
    });
  }

  function formatDepositAmount(type: string, value: number) {
    switch (type) {
      case "PERCENTAGE":
        return `${(value / 100).toFixed(1)}%`;
      case "FIXED_AMOUNT":
        return `$${(value / 100).toFixed(2)}`;
      case "AUTHORIZATION_ONLY":
        return "$1.00 authorization";
      default:
        return "N/A";
    }
  }

  function handleDepositTypeChange(newType: string) {
    // Set appropriate default values when type changes
    if (newType === "PERCENTAGE") {
      form.setValue("depositValue", 2000); // 20%
    } else if (newType === "FIXED_AMOUNT") {
      form.setValue("depositValue", 1000); // $10.00
    } else if (newType === "AUTHORIZATION_ONLY") {
      form.setValue("depositValue", 100); // $1.00 (fixed)
    }
  }

  const isConnected = accountStatus?.connected ?? false;
  const needsSetup = stripeAccountId && accountStatus?.account?.requirements?.currently_due?.length;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Processing
          </CardTitle>
          <CardDescription>
            {showInOnboarding 
              ? "Set up Stripe to accept payments from your clients. You can configure this later if you prefer." 
              : "Manage your Stripe Connect account and payment settings."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStatus ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking account status...</span>
            </div>
          ) : !stripeAccountId ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your Stripe account to start accepting payments from clients.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleConnectStripe} 
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Connect Stripe Account
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Connection Status:</span>
                  {isConnected ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : needsSetup ? (
                    <Badge variant="secondary">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Setup Required
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Not Active
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenDashboard}
                    disabled={isPending}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Stripe Dashboard
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {needsSetup && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your Stripe account needs additional information. 
                    <Button 
                      variant="link" 
                      className="px-1 h-auto font-normal" 
                      onClick={handleOpenDashboard}
                    >
                      Complete setup in Stripe Dashboard
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Deposit Configuration
          </CardTitle>
          <CardDescription>
            Configure how much clients pay when booking appointments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="requireDeposit"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">
                        Require payment at booking
                      </FormLabel>
                      <FormDescription>
                        Collect deposits or full payment when clients book appointments
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {requireDeposit && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="depositType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleDepositTypeChange(value);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PERCENTAGE">
                              <div className="flex items-center gap-2">
                                <Percent className="h-4 w-4" />
                                <span>Percentage of total</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="FIXED_AMOUNT">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span>Fixed amount</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="AUTHORIZATION_ONLY">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                <span>$1 authorization only</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose how to calculate the payment amount
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {depositType !== "AUTHORIZATION_ONLY" && (
                    <FormField
                      control={form.control}
                      name="depositValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {depositType === "PERCENTAGE" ? "Percentage" : "Amount"}
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder={depositType === "PERCENTAGE" ? "20" : "10.00"}
                                step={depositType === "PERCENTAGE" ? "1" : "0.01"}
                                min="0"
                                max={depositType === "PERCENTAGE" ? "100" : "1000"}
                                value={
                                  depositType === "PERCENTAGE" 
                                    ? (field.value / 100).toString()
                                    : (field.value / 100).toFixed(2)
                                }
                                onChange={(e) => {
                                  const inputValue = parseFloat(e.target.value) || 0;
                                  const centsValue = depositType === "PERCENTAGE" 
                                    ? Math.round(inputValue * 100) // Convert percentage to basis points
                                    : Math.round(inputValue * 100); // Convert dollars to cents
                                  field.onChange(centsValue);
                                }}
                              />
                              <span className="text-sm text-muted-foreground min-w-fit">
                                {depositType === "PERCENTAGE" ? "%" : "AUD"}
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {depositType === "PERCENTAGE" 
                              ? "Percentage of the total appointment cost (1-100%)" 
                              : "Fixed amount in Australian dollars"
                            }
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="depositDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Booking deposit" 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This description appears on receipts and payment confirmations
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview */}
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h4 className="font-medium mb-2">Preview</h4>
                    <p className="text-sm text-muted-foreground">
                      Clients will pay{" "}
                      <span className="font-medium">
                        {formatDepositAmount(depositType, form.watch("depositValue"))}
                      </span>
                      {depositType !== "FIXED_AMOUNT" && depositType !== "AUTHORIZATION_ONLY" && " of the total cost"} when booking.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Description: &ldquo;{form.watch("depositDescription")}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {!showInOnboarding && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={async () => {
                      const values = form.getValues();
                      try {
                        const result = await updateStripeConfig(values);
                        if (result.success) {
                          onConfigUpdate?.(values);
                          toast.success("Payment settings updated successfully");
                        } else {
                          toast.error(result.error || "Failed to update payment settings");
                        }
                      } catch (error) {
                        console.error("Failed to update Stripe config:", error);
                        toast.error("Failed to update payment settings. Please try again.");
                      }
                    }}
                    disabled={!form.formState.isValid}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}