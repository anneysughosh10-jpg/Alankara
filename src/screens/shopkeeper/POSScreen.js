import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, TextInput, Modal, ScrollView, StatusBar, Linking
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, COMPANY, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function POSScreen({ userId, userData }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState([]);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const scanCooldown = useRef(false);

  const shopId = userData?.shopId;

  const generateInvoiceNumber = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = String(Math.floor(Math.random() * 9000) + 1000);
    return `ALK-${shopId}-${dateStr}-${random}`;
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanCooldown.current || data === lastScanned) return;
    scanCooldown.current = true;
    setLastScanned(data);
    setScanning(false);

    try {
      const snap = await getDocs(query(
        collection(db, 'inventory'),
        where('barcode', '==', data),
        where('shopId', '==', shopId)
      ));

      if (!snap.empty) {
        const product = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setScannedProduct(product);
        setShowProductModal(true);
      } else {
        Alert.alert('Not Found', `No product found for barcode: ${data}`, [
          { text: 'OK', onPress: () => { setLastScanned(''); scanCooldown.current = false; } }
        ]);
        return;
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch product.');
    }
    setTimeout(() => { scanCooldown.current = false; }, 2000);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) { Alert.alert('Camera permission required'); return; }
    }
    setScanning(true);
  };

  const addToCart = (product) => {
    const existing = cart.findIndex(i => i.id === product.id);
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing].cartQty += 1;
      setCart(updated);
    } else {
      setCart([...cart, { ...product, cartQty: 1, sellingPrice: product.price }]);
    }
    setShowProductModal(false);
    setLastScanned('');
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id !== id) return item;
      const newQty = item.cartQty + delta;
      if (newQty <= 0) return null;
      return { ...item, cartQty: newQty };
    }).filter(Boolean));
  };

  const updatePrice = (id, price) => {
    setCart(cart.map(item => item.id === id ? { ...item, sellingPrice: parseFloat(price) || 0 } : item));
  };

  const getSubtotal = () => cart.reduce((s, i) => s + (i.sellingPrice * i.cartQty), 0);
  const getCGST = () => getSubtotal() * COMPANY.cgstRate;
  const getSGST = () => getSubtotal() * COMPANY.sgstRate;
  const getTotal = () => getSubtotal() + getCGST() + getSGST();

  const processCheckout = async () => {
    if (cart.length === 0) { Alert.alert('Empty Cart', 'Please scan products first.'); return; }
    setLoading(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const subtotal = getSubtotal();
      const cgst = getCGST();
      const sgst = getSGST();
      const total = getTotal();

      const saleData = {
        invoiceNumber,
        shopId,
        shopName: userData?.shopName,
        shopAddress: userData?.address || '',
        city: userData?.city || 'Hyderabad',
        customerPhone: customerPhone || '',
        items: cart.map(item => ({
          productId: item.id,
          productName: item.productName,
          barcode: item.barcode || '',
          hsnCode: item.hsnCode || '6006',
          category: item.category || '',
          basePrice: item.price,
          sellingPrice: item.sellingPrice,
          quantity: item.cartQty,
          amount: item.sellingPrice * item.cartQty
        })),
        subtotal, cgst, sgst,
        totalAmount: total,
        cgstRate: COMPANY.cgstRate,
        sgstRate: COMPANY.sgstRate,
        gstin: COMPANY.gstin,
        createdAt: serverTimestamp(),
        status: 'completed',
        returnEligibleUntil: new Date(Date.now() + COMPANY.returnDays * 86400000).toISOString()
      };

      await addDoc(collection(db, 'sales'), saleData);

      for (const item of cart) {
        try {
          const invSnap = await getDocs(query(
            collection(db, 'inventory'),
            where('productId', '==', item.productId || item.id),
            where('shopId', '==', shopId)
          ));
          if (!invSnap.empty) {
            const inv = invSnap.docs[0];
            const newQty = Math.max(0, (inv.data().quantity || 0) - item.cartQty);
            await updateDoc(doc(db, 'inventory', inv.id), { quantity: newQty });
          }
        } catch (e) { console.log('Inventory update error:', e); }
      }

      setInvoiceData({ ...saleData });
      setShowCheckoutModal(false);
      setShowInvoiceModal(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to process sale.');
      console.log('Checkout error:', e);
    }
    setLoading(false);
  };

  const sendWhatsApp = () => {
    if (!invoiceData) return;
    const items = invoiceData.items.map(i =>
      `  ${i.productName} x${i.quantity} - ₹${i.amount.toFixed(2)}`
    ).join('\n');

    const msg = `*${COMPANY.name}*\n${invoiceData.shopName}\nGSTIN: ${COMPANY.gstin}\n\n` +
      `*Invoice: ${invoiceData.invoiceNumber}*\n` +
      `Date: ${new Date().toLocaleDateString('en-IN')}\n\n` +
      `*Items:*\n${items}\n\n` +
      `Subtotal: ₹${invoiceData.subtotal.toFixed(2)}\n` +
      `CGST (2.5%): ₹${invoiceData.cgst.toFixed(2)}\n` +
      `SGST (2.5%): ₹${invoiceData.sgst.toFixed(2)}\n` +
      `*Total: ₹${invoiceData.totalAmount.toFixed(2)}*\n\n` +
      `Return within ${COMPANY.returnDays} days with invoice.\nThank you!`;

    const phone = '91' + (customerPhone || invoiceData.customerPhone);
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('WhatsApp not available');
    });
  };

  const newSale = () => {
    setCart([]);
    setCustomerPhone('');
    setInvoiceData(null);
    setShowInvoiceModal(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Point of Sale</Text>
        <Text style={styles.headerShop}>{userData?.shopName}</Text>
      </View>

      <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
        <Ionicons name="scan-outline" size={22} color={COLORS.white} />
        <Text style={styles.scanBtnText}>Scan Barcode</Text>
      </TouchableOpacity>

      {scanning && (
        <View style={StyleSheet.absoluteFillObject}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a'] }}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Align barcode within the frame</Text>
          </View>
          <TouchableOpacity style={styles.closeScan} onPress={() => { setScanning(false); setLastScanned(''); }}>
            <Ionicons name="close" size={24} color={COLORS.white} />
            <Text style={styles.closeScanText}>Close Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.cartContainer}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>Cart</Text>
          <Text style={styles.cartCount}>{cart.length} item{cart.length !== 1 ? 's' : ''}</Text>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyCartText}>Cart is empty</Text>
            <Text style={styles.emptyCartSub}>Scan a product barcode to add items</Text>
          </View>
        ) : (
          <FlatList
            data={cart}
            keyExtractor={item => item.id}
            style={styles.cartList}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemTop}>
                  <Text style={styles.cartItemName}>{item.productName}</Text>
                  <TouchableOpacity onPress={() => setCart(cart.filter(i => i.id !== item.id))}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartItemCategory}>{item.category}</Text>
                <View style={styles.cartItemBottom}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                      <Ionicons name="remove" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.cartQty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                      <Ionicons name="add" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceLabel}>₹</Text>
                    <TextInput
                      style={styles.priceField}
                      value={String(item.sellingPrice)}
                      onChangeText={val => updatePrice(item.id, val)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={styles.itemTotal}>₹{(item.sellingPrice * item.cartQty).toFixed(2)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {cart.length > 0 && (
        <View style={styles.checkoutBar}>
          <View>
            <Text style={styles.totalLabel}>Total (incl. GST)</Text>
            <Text style={styles.totalAmount}>₹{getTotal().toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={() => setShowCheckoutModal(true)}>
            <Text style={styles.checkoutBtnText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Product Found</Text>
            {scannedProduct && (
              <>
                <View style={styles.productDetailCard}>
                  <Text style={styles.productDetailName}>{scannedProduct.productName}</Text>
                  <Text style={styles.productDetailCat}>{scannedProduct.category}</Text>
                  <View style={styles.productDetailRow}>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>Base Price</Text>
                      <Text style={styles.productDetailValue}>₹{scannedProduct.price}</Text>
                    </View>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>In Stock</Text>
                      <Text style={[styles.productDetailValue, { color: scannedProduct.quantity > 0 ? COLORS.success : COLORS.error }]}>
                        {scannedProduct.quantity} units
                      </Text>
                    </View>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>HSN Code</Text>
                      <Text style={styles.productDetailValue}>{scannedProduct.hsnCode || '6006'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalAddBtn} onPress={() => addToCart(scannedProduct)}>
                    <Ionicons name="cart" size={18} color={COLORS.white} />
                    <Text style={styles.modalAddBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowProductModal(false); setLastScanned(''); }}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showCheckoutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Checkout</Text>
            <Text style={styles.inputLabel}>Customer WhatsApp (Optional)</Text>
            <View style={styles.phoneInput}>
              <Text style={styles.phonePrefix}>+91</Text>
              <TextInput
                style={styles.phoneField}
                placeholder="10-digit number"
                placeholderTextColor={COLORS.textLight}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.billSummary}>
              <View style={styles.billRow}><Text style={styles.billLabel}>Subtotal</Text><Text style={styles.billValue}>₹{getSubtotal().toFixed(2)}</Text></View>
              <View style={styles.billRow}><Text style={styles.billLabel}>CGST (2.5%)</Text><Text style={styles.billValue}>₹{getCGST().toFixed(2)}</Text></View>
              <View style={styles.billRow}><Text style={styles.billLabel}>SGST (2.5%)</Text><Text style={styles.billValue}>₹{getSGST().toFixed(2)}</Text></View>
              <View style={[styles.billRow, styles.billTotalRow]}>
                <Text style={styles.billTotalLabel}>Total</Text>
                <Text style={styles.billTotalValue}>₹{getTotal().toFixed(2)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={processCheckout} disabled={loading}
            >
              <Text style={styles.confirmBtnText}>{loading ? 'Processing...' : 'Confirm Sale'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelCheckoutBtn} onPress={() => setShowCheckoutModal(false)}>
              <Text style={styles.cancelCheckoutText}>Back to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showInvoiceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <ScrollView>
              <View style={styles.invoiceHeader}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.invoiceSuccessText}>Sale Complete!</Text>
              </View>
              <View style={styles.invoiceCard}>
                <Text style={styles.invoiceCompany}>{COMPANY.name}</Text>
                <Text style={styles.invoiceShop}>{invoiceData?.shopName}</Text>
                <Text style={styles.invoiceGst}>GSTIN: {COMPANY.gstin}</Text>
                <View style={styles.invoiceDivider} />
                <Text style={styles.invoiceNo}>{invoiceData?.invoiceNumber}</Text>
                <Text style={styles.invoiceDate}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                <View style={styles.invoiceDivider} />
                {invoiceData?.items?.map((item, i) => (
                  <View key={i} style={styles.invoiceItem}>
                    <Text style={styles.invoiceItemName}>{item.productName}</Text>
                    <Text style={styles.invoiceItemDetail}>Qty: {item.quantity} × ₹{item.sellingPrice}</Text>
                    <Text style={styles.invoiceItemAmount}>₹{item.amount.toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.invoiceDivider} />
                <View style={styles.invoiceTaxRow}><Text>Subtotal</Text><Text>₹{invoiceData?.subtotal?.toFixed(2)}</Text></View>
                <View style={styles.invoiceTaxRow}><Text>CGST 2.5%</Text><Text>₹{invoiceData?.cgst?.toFixed(2)}</Text></View>
                <View style={styles.invoiceTaxRow}><Text>SGST 2.5%</Text><Text>₹{invoiceData?.sgst?.toFixed(2)}</Text></View>
                <View style={[styles.invoiceTaxRow, { marginTop: 8 }]}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Total</Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: COLORS.primary }}>₹{invoiceData?.totalAmount?.toFixed(2)}</Text>
                </View>
              </View>
              {customerPhone ? (
                <TouchableOpacity style={styles.whatsappBtn} onPress={sendWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={20} color={COLORS.white} />
                  <Text style={styles.whatsappBtnText}>Send on WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.newSaleBtn} onPress={newSale}>
                <Text style={styles.newSaleBtnText}>New Sale</Text>
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
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  headerShop: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, margin: 16, padding: 16,
    borderRadius: 12, gap: 10, ...SHADOWS.medium
  },
  scanBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 260, height: 160, borderWidth: 2, borderColor: COLORS.accent, borderRadius: 12 },
  scanHint: { color: COLORS.white, marginTop: 16, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 8 },
  closeScan: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30
  },
  closeScanText: { color: COLORS.white, fontWeight: '600' },
  cartContainer: { flex: 1, marginHorizontal: 16 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cartTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  cartCount: { fontSize: 12, color: COLORS.textLight },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 48 },
  emptyCartText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500', marginTop: 12 },
  emptyCartSub: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  cartList: { flex: 1 },
  cartItem: { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 8, ...SHADOWS.small },
  cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartItemName: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  cartItemCategory: { fontSize: 11, color: COLORS.textLight, marginTop: 2, marginBottom: 8 },
  cartItemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background, borderRadius: 8, padding: 4 },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 15, fontWeight: '600', color: COLORS.text, minWidth: 24, textAlign: 'center' },
  priceInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8 },
  priceLabel: { fontSize: 14, color: COLORS.textSecondary, marginRight: 2 },
  priceField: { fontSize: 14, color: COLORS.text, padding: 6, minWidth: 70 },
  itemTotal: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  checkoutBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border
  },
  totalLabel: { fontSize: 12, color: COLORS.textLight },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10
  },
  checkoutBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  productDetailCard: { backgroundColor: COLORS.background, borderRadius: 12, padding: 16, marginBottom: 16 },
  productDetailName: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  productDetailCat: { fontSize: 13, color: COLORS.textLight, marginTop: 2, marginBottom: 12 },
  productDetailRow: { flexDirection: 'row' },
  productDetailItem: { flex: 1 },
  productDetailLabel: { fontSize: 11, color: COLORS.textLight },
  productDetailValue: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalAddBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, gap: 8 },
  modalAddBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: 14, borderRadius: 10 },
  modalCancelBtnText: { color: COLORS.textSecondary, fontWeight: '500' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  phoneInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 16, backgroundColor: COLORS.background },
  phonePrefix: { paddingHorizontal: 12, fontSize: 14, color: COLORS.textSecondary, borderRightWidth: 1, borderRightColor: COLORS.border, paddingVertical: 12 },
  phoneField: { flex: 1, padding: 12, fontSize: 14, color: COLORS.text },
  billSummary: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 13, color: COLORS.textSecondary },
  billValue: { fontSize: 13, color: COLORS.text },
  billTotalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  billTotalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  billTotalValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  confirmBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  confirmBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  cancelCheckoutBtn: { padding: 14, alignItems: 'center' },
  cancelCheckoutText: { color: COLORS.textSecondary, fontSize: 14 },
  invoiceHeader: { alignItems: 'center', padding: 16 },
  invoiceSuccessText: { fontSize: 18, fontWeight: 'bold', color: COLORS.success, marginTop: 8 },
  invoiceCard: { backgroundColor: COLORS.background, borderRadius: 12, padding: 16, marginBottom: 16 },
  invoiceCompany: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' },
  invoiceShop: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  invoiceGst: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 2 },
  invoiceDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  invoiceNo: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  invoiceDate: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  invoiceItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  invoiceItemName: { flex: 1, fontSize: 13, color: COLORS.text },
  invoiceItemDetail: { fontSize: 12, color: COLORS.textLight, marginHorizontal: 8 },
  invoiceItemAmount: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  invoiceTaxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#25D366', padding: 14, borderRadius: 10, marginBottom: 10, gap: 8
  },
  whatsappBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  newSaleBtn: { backgroundColor: COLORS.background, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  newSaleBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 }
});
