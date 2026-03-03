import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { ordersAPI, addressesAPI, wishlistAPI, userAPI, authAPI, productsAPI } from '@/lib/api';
import { safeStorage } from '@/lib/safeStorage';
import Loader from '@/components/common/Loader';
import useSEO from '@/hooks/useSEO';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, Mail, Phone, MapPin, Package, Heart, Clock, Shield, HelpCircle, 
  LogOut, Edit2, Plus, Trash2, Star, Eye, ShoppingCart, Check, X,
  ChevronRight, Lock, AlertTriangle, ExternalLink
} from 'lucide-react';

const RECENTLY_VIEWED_KEY = 'recentlyViewedProducts';
const MAX_RECENTLY_VIEWED = 10;

const ProfilePage = () => {
  const { user, logout, refreshUser } = useAuth();
  const { success, error } = useAlert();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  
  useSEO({
    title: 'My Account',
    description: 'Manage your Souba Atelier account. View orders, saved addresses, wishlist, and update your profile settings.'
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [loadingRecentlyViewed, setLoadingRecentlyViewed] = useState(true);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const data = await ordersAPI.getMyOrders();
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoadingAddresses(true);
      const data = await addressesAPI.getAll();
      setAddresses(data || []);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const fetchWishlist = useCallback(async () => {
    try {
      setLoadingWishlist(true);
      const data = await wishlistAPI.getAll();
      setWishlist(data || []);
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
    } finally {
      setLoadingWishlist(false);
    }
  }, []);

  const fetchRecentlyViewed = useCallback(async () => {
    try {
      setLoadingRecentlyViewed(true);
      const storedCodes = safeStorage.getJSON(RECENTLY_VIEWED_KEY, []);
      if (storedCodes.length === 0) {
        setRecentlyViewed([]);
        return;
      }
      
      const products = await Promise.all(
        storedCodes.slice(0, MAX_RECENTLY_VIEWED).map(async (code) => {
          try {
            return await productsAPI.getByCode(code);
          } catch {
            return null;
          }
        })
      );
      setRecentlyViewed(products.filter(Boolean));
    } catch (err) {
      console.error('Failed to fetch recently viewed:', err);
    } finally {
      setLoadingRecentlyViewed(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchAddresses();
    fetchWishlist();
    fetchRecentlyViewed();
  }, [fetchOrders, fetchAddresses, fetchWishlist, fetchRecentlyViewed]);

  const handleLogout = () => {
    logout();
    success('Logged out successfully');
    navigate('/');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case 'DELIVERED': return 'bg-green-100 text-green-700';
      case 'SHIPPED': return 'bg-blue-100 text-blue-700';
      case 'PROCESSING': case 'PAID': case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <UserHeader 
          user={user} 
          onLogout={handleLogout}
          onEditProfile={() => setActiveTab('personal')}
        />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="w-full flex flex-wrap justify-start gap-1 bg-white/50 p-2 rounded-xl h-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-overview">
              <User className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-personal">
              <Edit2 className="w-4 h-4" /> Personal Info
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-addresses">
              <MapPin className="w-4 h-4" /> Addresses
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-orders">
              <Package className="w-4 h-4" /> Orders
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-wishlist">
              <Heart className="w-4 h-4" /> Wishlist
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-recent">
              <Clock className="w-4 h-4" /> Recently Viewed
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-security">
              <Shield className="w-4 h-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="tab-support">
              <HelpCircle className="w-4 h-4" /> Support
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview">
              <OverviewTab 
                user={user}
                orders={orders}
                addresses={addresses}
                wishlist={wishlist}
                loadingOrders={loadingOrders}
                onViewOrders={() => setActiveTab('orders')}
                onViewAddresses={() => setActiveTab('addresses')}
                onViewWishlist={() => setActiveTab('wishlist')}
              />
            </TabsContent>

            <TabsContent value="personal">
              <PersonalInfoTab 
                user={user}
                onSuccess={() => {
                  if (refreshUser) refreshUser();
                  success('Profile updated successfully');
                }}
                onError={(msg) => error(msg)}
              />
            </TabsContent>

            <TabsContent value="addresses">
              <AddressesTab 
                addresses={addresses}
                loading={loadingAddresses}
                onRefresh={fetchAddresses}
                onSuccess={(msg) => success(msg)}
                onError={(msg) => error(msg)}
              />
            </TabsContent>

            <TabsContent value="orders">
              <OrdersTab 
                orders={orders}
                loading={loadingOrders}
                onViewDetails={(order) => {
                  setSelectedOrder(order);
                  setOrderDetailOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="wishlist">
              <WishlistTab 
                wishlist={wishlist}
                loading={loadingWishlist}
                onRefresh={fetchWishlist}
                onAddToCart={async (product) => {
                  try {
                    await addItem(product, 1);
                    success('Added to cart');
                  } catch (err) {
                    error('Failed to add to cart');
                  }
                }}
                onRemove={async (productId) => {
                  try {
                    await wishlistAPI.remove(productId);
                    fetchWishlist();
                    success('Removed from wishlist');
                  } catch (err) {
                    error('Failed to remove from wishlist');
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="recent">
              <RecentlyViewedTab 
                products={recentlyViewed}
                loading={loadingRecentlyViewed}
              />
            </TabsContent>

            <TabsContent value="security">
              <SecurityTab 
                user={user}
                onSuccess={(msg) => success(msg)}
                onError={(msg) => error(msg)}
              />
            </TabsContent>

            <TabsContent value="support">
              <SupportTab />
            </TabsContent>
          </div>
        </Tabs>

        <OrderDetailDialog 
          order={selectedOrder}
          open={orderDetailOpen}
          onClose={() => {
            setOrderDetailOpen(false);
            setSelectedOrder(null);
          }}
        />
      </div>
    </div>
  );
};

const UserHeader = ({ user, onLogout, onEditProfile }) => {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-white text-xl font-bold" data-testid="avatar-initials">
              {getInitials(user?.name)}
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-brand-primary" data-testid="text-user-name">
                {user?.name || 'User'}
              </h1>
              <p className="text-brand-text/60 flex items-center gap-2" data-testid="text-user-email">
                <Mail className="w-4 h-4" /> {user?.email}
              </p>
              {user?.phone && (
                <p className="text-brand-text/60 flex items-center gap-2" data-testid="text-user-phone">
                  <Phone className="w-4 h-4" /> {user.phone}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize px-3 py-1" data-testid="text-user-role">
              {user?.role?.toLowerCase() || 'customer'}
            </Badge>
            <Button variant="outline" size="sm" onClick={onEditProfile} className="gap-2" data-testid="button-edit-profile">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </Button>
            <Button variant="destructive" size="sm" onClick={onLogout} className="gap-2" data-testid="button-logout">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const OverviewTab = ({ user, orders, addresses, wishlist, loadingOrders, onViewOrders, onViewAddresses, onViewWishlist }) => {
  const recentOrders = orders.slice(0, 3);
  const defaultAddress = addresses.find(a => a.isDefault);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-primary" /> Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <div className="py-4"><Loader message="Loading..." /></div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex justify-between items-center py-2 border-b border-brand-primary/5 last:border-0">
                  <div>
                    <p className="font-medium text-sm">Order #{order.id?.slice(-8)}</p>
                    <p className="text-xs text-brand-text/60">{order.items?.length || 0} items</p>
                  </div>
                  <Badge className={`text-xs ${order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {order.status}
                  </Badge>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={onViewOrders} className="w-full mt-2 gap-2" data-testid="button-view-all-orders">
                View all orders <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-brand-text/50">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No orders yet</p>
              <Link to="/shop">
                <Button variant="outline" size="sm" className="mt-2" data-testid="button-browse-shop">Browse outfits</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-primary" /> Default Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          {defaultAddress ? (
            <div className="space-y-1">
              <p className="font-medium">{defaultAddress.name}</p>
              <p className="text-sm text-brand-text/60">{defaultAddress.phone}</p>
              <p className="text-sm text-brand-text/60">{defaultAddress.addressLine}</p>
              <p className="text-sm text-brand-text/60">{defaultAddress.city}, {defaultAddress.state} {defaultAddress.pinCode}</p>
              <Button variant="ghost" size="sm" onClick={onViewAddresses} className="w-full mt-3 gap-2" data-testid="button-manage-addresses">
                Manage addresses <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-brand-text/50">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No address saved</p>
              <Button variant="outline" size="sm" onClick={onViewAddresses} className="mt-2" data-testid="button-add-address">Add address</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-brand-primary" /> Wishlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wishlist.length > 0 ? (
            <div>
              <div className="flex -space-x-2">
                {wishlist.slice(0, 4).map((item) => (
                  <img 
                    key={item.id} 
                    src={item.product?.imageUrl} 
                    alt={item.product?.name}
                    className="w-10 h-10 rounded-full border-2 border-white object-cover"
                  />
                ))}
                {wishlist.length > 4 && (
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 border-2 border-white flex items-center justify-center text-xs font-medium">
                    +{wishlist.length - 4}
                  </div>
                )}
              </div>
              <p className="text-sm text-brand-text/60 mt-2">{wishlist.length} items saved</p>
              <Button variant="ghost" size="sm" onClick={onViewWishlist} className="w-full mt-2 gap-2" data-testid="button-view-wishlist">
                View wishlist <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-brand-text/50">
              <Heart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Wishlist empty</p>
              <Link to="/shop">
                <Button variant="outline" size="sm" className="mt-2" data-testid="button-browse-wishlist">Browse outfits</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PersonalInfoTab = ({ user, onSuccess, onError }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      phone: user?.phone || ''
    });
  }, [user]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await userAPI.updateProfile(formData);
      setEditing(false);
      onSuccess();
    } catch (err) {
      onError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Personal Information</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2" data-testid="button-edit-personal">
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              {editing ? (
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="mt-1"
                  data-testid="input-name"
                />
              ) : (
                <p className="mt-1 text-brand-text" data-testid="text-name">{user?.name || '-'}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <p className="mt-1 text-brand-text/60" data-testid="text-email">{user?.email}</p>
              <p className="text-xs text-brand-text/40">Email cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              {editing ? (
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Enter phone number"
                  className="mt-1"
                  data-testid="input-phone"
                />
              ) : (
                <p className="mt-1 text-brand-text" data-testid="text-phone">{user?.phone || 'Not provided'}</p>
              )}
            </div>
            <div>
              <Label>Member Since</Label>
              <p className="mt-1 text-brand-text" data-testid="text-member-since">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </p>
            </div>
          </div>
          
          {editing && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={loading} className="gap-2" data-testid="button-save-profile">
                {loading ? <Loader /> : <Check className="w-4 h-4" />} Save Changes
              </Button>
              <Button variant="outline" onClick={() => {
                setEditing(false);
                setFormData({ name: user?.name || '', phone: user?.phone || '' });
              }} data-testid="button-cancel-edit">
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ChangePasswordCard onSuccess={onSuccess} onError={onError} />
    </div>
  );
};

const ChangePasswordCard = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      onError('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      onError('New password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await authAPI.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onSuccess('Password changed successfully');
    } catch (err) {
      onError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" /> Change Password
        </CardTitle>
        <CardDescription>Update your password to keep your account secure</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input 
              id="currentPassword" 
              type="password" 
              value={formData.currentPassword}
              onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
              className="mt-1"
              required
              data-testid="input-current-password"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input 
              id="newPassword" 
              type="password" 
              value={formData.newPassword}
              onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
              className="mt-1"
              required
              data-testid="input-new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input 
              id="confirmPassword" 
              type="password" 
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="mt-1"
              required
              data-testid="input-confirm-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="gap-2" data-testid="button-change-password">
            {loading ? <Loader /> : <Lock className="w-4 h-4" />} Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const AddressesTab = ({ addresses, loading, onRefresh, onSuccess, onError }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    addressLine: '',
    city: '',
    state: '',
    pinCode: '',
    isDefault: false
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      addressLine: '',
      city: '',
      state: '',
      pinCode: '',
      isDefault: false
    });
    setEditingAddress(null);
  };

  const handleEdit = (address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      phone: address.phone,
      addressLine: address.addressLine,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      isDefault: address.isDefault
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingAddress) {
        await addressesAPI.update(editingAddress.id, formData);
        onSuccess('Address updated successfully');
      } else {
        await addressesAPI.create(formData);
        onSuccess('Address added successfully');
      }
      setDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      await addressesAPI.delete(id);
      onSuccess('Address deleted successfully');
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to delete address');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await addressesAPI.setDefault(id);
      onSuccess('Default address updated');
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to set default address');
    }
  };

  if (loading) {
    return <Loader message="Loading addresses..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif font-bold text-brand-primary">Your Addresses</h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2" data-testid="button-add-new-address">
          <Plus className="w-4 h-4" /> Add New Address
        </Button>
      </div>

      {addresses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <Card key={address.id} className={`bg-white/70 backdrop-blur-sm ${address.isDefault ? 'border-brand-primary' : 'border-brand-primary/10'}`} data-testid={`address-card-${address.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{address.name}</p>
                      {address.isDefault && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-default">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-brand-text/60">{address.phone}</p>
                    <p className="text-sm text-brand-text/60">{address.addressLine}</p>
                    <p className="text-sm text-brand-text/60">{address.city}, {address.state} {address.pinCode}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(address)} className="gap-1" data-testid={`button-edit-address-${address.id}`}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(address.id)} className="gap-1 text-red-600 hover:text-red-700" data-testid={`button-delete-address-${address.id}`}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                  {!address.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(address.id)} className="gap-1" data-testid={`button-set-default-${address.id}`}>
                      <Star className="w-3 h-3" /> Set Default
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-brand-text/30" />
            <p className="text-brand-text/60">You haven't added any addresses yet.</p>
            <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2" data-testid="button-add-first-address">
              <Plus className="w-4 h-4" /> Add Your First Address
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addr-name">Full Name</Label>
              <Input id="addr-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1" data-testid="input-address-name" />
            </div>
            <div>
              <Label htmlFor="addr-phone">Phone</Label>
              <Input id="addr-phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="mt-1" data-testid="input-address-phone" />
            </div>
            <div>
              <Label htmlFor="addr-line">Address Line</Label>
              <Input id="addr-line" value={formData.addressLine} onChange={(e) => setFormData({...formData, addressLine: e.target.value})} className="mt-1" data-testid="input-address-line" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addr-city">City</Label>
                <Input id="addr-city" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="mt-1" data-testid="input-address-city" />
              </div>
              <div>
                <Label htmlFor="addr-state">State</Label>
                <Input id="addr-state" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} className="mt-1" data-testid="input-address-state" />
              </div>
            </div>
            <div>
              <Label htmlFor="addr-pin">PIN Code</Label>
              <Input id="addr-pin" value={formData.pinCode} onChange={(e) => setFormData({...formData, pinCode: e.target.value})} className="mt-1" data-testid="input-address-pin" />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="addr-default" 
                checked={formData.isDefault} 
                onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                className="rounded"
                data-testid="checkbox-address-default"
              />
              <Label htmlFor="addr-default">Set as default address</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }} data-testid="button-cancel-address">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-address">
              {saving ? <Loader /> : 'Save Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const OrdersTab = ({ orders, loading, onViewDetails }) => {
  const { formatPrice } = useCurrency();
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case 'DELIVERED': return 'bg-green-100 text-green-700';
      case 'SHIPPED': return 'bg-blue-100 text-blue-700';
      case 'PROCESSING': case 'PAID': case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <Loader message="Loading orders..." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-serif font-bold text-brand-primary">Order History</h2>
      
      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="bg-white/70 backdrop-blur-sm border-brand-primary/10" data-testid={`order-card-${order.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-brand-primary">Order #{order.id?.slice(-8)}</p>
                      <Badge className={`text-xs ${getStatusColor(order.status)}`}>{order.status}</Badge>
                    </div>
                    <p className="text-sm text-brand-text/60">{formatDate(order.createdAt)}</p>
                    <p className="text-sm text-brand-text/60">{order.items?.length || 0} items</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-lg text-brand-primary">{formatPrice(order.totalAmount)}</p>
                    <Button variant="outline" size="sm" onClick={() => onViewDetails(order)} className="gap-2" data-testid={`button-view-order-${order.id}`}>
                      <Eye className="w-4 h-4" /> View Details
                    </Button>
                  </div>
                </div>
                
                {order.items && order.items.length > 0 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto">
                    {order.items.slice(0, 4).map((item) => (
                      <img 
                        key={item.id} 
                        src={item.product?.imageUrl} 
                        alt={item.product?.name}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-14 h-14 rounded-lg bg-brand-primary/10 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-brand-text/30" />
            <p className="text-brand-text/60">You haven't placed any orders yet.</p>
            <Link to="/shop">
              <Button className="mt-4 gap-2" data-testid="button-browse-outfits">
                <ShoppingCart className="w-4 h-4" /> Browse Outfits
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const OrderDetailDialog = ({ order, open, onClose }) => {
  const { formatPrice } = useCurrency();
  
  if (!order) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case 'DELIVERED': return 'bg-green-100 text-green-700';
      case 'SHIPPED': return 'bg-blue-100 text-blue-700';
      case 'PROCESSING': case 'PAID': case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Order #{order.id?.slice(-8)}
            <Badge className={`text-xs ${getStatusColor(order.status)}`}>{order.status}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-brand-text/60">Order Date</p>
              <p className="font-medium">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-brand-text/60">Payment Status</p>
              <p className="font-medium capitalize">{order.paymentStatus?.toLowerCase() || 'Pending'}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-3">Order Items</h3>
            <div className="space-y-3">
              {order.items?.map((item) => (
                <div key={item.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                  <img 
                    src={item.product?.imageUrl} 
                    alt={item.product?.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.product?.name}</p>
                    <p className="text-sm text-brand-text/60">Code: {item.product?.code}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm">Qty: {item.quantity}</p>
                      <p className="font-medium">{formatPrice(item.priceAtPurchase)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-3">Shipping Address</h3>
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">{order.shippingName}</p>
              <p>{order.shippingPhone}</p>
              <p>{order.shippingAddress}</p>
              <p>{order.shippingCity}, {order.shippingState} {order.shippingPinCode}</p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Amount</span>
            <span className="text-2xl font-bold text-brand-primary">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const WishlistTab = ({ wishlist, loading, onRefresh, onAddToCart, onRemove }) => {
  const navigate = useNavigate();

  if (loading) {
    return <Loader message="Loading wishlist..." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-serif font-bold text-brand-primary">Your Wishlist</h2>
      
      {wishlist.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.map((item) => (
            <Card key={item.id} className="bg-white/70 backdrop-blur-sm border-brand-primary/10 overflow-hidden group" data-testid={`wishlist-item-${item.product?.id}`}>
              <div className="relative aspect-square">
                <img 
                  src={item.product?.imageUrl} 
                  alt={item.product?.name}
                  className="w-full h-full object-cover"
                />
                <button 
                  onClick={() => onRemove(item.product?.id)}
                  className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                  data-testid={`button-remove-wishlist-${item.product?.id}`}
                >
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                </button>
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate">{item.product?.name}</p>
                <p className="text-xs text-brand-text/60">{item.product?.code}</p>
                <p className="font-bold text-brand-primary mt-1">{formatPrice(item.product?.price)}</p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={() => navigate(`/product/${item.product?.code}`)}
                    data-testid={`button-view-product-${item.product?.id}`}
                  >
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 text-xs gap-1"
                    onClick={() => onAddToCart(item.product)}
                    data-testid={`button-add-to-cart-${item.product?.id}`}
                  >
                    <ShoppingCart className="w-3 h-3" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardContent className="py-12 text-center">
            <Heart className="w-12 h-12 mx-auto mb-4 text-brand-text/30" />
            <p className="text-brand-text/60">You haven't added any outfits to your wishlist yet.</p>
            <Link to="/shop">
              <Button className="mt-4 gap-2" data-testid="button-browse-for-wishlist">
                Browse Outfits
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const RecentlyViewedTab = ({ products, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return <Loader message="Loading recently viewed..." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-serif font-bold text-brand-primary">Recently Viewed</h2>
      
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map((product) => (
            <Card 
              key={product.id} 
              className="bg-white/70 backdrop-blur-sm border-brand-primary/10 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/product/${product.code}`)}
              data-testid={`recent-product-${product.id}`}
            >
              <div className="aspect-square">
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-xs text-brand-text/60">{product.code}</p>
                <p className="font-bold text-brand-primary mt-1">{formatPrice(product.price)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-brand-text/30" />
            <p className="text-brand-text/60">You haven't viewed any outfits yet.</p>
            <Link to="/shop">
              <Button className="mt-4 gap-2" data-testid="button-browse-recently-viewed">
                Browse Outfits
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const SecurityTab = ({ user, onSuccess, onError }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-serif font-bold text-brand-primary">Account Security</h2>
      
      <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> Security Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-brand-text/60">Account Created</p>
              <p className="font-medium" data-testid="text-account-created">{formatDate(user?.createdAt)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-brand-text/60">Last Password Change</p>
              <p className="font-medium" data-testid="text-last-password-change">{formatDate(user?.lastPasswordChange)}</p>
            </div>
          </div>
          
          <div className="p-4 bg-amber-50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Security Tip</p>
              <p className="text-sm text-amber-700">If you notice unusual activity on your account, change your password immediately and contact our support team.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordCard onSuccess={onSuccess} onError={onError} />
    </div>
  );
};

const SupportTab = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-serif font-bold text-brand-primary">Help & Support</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" /> Contact Support
            </CardTitle>
            <CardDescription>Get help with your orders or account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/contact')} className="w-full gap-2" data-testid="button-contact-support">
              <Mail className="w-4 h-4" /> Contact Us
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Returns & Refunds
            </CardTitle>
            <CardDescription>Learn about our return policy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-brand-text/70 space-y-2">
              <p>We accept returns within 30 days of purchase for most items in their original condition.</p>
              <p>Refunds are processed within 5-7 business days after we receive the returned item.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" /> Size Guide
            </CardTitle>
            <CardDescription>Find your perfect fit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-brand-text/70 space-y-2">
              <p>Check our detailed size chart to find your perfect size before ordering.</p>
              <p>If you're between sizes, we recommend going for the larger size for comfort.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-brand-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" /> FAQ
            </CardTitle>
            <CardDescription>Frequently asked questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-brand-text/70 space-y-2">
              <p><strong>How long does shipping take?</strong><br />Standard shipping takes 5-7 business days.</p>
              <p><strong>Can I modify my order?</strong><br />Contact us within 24 hours of placing your order.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
