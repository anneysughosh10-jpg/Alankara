import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, ScrollView, RefreshControl
} from 'react-native';
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { COLORS, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ShopManagement({ userData }) {
  const [shops, setShops] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    shopName: '', shopId: '', ownerName: '', email: '',
    password: '', phone: '', city: '', address: ''
  });

  useEffect(() => { loadShops(); }, []);

  const loadShops = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'shopkeeper')));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.shopId || '').localeCompare(b.shopId || ''));
      setShops(items);
    } catch (e) { Alert.alert('Error', 'Failed to load shops.'); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadShops(); setRefreshing(false); };

  const openAdd = () => {
    setEditingShop(null);
    const nextId = `ALK-${String(shops.length + 1).padStart(3, '0')}`;
    setForm({ shopName: '', shopId: nextId, ownerName: '', email: '', password: '', phone: '', city: 'Hyderabad', address: '' });
    setShowModal(true);
  };

  const openEdit = (shop) => {
    setEditingShop(shop);
    setForm({
      shopName: shop.shopName || '', shopId: shop.shopId || '',
      ownerName: shop.ownerName || '', email: shop.email || '',
      password: '', phone: shop.phone || '',
      city: shop.city || 'Hyderabad', address: shop.address || ''
    });
    setShowModal(true);
  };

  const saveShop = async () => {
    if (!form.shopName.trim() || !form.shopId.trim() || !form.email.trim()) {
      Alert.alert('Required', 'Shop name, ID and email are required.');
      return;
    }
    try {
      if (editingShop) {
        await updateDoc(doc(db, 'users', editingShop.id), {
          shopName: form.shopName.trim(), shopId: form.shopId.trim(),
          ownerName: form.ownerName.trim(), phone: form.phone.trim(),
          city: form.city.trim(), address: form.address.trim(),
          updatedAt: serverTimestamp()
        });
        Alert.alert('Updated', 'Shop details updated.');
      } else {
        if (!form.password || form.password.length < 6) {
          Alert.alert('Password Required', 'Minimum 6 characters.'); return;
        }
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await addDoc(collection(db, 'users'), {
          uid: cred.user.uid, email: form.email.trim(),
          shopName: form.shopName.trim(), shopId: form.shopId.trim(),
          ownerName: form.ownerName.trim(), phone: form.phone.trim(),
          city: form.city.trim(), address: form.address.trim(),
          role: 'shopkeeper', gstin: '36HXAPD1020F1Z7',
          createdAt: serverTimestamp()
        });
        Alert.alert('Shop Created', `Login: ${form.email}\nPassword: ${form.password}`);
      }
      setShowModal(false);
      loadShops();
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') Alert.alert('Error', 'Email already registered.');
      else Alert.alert('Error', e.message);
    }
  };

  const deleteShop = (shop) => {
    Alert.alert('Delete Shop', `Delete "${shop.shopName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'users', shop.id)); loadShops(); }
          catch (e) { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const fields = [
    { key: 'shopName', label: 'Shop Name *', placeholder: 'Alankara Textile - Banjara Hills' },
    { key: 'shopId', label: 'Shop ID *', placeholder: 'ALK-001' },
    { key: 'ownerName', label: 'Shopkeeper Name', placeholder: 'Full name' },
    { key: 'email', label: 'Login Email *', placeholder: 'shopkeeper@email.com', keyboard: 'email-address', editable: !editingShop },
    { key: 'password', label: editingShop ? 'New Password (optional)' : 'Password *', placeholder: 'Min 6 characters', secure: true },
    { key: 'phone', label: 'Phone', placeholder: '10-digit number', keyboard: 'phone-pad' },
    { key: 'city', label: 'City', placeholder: 'Hyderabad' },
    { key: 'address', label: 'Address', placeholder: 'Full shop address' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Manage Shops</Text>
          <Text style={styles.headerSub}>{shops.length} shops registered</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Shop</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={shops}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item, index }) => (
          <View style={styles.shopCard}>
            <View style={styles.shopHeader}>
              <View style={styles.shopIdBadge}>
                <Text style={styles.shopIdText}>{item.shopId || `ALK-${String(index + 1).padStart(3, '0')}`}</Text>
              </View>
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{item.shopName}</Text>
                <Text style={styles.shopEmail}>{item.email}</Text>
                {item.ownerName ? <Text style={styles.shopOwner}>{item.ownerName}</Text> : null}
                <Text style={styles.shopCity}>{item.city || 'Hyderabad'}{item.address ? ` · ${item.address}` : ''}</Text>
              </View>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteShop(item)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No shops yet</Text>
            <Text style={styles.emptySub}>Tap "Add Shop" to register your first shop</Text>
          </View>
        }
      />

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{editingShop ? 'Edit Shop' : 'Add New Shop'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {fields.map(field => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.editable === false && styles.inputDisabled]}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textLight}
                    value={form[field.key]}
                    onChangeText={val => setForm(p => ({ ...p, [field.key]: val }))}
                    keyboardType={field.keyboard || 'default'}
                    secureTextEntry={field.secure || false}
                    autoCapitalize="none"
                    editable={field.editable !== false}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={saveShop}>
                <Text style={styles.saveBtnText}>{editingShop ? 'Update Shop' : 'Create Shop'}</Text>
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
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: COLORS.white, fontWeight: '600' },
  list: { padding: 16 },
  shopCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.small },
  shopHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  shopIdBadge: { backgroundColor: '#FDF0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  shopIdText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  shopEmail: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  shopOwner: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  shopCity: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  actionBtns: { gap: 6 },
  editBtn: { backgroundColor: '#FDF0F0', padding: 8, borderRadius: 8 },
  deleteBtn: { backgroundColor: COLORS.errorLight, padding: 8, borderRadius: 8 },
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
  inputDisabled: { backgroundColor: COLORS.borderLight, color: COLORS.textLight },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 }
});
