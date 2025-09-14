"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryForm } from "./category-form";
import { ServiceForm } from "./service-form";
import { deleteCategory, deleteService } from "@/app/actions/catalog";
import toast from "react-hot-toast";
import { HiDotsHorizontal } from "react-icons/hi";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

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

interface CatalogTableProps {
  categories: Category[];
  uncategorizedServices: Service[];
  onDataChange: () => void;
}

export function CatalogTable({ categories, uncategorizedServices, onDataChange }: CatalogTableProps) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    
    setIsDeleting(categoryId);
    try {
      const result = await deleteCategory({ id: categoryId });
      if (result.success) {
        toast.success("Category deleted successfully");
        onDataChange();
      } else {
        toast.error(result.error || "Failed to delete category");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    
    setIsDeleting(serviceId);
    try {
      const result = await deleteService({ id: serviceId });
      if (result.success) {
        toast.success("Service deleted successfully");
        onDataChange();
      } else {
        toast.error(result.error || "Failed to delete service");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(null);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const allCategories = categories.map(cat => ({ id: cat.id, name: cat.name }));

  // Mobile card component for services
  const ServiceCard = ({ service }: { service: Service }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{service.name}</h4>
            <Badge variant={service.active ? "default" : "secondary"}>
              {service.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDuration(service.durationMinutes)}</span>
            <span>{formatPrice(service.priceCents)}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <HiDotsHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditingService(service);
                setShowServiceForm(true);
              }}
            >
              <FiEdit2 className="mr-2 h-4 w-4" />
              Edit Service
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteService(service.id)}
              disabled={isDeleting === service.id}
              className="text-destructive"
            >
              <FiTrash2 className="mr-2 h-4 w-4" />
              Delete Service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );

  // Desktop table component for services
  const ServiceTable = ({ services }: { services: Service[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service Name</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((service) => (
          <TableRow key={service.id}>
            <TableCell className="font-medium">{service.name}</TableCell>
            <TableCell>{formatDuration(service.durationMinutes)}</TableCell>
            <TableCell>{formatPrice(service.priceCents)}</TableCell>
            <TableCell>
              <Badge variant={service.active ? "default" : "secondary"}>
                {service.active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <HiDotsHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingService(service);
                      setShowServiceForm(true);
                    }}
                  >
                    <FiEdit2 className="mr-2 h-4 w-4" />
                    Edit Service
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteService(service.id)}
                    disabled={isDeleting === service.id}
                    className="text-destructive"
                  >
                    <FiTrash2 className="mr-2 h-4 w-4" />
                    Delete Service
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Categories and their services */}
        {categories.map((category) => (
          <div key={category.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {category.services.length} service{category.services.length !== 1 ? 's' : ''}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <HiDotsHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingCategory(category);
                      setShowCategoryForm(true);
                    }}
                  >
                    <FiEdit2 className="mr-2 h-4 w-4" />
                    Edit Category
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={isDeleting === category.id}
                    className="text-destructive"
                  >
                    <FiTrash2 className="mr-2 h-4 w-4" />
                    Delete Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {category.services.length > 0 ? (
              <>
                {/* Desktop view - Table */}
                <div className="hidden md:block">
                  <ServiceTable services={category.services} />
                </div>
                
                {/* Mobile view - Cards */}
                <div className="md:hidden space-y-3">
                  {category.services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No services in this category yet.
              </div>
            )}
          </div>
        ))}

        {/* Uncategorized services */}
        {uncategorizedServices.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Uncategorized Services</h3>
              <p className="text-sm text-muted-foreground">
                {uncategorizedServices.length} service{uncategorizedServices.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Desktop view - Table */}
            <div className="hidden md:block">
              <ServiceTable services={uncategorizedServices} />
            </div>
            
            {/* Mobile view - Cards */}
            <div className="md:hidden space-y-3">
              {uncategorizedServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {categories.length === 0 && uncategorizedServices.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No services yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by creating your first service category and services.
            </p>
            <div className="space-x-2">
              <Button onClick={() => setShowCategoryForm(true)}>
                Create Category
              </Button>
              <Button variant="outline" onClick={() => setShowServiceForm(true)}>
                Create Service
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Forms */}
      <CategoryForm
        open={showCategoryForm}
        onOpenChange={(open) => {
          setShowCategoryForm(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory || undefined}
        onSuccess={() => {
          onDataChange();
          setEditingCategory(null);
        }}
      />

      <ServiceForm
        open={showServiceForm}
        onOpenChange={(open) => {
          setShowServiceForm(open);
          if (!open) setEditingService(null);
        }}
        service={editingService || undefined}
        categories={allCategories}
        onSuccess={() => {
          onDataChange();
          setEditingService(null);
        }}
      />
    </>
  );
}
