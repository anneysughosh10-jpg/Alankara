import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, RefreshControl
} from 'react-native';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, COMPANY, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReturnsScreen({ userId, userData }) {
  const [returns, setReturns] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [foundInvoice, setFoundInvoice] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const shopId = userData?.shopId;

  useEffect(() => { loadReturns(); }, []);

  const loadReturns = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'returns'), where('shopId', '==', shopId)));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReturns(items);
    } catch (e) { console.log('Returns load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadReturns(); setRefreshing(false); };

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) { Alert.alert('Enter invoice number'); return; }
    try {
      const snap = await getDocs(query(
        collection(db, 'sales'),
        where('invoiceNumber', '==', invoiceSearch.trim()),
        where('shopId', '==', shopId)
      ));
      if (snap.empty) { Alert.alert('Not Found', 'No invoice found with this number.'); return; }

      const sale = { id: snap.docs[0].id, ...snap.docs[0].data() };
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      const daysDiff = (Date.now() - saleDate.getTime()) / 86400000;

      if (daysDiff > COMPANY.returnDays) {
        Alert.alert('Return Period Expired', `Returns are only accepted within ${COMPANY.returnDays} days of purchase.`);
        return;
      }
      setFoundInvoice(sale);
      setSelectedItems([]);
    } catch (e) { Alert.alert('Error', 'Failed to search invoice.'); }
  };

  const toggleItem = (item) => {
    const exists = selectedItems.find(i => i.productId === item.productId);
    if (exists) setSelectedItems(selectedItems.filter(i => i.productId !== item.productId));
    else setSelectedItems([...selectedItems, item]);
  };

  const submitReturn = async () => {
    if (selectedItems.length === 0) { Alert.alert('Select items to return'); return; }
    if (!reason.trim()) { Alert.alert('Enter return reason'); return; }

    try {
      const returnData = {
        invoiceNumber: foundInvoice.invoiceNumber,
        originalSaleId: foundInvoice.id,
        shopId,
        shopName: userData?.shopName,
        items: selectedItems,
        reason: reason.trim(),
        status: 'pending',
        totalRefund: selectedItems.reduce((s, i) => s + i.amount, 0),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'returns'), returnData);

      // Add items back to inventory
      for (const item of selectedItems) {
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
        }
      }

      Alert.alert('Return Submitted', 'Return request submitted successfully. Admin will be notified.');
      setShowModal(false);
      setFoundInvoice(null);
      setInvoiceSearch('');
      setSelectedItems([]);
      setReason('');
      loadReturns();
    } catch (e) { Alert.alert('Error', 'Failed to submit return.'); }
  };

  const getStatusStyle = (status) => {
    if (status === 'approved') return { color: COLORS.success, bg: COLORS.successLight };
    if (status === 'rejected') return { color: COLORS.error, bg: COLORS.errorLight };
    return { color: COLORS.accent, bg: COLORS.warningLight };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Returns</Text>
          <Text style={styles.headerShop}>{userData?.shopName}</Text>
        </View>
        <TouchableOpacity style={styles.newReturnBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.newReturnBtnText}>New Return</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBar}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
        <Text style={styles.infoText}>Returns accepted within {COMPANY.returnDays} days of purchase only</Text>
      </View>

      <FlatList
        data={returns}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => {
          const status = getStatusStyle(item.status);
          return (
            <View style={styles.returnCard}>
              <View style={styles.returnHeader}>
                <View>
                  <Text style={styles.returnInvoice}>{item.invoiceNumber}</Text>
                  <Text style={styles.returnDate}>
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-IN') : ''}
                  </Text>
                </View>
                <View style={[styles.returnStatus, { backgroundColor: status.bg }]}>
                  <Text style={[styles.returnStatusText, { color: status.color }]}>
                    {item.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.returnItems}>{item.items?.length} item(s) returned</Text>
              <Text style={styles.returnReason}>Reason: {item.reason}</Text>
              <Text style={styles.returnRefund}>Refund: ₹{(item.totalRefund || 0).toFixed(2)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="refresh-circle-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No returns yet</Text>
          </View>
        }
      />

      {/* New Return Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>New Return</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setFoundInvoice(null); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Invoice Number</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. ALK-001-20250521-1234"
                placeholderTextColor={COLORS.textLight}
                value={invoiceSearch}
                onChangeText={setInvoiceSearch}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={searchInvoice}>
                <Ionicons name="search" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {foundInvoice && (
              <>
                <Text style={styles.inputLabel}>Select Items to Return</Text>
                {foundInvoice.items?.map((item, i) => {
                  const selected = selectedItems.find(s => s.productId === item.productId);
                  return (
                    <TouchableOpacity key={i} style={[styles.itemRow, selected && styles.itemRowSelected]} onPress={() => toggleItem(item)}>
                      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? COLORS.primary : COLORS.border} />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemDetail}>Qty: {item.quantity} · ₹{item.amount.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.inputLabel}>Reason for Return</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Enter reason..."
                  placeholderTextColor={COLORS.textLight}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />

                <TouchableOpacity style={styles.submitBtn} onPress={submitReturn}>
                  <Text style={styles.submitBtnText}>Submit Return</Text>
                </TouchableOpacity>
              </>
            )}
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
  headerShop: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  newReturnBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newReturnBtnText: { color: COLORS.white, fontWeight: '600' },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.infoLight, padding: 12, paddingHorizontal: 16 },
  infoText: { fontSize: 12, color: COLORS.info },
  list: { padding: 16 },
  returnCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 10, ...SHADOWS.small },
  returnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  returnInvoice: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  returnDate: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  returnStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  returnStatusText: { fontSize: 11, fontWeight: '700' },
  returnItems: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  returnReason: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  returnRefund: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  searchBtn: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 10, justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  itemRowSelected: { borderColor: COLORS.primary, backgroundColor: '#FDF0F0' },
  itemInfo: {},
  itemName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemDetail: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  reasonInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background, minHeight: 80 },
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 }
});
