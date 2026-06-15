import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar, Alert, Image
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { COLORS, COMPANY, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen({ userId, userData }) {
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, year: 0, todayOrders: 0, totalOrders: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const shopId = userData?.shopId;
      if (!shopId) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now - 7 * 86400000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const salesSnap = await getDocs(query(collection(db, 'sales'), where('shopId', '==', shopId)));
      let todaySales = 0, weekSales = 0, monthSales = 0, yearSales = 0, todayOrders = 0, totalOrders = 0;
      const recent = [];

      salesSnap.forEach(d => {
        const sale = d.data();
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const amount = sale.totalAmount || 0;
        totalOrders++;
        if (saleDate >= yearStart) yearSales += amount;
        if (saleDate >= monthStart) monthSales += amount;
        if (saleDate >= weekStart) weekSales += amount;
        if (saleDate >= todayStart) {
          todaySales += amount;
          todayOrders++;
          recent.push({ id: d.id, ...sale, saleDate });
        }
      });

      recent.sort((a, b) => b.saleDate - a.saleDate);
      setStats({ today: todaySales, week: weekSales, month: monthSales, year: yearSales, todayOrders, totalOrders });
      setRecentSales(recent.slice(0, 5));

      const invSnap = await getDocs(query(collection(db, 'inventory'), where('shopId', '==', shopId)));
      const low = [];
      invSnap.forEach(d => {
        const item = { id: d.id, ...d.data() };
        if ((item.quantity || 0) <= (item.minStock || 5)) low.push(item);
      });
      setLowStock(low);

      const transferSnap = await getDocs(query(
        collection(db, 'stockTransfers'),
        where('shopId', '==', shopId),
        where('status', '==', 'pending')
      ));
      setPendingTransfers(transferSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) { console.log('Dashboard error:', e); }
  }, [userData]);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) }
    ]);
  };

  const StatCard = ({ label, value, icon, color }) => (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoSmall} />
          <View>
            <Text style={styles.shopName}>{userData?.shopName || 'My Shop'}</Text>
            <Text style={styles.shopMeta}>{userData?.shopId} · {userData?.city || 'Hyderabad'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending Transfer Alert */}
        {pendingTransfers.length > 0 && (
          <TouchableOpacity style={styles.alertBanner}>
            <Ionicons name="cube-outline" size={18} color={COLORS.white} />
            <Text style={styles.alertBannerText}>
              {pendingTransfers.length} stock transfer{pendingTransfers.length > 1 ? 's' : ''} pending your acceptance
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Today" value={`₹${stats.today.toLocaleString('en-IN')}`} icon="today-outline" color={COLORS.primary} />
            <StatCard label="This Week" value={`₹${stats.week.toLocaleString('en-IN')}`} icon="calendar-outline" color={COLORS.accent} />
            <StatCard label="This Month" value={`₹${stats.month.toLocaleString('en-IN')}`} icon="calendar-clear-outline" color={COLORS.info} />
            <StatCard label="This Year" value={`₹${stats.year.toLocaleString('en-IN')}`} icon="trending-up-outline" color={COLORS.success} />
          </View>
        </View>

        {/* Today Summary */}
        <View style={styles.section}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.todayOrders}</Text>
              <Text style={styles.summaryLabel}>Today's Orders</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.totalOrders}</Text>
              <Text style={styles.summaryLabel}>Total Orders</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, lowStock.length > 0 && { color: COLORS.warning }]}>
                {lowStock.length}
              </Text>
              <Text style={styles.summaryLabel}>Low Stock</Text>
            </View>
          </View>
        </View>

        {/* Low Stock Warning */}
        {lowStock.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Low Stock Items</Text>
            <View style={styles.warningCard}>
              {lowStock.slice(0, 5).map((item, i) => (
                <View key={i} style={styles.warningRow}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.warning} />
                  <Text style={styles.warningText}>{item.productName}</Text>
                  <Text style={styles.warningQty}>{item.quantity} left</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Sales */}
        {recentSales.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sales Today</Text>
            <View style={styles.card}>
              {recentSales.map((sale, i) => (
                <View key={i} style={[styles.saleRow, i < recentSales.length - 1 && styles.saleRowBorder]}>
                  <View>
                    <Text style={styles.invoiceNo}>{sale.invoiceNumber}</Text>
                    <Text style={styles.saleTime}>
                      {sale.saleDate?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.saleAmount}>₹{(sale.totalAmount || 0).toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>GSTIN: {COMPANY.gstin}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingHorizontal: 16,
    paddingTop: 50, paddingBottom: 16
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoSmall: { width: 40, height: 40, borderRadius: 10 },
  shopName: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  shopMeta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  logoutBtn: { padding: 8 },
  scroll: { flex: 1 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 12
  },
  alertBannerText: { flex: 1, color: COLORS.white, fontSize: 13, fontWeight: '500' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%', backgroundColor: COLORS.white, borderRadius: 12,
    padding: 16, borderTopWidth: 3, alignItems: 'flex-start',
    ...SHADOWS.small
  },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderRadius: 12, overflow: 'hidden', ...SHADOWS.small
  },
  summaryCard: { flex: 1, padding: 16, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderLight },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  summaryLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
  warningCard: {
    backgroundColor: COLORS.warningLight, borderRadius: 12,
    padding: 14, borderLeftWidth: 4, borderLeftColor: COLORS.warning
  },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningText: { flex: 1, fontSize: 13, color: COLORS.text },
  warningQty: { fontSize: 12, fontWeight: '600', color: COLORS.warning },
  card: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', ...SHADOWS.small },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  saleRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  invoiceNo: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  saleTime: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  saleAmount: { fontSize: 15, fontWeight: 'bold', color: COLORS.success },
  footer: { alignItems: 'center', padding: 20, marginTop: 8 },
  footerText: { fontSize: 11, color: COLORS.textLight }
});
