"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CatalogTable } from "./catalog-table";
import { CategoryForm } from "./category-form";
import { ServiceForm } from "./service-form";
import { getCatalogData } from "@/app/actions/catalog";
import { FiPlus } from "react-icons/fi";
import toast from "react-hot-toast";

interface Category {
  id: string;
  name: string;
  order: number;
  services: Service[];
}

interface Service {
  id: string;
  name: string;
  categoryId: string | null;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  category?: {
    name: string;
  } | null;
}

export function CatalogManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorizedServices, setUncategorizedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const loadData = async () => {
    try {
      const result = await getCatalogData();
      if (result.success && result.data) {
        setCategories(result.data.categories);
        setUncategorizedServices(result.data.uncategorizedServices);
      } else {
        toast.error(result.error || "Failed to load catalog data");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allCategories = categories.map(cat => ({ id: cat.id, name: cat.name }));
  const totalServices = categories.reduce((sum, cat) => sum + cat.services.length, 0) + uncategorizedServices.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-6 w-12 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...categories.flatMap(cat => cat.services), ...uncategorizedServices]
                .filter(service => service.active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uncategorized</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uncategorizedServices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={() => setShowCategoryForm(true)}>
          <FiPlus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
        <Button variant="outline" onClick={() => setShowServiceForm(true)}>
          <FiPlus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      {/* Catalog Table */}
      <Card>
        <CardContent className="p-6">
          <CatalogTable
            categories={categories}
            uncategorizedServices={uncategorizedServices}
            onDataChange={loadData}
          />
        </CardContent>
      </Card>

      {/* Forms */}
      <CategoryForm
        open={showCategoryForm}
        onOpenChange={setShowCategoryForm}
        onSuccess={loadData}
      />

      <ServiceForm
        open={showServiceForm}
        onOpenChange={setShowServiceForm}
        categories={allCategories}
        onSuccess={loadData}
      />
    </div>
  );
}
