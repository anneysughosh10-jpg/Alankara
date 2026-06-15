import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shopkeeper Screens
import DashboardScreen from '../screens/shopkeeper/DashboardScreen';
import POSScreen from '../screens/shopkeeper/POSScreen';
import InventoryScreen from '../screens/shopkeeper/InventoryScreen';
import ReturnsScreen from '../screens/shopkeeper/ReturnsScreen';

// Admin Screens
import AdminDashboard from '../screens/admin/AdminDashboard';
import ShopManagement from '../screens/admin/ShopManagement';
import WarehouseScreen from '../screens/admin/WarehouseScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import UserManagement from '../screens/admin/UserManagement';

// Super Admin Screens
import ProductMasterScreen from '../screens/superadmin/ProductMasterScreen';

const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused, label }) => (
  <View style={styles.tabItem}>
    <Ionicons
      name={name}
      size={22}
      color={focused ? COLORS.primary : COLORS.textLight}
    />
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
      {label}
    </Text>
  </View>
);

export default function AppNavigator({ userRole, userId, userData }) {
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';
  const insets = useSafeAreaInsets();

  const tabBarOptions = {
    headerShown: false,
    tabBarStyle: {
      ...styles.tabBar,
      height: 65 + insets.bottom,
      paddingBottom: 8 + insets.bottom,
    },
    tabBarShowLabel: false,
  };

  if (isAdmin) {
    return (
      <Tab.Navigator screenOptions={tabBarOptions}>
        <Tab.Screen
          name="Dashboard"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} label="Dashboard" /> }}
        >
          {props => <AdminDashboard {...props} userId={userId} userData={userData} userRole={userRole} />}
        </Tab.Screen>

        <Tab.Screen
          name="Warehouse"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cube' : 'cube-outline'} focused={focused} label="Warehouse" /> }}
        >
          {props => <WarehouseScreen {...props} userId={userId} userData={userData} userRole={userRole} />}
        </Tab.Screen>

        <Tab.Screen
          name="Shops"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'storefront' : 'storefront-outline'} focused={focused} label="Shops" /> }}
        >
          {props => <ShopManagement {...props} userId={userId} userData={userData} />}
        </Tab.Screen>

        {isSuperAdmin && (
          <Tab.Screen
            name="Products"
            options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'pricetag' : 'pricetag-outline'} focused={focused} label="Products" /> }}
          >
            {props => <ProductMasterScreen {...props} userId={userId} userData={userData} />}
          </Tab.Screen>
        )}

        <Tab.Screen
          name="Reports"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} label="Reports" /> }}
        >
          {props => <ReportsScreen {...props} userId={userId} userData={userData} />}
        </Tab.Screen>

        <Tab.Screen
          name="Users"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} label="Users" /> }}
        >
          {props => <UserManagement {...props} userId={userId} userData={userData} userRole={userRole} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={tabBarOptions}>
      <Tab.Screen
        name="Dashboard"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} label="Home" /> }}
      >
        {props => <DashboardScreen {...props} userId={userId} userData={userData} />}
      </Tab.Screen>

      <Tab.Screen
        name="POS"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'scan' : 'scan-outline'} focused={focused} label="POS" /> }}
      >
        {props => <POSScreen {...props} userId={userId} userData={userData} />}
      </Tab.Screen>

      <Tab.Screen
        name="Inventory"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} label="Stock" /> }}
      >
        {props => <InventoryScreen {...props} userId={userId} userData={userData} />}
      </Tab.Screen>

      <Tab.Screen
        name="Returns"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'refresh-circle' : 'refresh-circle-outline'} focused={focused} label="Returns" /> }}
      >
        {props => <ReturnsScreen {...props} userId={userId} userData={userData} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 65,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
