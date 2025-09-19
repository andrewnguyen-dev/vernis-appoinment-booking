"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { SalonGeneralSettings } from "./salon-general-settings";
import { getSalonSettings } from "@/app/actions/salon-settings";

interface SalonData {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
  logoUrl: string | null;
  capacity: number | null;
  customDomain: string | null;
}

export function SalonSettingsManager() {
  const [salonData, setSalonData] = useState<SalonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Load salon data
  useEffect(() => {
    async function loadSalonData() {
      try {
        setLoading(true);
        const result = await getSalonSettings();
        
        if (result.success && result.data) {
          setSalonData(result.data);
          setError(null);
        } else {
          setError(result.error || "Failed to load salon settings");
        }
      } catch (err) {
        setError("An unexpected error occurred");
        console.error("Error loading salon data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSalonData();
  }, []);

  // Handle data updates
  const handleDataUpdate = (newData: SalonData) => {
    setSalonData(newData);
    toast.success("Settings updated successfully!");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 rounded bg-muted animate-pulse" />
        <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-12 rounded bg-muted animate-pulse" />
          <div className="h-12 rounded bg-muted animate-pulse" />
          <div className="h-12 rounded bg-muted animate-pulse" />
          <div className="h-12 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-12 w-32 rounded bg-muted animate-pulse mt-6" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!salonData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No salon data found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <SalonGeneralSettings 
        salon={salonData} 
        onUpdate={handleDataUpdate}
      />
    </div>
  );
}