import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Alert, Image
} from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { COLORS, COMPANY, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminDashboard({ userId, userData, userRole }) {
  const [shops, setShops] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSales: 0, todaySales: 0, totalOrders: 0, totalShops: 0, pendingReturns: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [expandedShop, setExpandedShop] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'shopkeeper')));
      const shopUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let totalSales = 0, todaySales = 0, totalOrders = 0;
      const shopDataList = [];

      for (const shop of shopUsers) {
        const salesSnap = await getDocs(query(collection(db, 'sales'), where('shopId', '==', shop.shopId)));
        const invSnap = await getDocs(query(collection(db, 'inventory'), where('shopId', '==', shop.shopId)));

        let shopSales = 0, shopTodaySales = 0, shopOrders = 0;
        const todayItems = [];

        salesSnap.forEach(d => {
          const sale = d.data();
          const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
          const amount = sale.totalAmount || 0;
          shopSales += amount;
          shopOrders++;
          totalOrders++;
          if (saleDate >= todayStart) {
            shopTodaySales += amount;
            todaySales += amount;
            todayItems.push(sale);
          }
        });

        totalSales += shopSales;

        const inventory = invSnap.docs.map(d => d.data());
        const lowStock = inventory.filter(i => i.quantity <= (i.minStock || 5) && i.quantity > 0);
        const outOfStock = inventory.filter(i => i.quantity <= 0);

        shopDataList.push({
          ...shop,
          totalSales: shopSales,
          todaySales: shopTodaySales,
          orders: shopOrders,
          todayItems,
          inventory,
          lowStock,
          outOfStock
        });
      }

      const returnsSnap = await getDocs(query(collection(db, 'returns'), where('status', '==', 'pending')));

      shopDataList.sort((a, b) => (a.shopId || '').localeCompare(b.shopId || ''));
      setShops(shopDataList);
      setGlobalStats({
        totalSales, todaySales, totalOrders,
        totalShops: shopDataList.length,
        pendingReturns: returnsSnap.size
      });
    } catch (e) { console.log('Admin dashboard error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) }
    ]);
  };

  const StatCard = ({ label, value, icon, color, bg }) => (
    <View style={[styles.statCard, { backgroundColor: bg || COLORS.white }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoSmall} />
          <View>
            <Text style={styles.headerTitle}>
              {userRole === 'superadmin' ? 'Super Admin' : 'Admin'} Dashboard
            </Text>
            <Text style={styles.headerSub}>GSTIN: {COMPANY.gstin}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Global Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total Shops" value={globalStats.totalShops} icon="storefront-outline" color={COLORS.primary} />
            <StatCard label="Today's Sales" value={`₹${globalStats.todaySales.toLocaleString('en-IN')}`} icon="today-outline" color={COLORS.success} />
            <StatCard label="Total Sales" value={`₹${globalStats.totalSales.toLocaleString('en-IN')}`} icon="trending-up-outline" color={COLORS.accent} />
            <StatCard label="Pending Returns" value={globalStats.pendingReturns} icon="refresh-circle-outline" color={globalStats.pendingReturns > 0 ? COLORS.warning : COLORS.textLight} />
          </View>
        </View>

        {/* Shops List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Shops ({shops.length})</Text>
          {shops.map((shop) => (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopCard}
              onPress={() => setExpandedShop(expandedShop === shop.id ? null : shop.id)}
            >
              <View style={styles.shopHeader}>
                <View style={styles.shopIdBadge}>
                  <Text style={styles.shopIdText}>{shop.shopId}</Text>
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{shop.shopName}</Text>
                  <Text style={styles.shopCity}>{shop.city || 'Hyderabad'}</Text>
                </View>
                <View style={styles.shopRight}>
                  <Text style={styles.shopSales}>₹{shop.todaySales.toLocaleString('en-IN')}</Text>
                  <Text style={styles.shopSalesLabel}>Today</Text>
                </View>
                <Ionicons
                  name={expandedShop === shop.id ? 'chevron-up' : 'chevron-down'}
                  size={18} color={COLORS.textLight}
                />
              </View>

              {expandedShop === shop.id && (
                <View style={styles.shopExpanded}>
                  <View style={styles.shopStatsRow}>
                    <View style={styles.shopStat}>
                      <Text style={styles.shopStatValue}>₹{shop.totalSales.toLocaleString('en-IN')}</Text>
                      <Text style={styles.shopStatLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.shopStat}>
                      <Text style={styles.shopStatValue}>{shop.orders}</Text>
                      <Text style={styles.shopStatLabel}>Orders</Text>
                    </View>
                    <View style={styles.shopStat}>
                      <Text style={styles.shopStatValue}>{shop.inventory?.length || 0}</Text>
                      <Text style={styles.shopStatLabel}>Products</Text>
                    </View>
                    <View style={styles.shopStat}>
                      <Text style={[styles.shopStatValue, shop.lowStock?.length > 0 && { color: COLORS.warning }]}>
                        {shop.lowStock?.length || 0}
                      </Text>
                      <Text style={styles.shopStatLabel}>Low Stock</Text>
                    </View>
                  </View>

                  {shop.todayItems?.length > 0 && (
                    <View style={styles.todaySection}>
                      <Text style={styles.todaySectionTitle}>Today's Sales</Text>
                      {shop.todayItems.slice(0, 3).map((sale, i) => (
                        <View key={i} style={styles.todaySale}>
                          <Text style={styles.todaySaleInvoice}>{sale.invoiceNumber}</Text>
                          <Text style={styles.todaySaleAmount}>₹{(sale.totalAmount || 0).toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {shop.lowStock?.length > 0 && (
                    <View style={styles.lowStockSection}>
                      <Text style={styles.lowStockTitle}>Low Stock Items</Text>
                      {shop.lowStock.slice(0, 3).map((item, i) => (
                        <Text key={i} style={styles.lowStockItem}>
                          • {item.productName} — {item.quantity} left
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoSmall: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', borderRadius: 12, padding: 14, ...SHADOWS.small },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 17, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  shopCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.small },
  shopHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopIdBadge: { backgroundColor: '#FDF0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  shopIdText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  shopCity: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  shopRight: { alignItems: 'flex-end', marginRight: 4 },
  shopSales: { fontSize: 14, fontWeight: 'bold', color: COLORS.success },
  shopSalesLabel: { fontSize: 10, color: COLORS.textLight },
  shopExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  shopStatsRow: { flexDirection: 'row', marginBottom: 12 },
  shopStat: { flex: 1, alignItems: 'center' },
  shopStatValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  shopStatLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  todaySection: { marginBottom: 10 },
  todaySectionTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  todaySale: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  todaySaleInvoice: { fontSize: 12, color: COLORS.primary },
  todaySaleAmount: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  lowStockSection: { backgroundColor: COLORS.warningLight, borderRadius: 8, padding: 10 },
  lowStockTitle: { fontSize: 12, fontWeight: '600', color: COLORS.warning, marginBottom: 6 },
  lowStockItem: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 3 }
});
