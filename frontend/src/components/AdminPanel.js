import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { 
  Shield, 
  Users, 
  Search, 
  Edit3, 
  Save, 
  X,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { employeeAPI } from '../Services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

const AdminPanel = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Use the centralized API function
      const data = await employeeAPI.getAllEmployees();
      setAllEmployees(data);
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to fetch employees.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    }
  }, [user]);

  const filteredEmployees = allEmployees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePasswordReset = (employee) => {
    setSelectedUser(employee);
    setShowPasswordResetDialog(true);
    setNewPassword('');
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    try {
      await employeeAPI.admin.resetPassword(selectedUser.email, newPassword);

      toast({
        title: "Password Reset",
        description: `Password for ${selectedUser.name} has been reset successfully.`,
      });
      
      setShowPasswordResetDialog(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      console.error("Failed to save password:", error);
      toast({ title: "Error", description: error.detail || error.message, variant: "destructive" });
    }
  };

  const handleEditUser = (employee) => {
    setEditingUser({
      ...employee,
      originalEmail: employee.email
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    const payload = {
      name: editingUser.name,
      email: editingUser.email,
      designation: editingUser.designation,
      department: editingUser.department,
      team: editingUser.team,
      empCode: editingUser.empCode,
    };

    console.log("Attempting to update user:", editingUser.originalEmail, "with payload:", payload);

    try {
      await employeeAPI.admin.updateUserDetails(editingUser.originalEmail, payload);

      toast({
        title: "User Updated",
        description: `User ${editingUser.name} has been updated successfully.`,
      });
      setEditingUser(null);
      fetchEmployees();
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({ title: "Error", description: error.detail || error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || isDeleting) return;

    if (userToDelete.email === user.email) {
      toast({ title: "Action Forbidden", description: "Administrators cannot delete their own accounts.", variant: "destructive" });
      setShowDeleteDialog(false);
      return;
    }

    setIsDeleting(true);
    console.log("Attempting to delete user:", userToDelete.email);

    try {
      await employeeAPI.admin.deleteUser(userToDelete.email);

      toast({
        title: "Success",
        description: `User ${userToDelete.name} has been permanently deleted.`,
      });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      fetchEmployees();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error", description: error.detail || error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false); // ALWAYS reset loading state
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">You don't have administrator privileges to access this panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="h-6 w-6 mr-2 text-[#225F8B]" />
          Admin Panel
        </h2>
        <Badge variant="outline" className="bg-[#225F8B]/10 text-[#225F8B] border-[#225F8B]/20">
          {filteredEmployees.length} Users
        </Badge>
      </div>

      {/* Search */}
      <Card className="bg-white/80 backdrop-blur-sm border-0">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees by name, email, or department..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card className="bg-white/80 backdrop-blur-sm border-0">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEmployees.map((employee, index) => (
              <div key={employee.email || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-[#225F8B] text-white">
                      {employee.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">{employee.name}</div>
                    <div className="text-sm text-gray-500">{employee.email}</div>
                    <div className="text-xs text-gray-500">
                      {employee.designation} • {employee.department}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditUser(employee)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePasswordReset(employee)}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Reset Password
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setUserToDelete(employee); setShowDeleteDialog(true); }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">User</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#225F8B] text-white text-xs">
                    {selectedUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{selectedUser?.name}</div>
                  <div className="text-xs text-gray-500">{selectedUser?.email}</div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordResetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePassword}
              className="bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Edit User
              </DialogTitle>
              <DialogDescription>
                Modify the details for <strong>{editingUser.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editName" className="text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="editName"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editEmail" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editDesignation" className="text-sm font-medium">
                  Designation
                </Label>
                <Input
                  id="editDesignation"
                  value={editingUser.designation}
                  onChange={(e) => setEditingUser({...editingUser, designation: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editDepartment" className="text-sm font-medium">
                  Department
                </Label>
                <Input
                  id="editDepartment"
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editTeam" className="text-sm font-medium">
                  Team
                </Label>
                <Input
                  id="editTeam"
                  value={editingUser.team}
                  onChange={(e) => setEditingUser({...editingUser, team: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editEmpCode" className="text-sm font-medium">
                  Employee Code
                </Label>
                <Input
                  id="editEmpCode"
                  value={editingUser.empCode}
                  onChange={(e) => setEditingUser({...editingUser, empCode: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                className="bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the user <strong>{userToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
