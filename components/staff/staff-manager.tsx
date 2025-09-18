"use client";

import { useState } from "react";
import { Plus, Settings, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StaffForm } from "./staff-form";
import { StaffSettingsDialog } from "./staff-settings-dialog";

interface Staff {
  id: string;
  phone: string | null;
  color: string;
  active: boolean;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  isOwner?: boolean;
}

interface StaffManagerProps {
  salonId: string;
  staff: Staff[];
}

export function StaffManager({ salonId, staff }: StaffManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const activeStaff = staff.filter(s => s.active);
  const inactiveStaff = staff.filter(s => !s.active);

  const handleEditStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsSettingsDialogOpen(true);
  };

  const ColorIndicator = ({ color }: { color: string }) => (
    <div
      className="w-4 h-4 rounded-full border border-gray-200"
      style={{ backgroundColor: color }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Staff Members</h2>
          <p className="text-sm text-muted-foreground">
            {activeStaff.length} active staff member{activeStaff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Staff</DialogTitle>
              <DialogDescription>
                Add an existing user to your salon staff. The user must already have an account.
              </DialogDescription>
            </DialogHeader>
            <StaffForm
              salonId={salonId}
              onSuccess={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Staff</CardTitle>
          <CardDescription>
            Currently active staff members in your salon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeStaff.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No active staff members yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first staff member to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <ColorIndicator color={staff.color} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {staff.user.name}
                      {staff.isOwner && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Owner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{staff.user.email}</TableCell>
                    <TableCell>{staff.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600">
                        <Eye className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStaff(staff)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inactive Staff Table (if any) */}
      {inactiveStaff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Staff</CardTitle>
            <CardDescription>
              Staff members who are no longer active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <ColorIndicator color={staff.color} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {staff.user.name}
                      {staff.isOwner && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Owner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{staff.user.email}</TableCell>
                    <TableCell>{staff.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-gray-500">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStaff(staff)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Staff Settings Dialog */}
      <StaffSettingsDialog
        staff={selectedStaff}
        isOpen={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
        onClose={() => {
          setSelectedStaff(null);
          setIsSettingsDialogOpen(false);
        }}
      />
    </div>
  );
}
