import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, RefreshControl
} from 'react-native';
import {
  collection, query, where, getDocs,
  updateDoc, doc, serverTimestamp, addDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function InventoryScreen({ userId, userData }) {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const shopId = userData?.shopId;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFiltered(q ? products.filter(p =>
      p.productName?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    ) : products);
  }, [search, products]);

  const loadData = async () => {
    try {
      const invSnap = await getDocs(query(collection(db, 'inventory'), where('shopId', '==', shopId)));
      const items = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.productName || '').localeCompare(b.productName || ''));
      setProducts(items);
      setFiltered(items);

      const tSnap = await getDocs(query(
        collection(db, 'stockTransfers'),
        where('shopId', '==', shopId),
        where('status', '==', 'pending')
      ));
      setPendingTransfers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('Inventory load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const acceptTransfer = async (transfer) => {
    Alert.alert(
      'Accept Transfer',
      `Accept ${transfer.items?.length} product transfer from warehouse?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept', onPress: async () => {
            try {
              for (const item of transfer.items || []) {
                const invSnap = await getDocs(query(
                  collection(db, 'inventory'),
                  where('productId', '==', item.productId),
                  where('shopId', '==', shopId)
                ));
                if (!invSnap.empty) {
                  const inv = invSnap.docs[0];
                  await updateDoc(doc(db, 'inventory', inv.id), {
                    quantity: (inv.data().quantity || 0) + item.quantity,
                    updatedAt: serverTimestamp()
                  });
                } else {
                  await addDoc(collection(db, 'inventory'), {
                    ...item, shopId, quantity: item.quantity,
                    createdAt: serverTimestamp()
                  });
                }
              }
              await updateDoc(doc(db, 'stockTransfers', transfer.id), {
                status: 'accepted', acceptedAt: serverTimestamp()
              });
              Alert.alert('Success', 'Stock transfer accepted!');
              loadData();
            } catch (e) { Alert.alert('Error', 'Failed to accept transfer.'); }
          }
        }
      ]
    );
  };

  const rejectTransfer = async (transfer) => {
    Alert.alert('Reject Transfer', 'Reject this stock transfer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: async () => {
          try {
            await updateDoc(doc(db, 'stockTransfers', transfer.id), {
              status: 'rejected', rejectedAt: serverTimestamp()
            });
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed to reject transfer.'); }
        }
      }
    ]);
  };

  const getStockStatus = (qty, min) => {
    if (qty <= 0) return { label: 'Out of Stock', color: COLORS.error, bg: COLORS.errorLight };
    if (qty <= (min || 5)) return { label: 'Low Stock', color: COLORS.warning, bg: COLORS.warningLight };
    return { label: 'In Stock', color: COLORS.success, bg: COLORS.successLight };
  };

  const StockItem = ({ item }) => {
    const status = getStockStatus(item.quantity, item.minStock);
    return (
      <View style={styles.productCard}>
        <View style={styles.productLeft}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.productName}</Text>
            <Text style={styles.productCategory}>{item.category}</Text>
            {item.barcode ? <Text style={styles.productBarcode}>Barcode: {item.barcode}</Text> : null}
          </View>
        </View>
        <View style={styles.productRight}>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          <Text style={styles.productQty}>{item.quantity} units</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerShop}>{userData?.shopName} · {products.length} products</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stock' && styles.tabActive]}
          onPress={() => setActiveTab('stock')}
        >
          <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transfers' && styles.tabActive]}
          onPress={() => setActiveTab('transfers')}
        >
          <Text style={[styles.tabText, activeTab === 'transfers' && styles.tabTextActive]}>
            Transfers {pendingTransfers.length > 0 ? `(${pendingTransfers.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stock' ? (
        <>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{products.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.success }]}>
                {products.filter(p => p.quantity > (p.minStock || 5)).length}
              </Text>
              <Text style={styles.summaryLabel}>In Stock</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.warning }]}>
                {products.filter(p => p.quantity > 0 && p.quantity <= (p.minStock || 5)).length}
              </Text>
              <Text style={styles.summaryLabel}>Low Stock</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.error }]}>
                {products.filter(p => p.quantity <= 0).length}
              </Text>
              <Text style={styles.summaryLabel}>Out</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={COLORS.textLight}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            renderItem={({ item }) => <StockItem item={item} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="layers-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>No products in inventory</Text>
                <Text style={styles.emptySub}>Accept a stock transfer to add products</Text>
              </View>
            }
          />
        </>
      ) : (
        <FlatList
          data={pendingTransfers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={styles.transferCard}>
              <View style={styles.transferHeader}>
                <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferTitle}>Stock Transfer from Warehouse</Text>
                  <Text style={styles.transferDate}>
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-IN') : 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.transferItems}>
                {(item.items || []).slice(0, 3).map((p, i) => (
                  <Text key={i} style={styles.transferItem}>
                    • {p.productName} — {p.quantity} units
                  </Text>
                ))}
                {(item.items || []).length > 3 && (
                  <Text style={styles.transferMore}>+{item.items.length - 3} more items</Text>
                )}
              </View>
              <View style={styles.transferBtns}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptTransfer(item)}>
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectTransfer(item)}>
                  <Ionicons name="close" size={16} color={COLORS.error} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>No pending transfers</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  headerShop: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  summaryItem: { flex: 1, padding: 12, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  summaryLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, gap: 8
  },
  searchInput: { flex: 1, padding: 10, fontSize: 14, color: COLORS.text },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  productCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 10, padding: 14,
    marginBottom: 8, ...SHADOWS.small
  },
  productLeft: { flex: 1 },
  productInfo: {},
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  productCategory: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  productBarcode: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  productRight: { alignItems: 'flex-end', gap: 4 },
  productPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
  productQty: { fontSize: 12, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
  transferCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    marginBottom: 10, ...SHADOWS.small, borderLeftWidth: 4, borderLeftColor: COLORS.primary
  },
  transferHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  transferInfo: {},
  transferTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  transferDate: { fontSize: 12, color: COLORS.textLight },
  transferItems: { marginBottom: 12 },
  transferItem: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  transferMore: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },
  transferBtns: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, padding: 10, borderRadius: 8, gap: 6
  },
  acceptBtnText: { color: COLORS.white, fontWeight: '600' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.errorLight, padding: 10, borderRadius: 8, gap: 6
  },
  rejectBtnText: { color: COLORS.error, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500', marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.textLight, marginTop: 4, textAlign: 'center' }
});
