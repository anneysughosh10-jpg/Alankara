import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, ScrollView, RefreshControl
} from 'react-native';
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, CATEGORIES, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProductMasterScreen({ userData }) {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [form, setForm] = useState({
    productName: '', category: 'Sarees', basePrice: '',
    hsnCode: '6006', barcode: '', description: ''
  });

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    let result = products;
    if (selectedCategory !== 'All') result = result.filter(p => p.category === selectedCategory);
    if (search.trim()) result = result.filter(p =>
      p.productName?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
    );
    setFiltered(result);
  }, [search, selectedCategory, products]);

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.productName || '').localeCompare(b.productName || ''));
      setProducts(items);
      setFiltered(items);
    } catch (e) { Alert.alert('Error', 'Failed to load products.'); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadProducts(); setRefreshing(false); };

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ productName: '', category: 'Sarees', basePrice: '', hsnCode: '6006', barcode: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      productName: product.productName || '',
      category: product.category || 'Sarees',
      basePrice: String(product.basePrice || ''),
      hsnCode: product.hsnCode || '6006',
      barcode: product.barcode || '',
      description: product.description || ''
    });
    setShowModal(true);
  };

  const saveProduct = async () => {
    if (!form.productName.trim() || !form.basePrice) {
      Alert.alert('Required', 'Product name and base price are required.');
      return;
    }
    try {
      const data = {
        productName: form.productName.trim(),
        category: form.category,
        basePrice: parseFloat(form.basePrice),
        hsnCode: form.hsnCode.trim() || '6006',
        barcode: form.barcode.trim(),
        description: form.description.trim(),
        updatedAt: serverTimestamp()
      };
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        Alert.alert('Updated', 'Product updated successfully.');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'products'), data);
        Alert.alert('Added', 'Product added to master list.');
      }
      setShowModal(false);
      loadProducts();
    } catch (e) { Alert.alert('Error', 'Failed to save product.'); }
  };

  const deleteProduct = (product) => {
    Alert.alert('Delete Product', `Delete "${product.productName}" from master list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'products', product.id));
            loadProducts();
          } catch (e) { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const categories = ['All', ...CATEGORIES];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Product Master List</Text>
          <Text style={styles.headerSub}>{products.length} products total</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productLeft}>
              <Text style={styles.productName}>{item.productName}</Text>
              <View style={styles.productMeta}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{item.category}</Text>
                </View>
                <Text style={styles.hsnText}>HSN: {item.hsnCode}</Text>
              </View>
              {item.barcode ? <Text style={styles.barcodeText}>Barcode: {item.barcode}</Text> : null}
            </View>
            <View style={styles.productRight}>
              <Text style={styles.basePrice}>₹{item.basePrice}</Text>
              <Text style={styles.basePriceLabel}>Base Price</Text>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(item)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySub}>Tap "Add Product" to create the master list</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add New Product'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'productName', label: 'Product Name *', placeholder: 'e.g. Kanjivaram Silk Saree' },
                { key: 'basePrice', label: 'Base Price (₹) *', placeholder: '0.00', keyboard: 'decimal-pad' },
                { key: 'barcode', label: 'Barcode', placeholder: 'Enter barcode number' },
                { key: 'hsnCode', label: 'HSN Code', placeholder: '6006' },
                { key: 'description', label: 'Description (Optional)', placeholder: 'Product details...' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textLight}
                    value={form[field.key]}
                    onChangeText={val => setForm(p => ({ ...p, [field.key]: val }))}
                    keyboardType={field.keyboard || 'default'}
                  />
                </View>
              ))}

              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, form.category === cat && styles.categoryChipActive, { marginRight: 8 }]}
                    onPress={() => setForm(p => ({ ...p, category: cat }))}
                  >
                    <Text style={[styles.categoryChipText, form.category === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.saveBtn} onPress={saveProduct}>
                <Text style={styles.saveBtnText}>{editingProduct ? 'Update Product' : 'Add to Master List'}</Text>
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
  categoryScroll: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  categoryContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.textSecondary },
  categoryChipTextActive: { color: COLORS.white, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, gap: 8
  },
  searchInput: { flex: 1, padding: 10, fontSize: 14, color: COLORS.text },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  productCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 10, padding: 14,
    marginBottom: 8, ...SHADOWS.small
  },
  productLeft: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  categoryTag: { backgroundColor: '#FDF0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryTagText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  hsnText: { fontSize: 11, color: COLORS.textLight },
  barcodeText: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  productRight: { alignItems: 'flex-end', gap: 4 },
  basePrice: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  basePriceLabel: { fontSize: 10, color: COLORS.textLight },
  actionBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editBtn: { padding: 6, backgroundColor: '#FDF0F0', borderRadius: 6 },
  deleteBtn: { padding: 6, backgroundColor: COLORS.errorLight, borderRadius: 6 },
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
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 }
});
