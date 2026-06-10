import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, ScrollView, RefreshControl
} from 'react-native';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, COMPANY, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function WarehouseScreen({ userData }) {
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [transfers, setTransfers] = useState([]);
  const [transferForm, setTransferForm] = useState({ shopId: '', items: [] });
  const [addForm, setAddForm] = useState({ productId: '', quantity: '', minStock: '10' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const stockSnap = await getDocs(query(collection(db, 'warehouseStock')));
      setWarehouseStock(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const shopsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'shopkeeper')));
      setShops(shopsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const productsSnap = await getDocs(collection(db, 'products'));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const transferSnap = await getDocs(collection(db, 'stockTransfers'));
      const t = transferSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      t.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTransfers(t.slice(0, 20));
    } catch (e) { console.log('Warehouse load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const addStockToWarehouse = async () => {
    if (!addForm.productId || !addForm.quantity) {
      Alert.alert('Required', 'Select product and enter quantity.');
      return;
    }
    try {
      const product = products.find(p => p.id === addForm.productId);
      const existing = warehouseStock.find(s => s.productId === addForm.productId);

      if (existing) {
        await updateDoc(doc(db, 'warehouseStock', existing.id), {
          quantity: existing.quantity + parseInt(addForm.quantity),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'warehouseStock'), {
          productId: addForm.productId,
          productName: product.productName,
          category: product.category,
          barcode: product.barcode || '',
          hsnCode: product.hsnCode || '6006',
          price: product.basePrice,
          quantity: parseInt(addForm.quantity),
          minStock: parseInt(addForm.minStock || '10'),
          createdAt: serverTimestamp()
        });
      }
      Alert.alert('Success', 'Stock added to warehouse.');
      setShowAddStock(false);
      setAddForm({ productId: '', quantity: '', minStock: '10' });
      loadData();
    } catch (e) { Alert.alert('Error', 'Failed to add stock.'); }
  };

  const initiateTransfer = async () => {
    if (!transferForm.shopId || transferForm.items.length === 0) {
      Alert.alert('Required', 'Select a shop and at least one product.');
      return;
    }
    try {
      const shop = shops.find(s => s.shopId === transferForm.shopId);
      await addDoc(collection(db, 'stockTransfers'), {
        shopId: transferForm.shopId,
        shopName: shop?.shopName || '',
        warehouseName: COMPANY.warehouse,
        items: transferForm.items,
        status: 'pending',
        createdBy: userData?.email || '',
        createdAt: serverTimestamp()
      });

      // Deduct from warehouse
      for (const item of transferForm.items) {
        const stock = warehouseStock.find(s => s.productId === item.productId);
        if (stock) {
          await updateDoc(doc(db, 'warehouseStock', stock.id), {
            quantity: Math.max(0, stock.quantity - item.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }

      Alert.alert('Transfer Initiated', `Stock transfer sent to ${shop?.shopName}. Shopkeeper must accept it.`);
      setShowTransfer(false);
      setTransferForm({ shopId: '', items: [] });
      loadData();
    } catch (e) { Alert.alert('Error', 'Failed to initiate transfer.'); }
  };

  const addTransferItem = (stockItem, qty) => {
    const exists = transferForm.items.find(i => i.productId === stockItem.productId);
    if (exists) {
      setTransferForm(prev => ({
        ...prev,
        items: prev.items.map(i => i.productId === stockItem.productId ? { ...i, quantity: qty } : i)
      }));
    } else {
      setTransferForm(prev => ({
        ...prev,
        items: [...prev.items, {
          productId: stockItem.productId,
          productName: stockItem.productName,
          category: stockItem.category,
          barcode: stockItem.barcode,
          hsnCode: stockItem.hsnCode,
          price: stockItem.price,
          quantity: qty
        }]
      }));
    }
  };

  const getStatusColor = (status) => {
    if (status === 'accepted') return { color: COLORS.success, bg: COLORS.successLight };
    if (status === 'rejected') return { color: COLORS.error, bg: COLORS.errorLight };
    return { color: COLORS.accent, bg: COLORS.warningLight };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Warehouse</Text>
          <Text style={styles.headerSub}>{COMPANY.warehouse}</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddStock(true)}>
            <Ionicons name="add" size={18} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.accent }]} onPress={() => setShowTransfer(true)}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'stock' && styles.tabActive]} onPress={() => setActiveTab('stock')}>
          <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>Stock ({warehouseStock.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'transfers' && styles.tabActive]} onPress={() => setActiveTab('transfers')}>
          <Text style={[styles.tabText, activeTab === 'transfers' && styles.tabTextActive]}>Transfers</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stock' ? (
        <FlatList
          data={warehouseStock}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={styles.stockCard}>
              <View style={styles.stockLeft}>
                <Text style={styles.stockName}>{item.productName}</Text>
                <Text style={styles.stockCategory}>{item.category}</Text>
              </View>
              <View style={styles.stockRight}>
                <Text style={styles.stockQty}>{item.quantity}</Text>
                <Text style={styles.stockQtyLabel}>units</Text>
                <Text style={styles.stockPrice}>₹{item.price}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>No stock in warehouse</Text>
              <Text style={styles.emptySub}>Tap + to add products</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={transfers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const status = getStatusColor(item.status);
            return (
              <View style={styles.transferCard}>
                <View style={styles.transferHeader}>
                  <View>
                    <Text style={styles.transferShop}>{item.shopName}</Text>
                    <Text style={styles.transferShopId}>{item.shopId}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{item.status?.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.transferItems}>{item.items?.length} products transferred</Text>
                <Text style={styles.transferDate}>
                  {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-IN') : ''}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* Add Stock Modal */}
      <Modal visible={showAddStock} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Add Stock to Warehouse</Text>
              <TouchableOpacity onPress={() => setShowAddStock(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Select Product</Text>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.productOption, addForm.productId === p.id && styles.productOptionActive]}
                  onPress={() => setAddForm(prev => ({ ...prev, productId: p.id }))}
                >
                  <Text style={[styles.productOptionText, addForm.productId === p.id && { color: COLORS.primary, fontWeight: '600' }]}>
                    {p.productName} — {p.category}
                  </Text>
                  {addForm.productId === p.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Quantity to Add</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter quantity"
              placeholderTextColor={COLORS.textLight}
              value={addForm.quantity}
              onChangeText={val => setAddForm(p => ({ ...p, quantity: val }))}
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>Minimum Stock Alert</Text>
            <TextInput
              style={styles.input}
              placeholder="10"
              placeholderTextColor={COLORS.textLight}
              value={addForm.minStock}
              onChangeText={val => setAddForm(p => ({ ...p, minStock: val }))}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={addStockToWarehouse}>
              <Text style={styles.saveBtnText}>Add to Warehouse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer Modal */}
      <Modal visible={showTransfer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Transfer Stock to Shop</Text>
              <TouchableOpacity onPress={() => setShowTransfer(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Shop</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {shops.map(shop => (
                  <TouchableOpacity
                    key={shop.id}
                    style={[styles.shopChip, transferForm.shopId === shop.shopId && styles.shopChipActive]}
                    onPress={() => setTransferForm(prev => ({ ...prev, shopId: shop.shopId }))}
                  >
                    <Text style={[styles.shopChipText, transferForm.shopId === shop.shopId && { color: COLORS.white }]}>
                      {shop.shopId}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Select Products & Quantities</Text>
              {warehouseStock.map(item => {
                const transferItem = transferForm.items.find(i => i.productId === item.productId);
                const qty = transferItem?.quantity || 0;
                return (
                  <View key={item.id} style={styles.transferItemRow}>
                    <View style={styles.transferItemInfo}>
                      <Text style={styles.transferItemName}>{item.productName}</Text>
                      <Text style={styles.transferItemStock}>Available: {item.quantity}</Text>
                    </View>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => qty > 0 && addTransferItem(item, qty - 1)}>
                        <Ionicons name="remove" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => qty < item.quantity && addTransferItem(item, qty + 1)}>
                        <Ionicons name="add" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.saveBtn} onPress={initiateTransfer}>
                <Text style={styles.saveBtnText}>Send Transfer Request</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  list: { padding: 16 },
  stockCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 8, ...SHADOWS.small
  },
  stockLeft: {},
  stockName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  stockCategory: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  stockRight: { alignItems: 'flex-end' },
  stockQty: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  stockQtyLabel: { fontSize: 11, color: COLORS.textLight },
  stockPrice: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  transferCard: { backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 8, ...SHADOWS.small },
  transferHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  transferShop: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  transferShopId: { fontSize: 12, color: COLORS.primary },
  transferItems: { fontSize: 13, color: COLORS.textSecondary },
  transferDate: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500', marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  productOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 4 },
  productOptionActive: { backgroundColor: '#FDF0F0' },
  productOptionText: { fontSize: 13, color: COLORS.text },
  shopChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  shopChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  shopChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  transferItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  transferItemInfo: { flex: 1 },
  transferItemName: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  transferItemStock: { fontSize: 11, color: COLORS.textLight },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, borderRadius: 8, padding: 6 },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 15, fontWeight: '600', color: COLORS.text, minWidth: 24, textAlign: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 }
});
