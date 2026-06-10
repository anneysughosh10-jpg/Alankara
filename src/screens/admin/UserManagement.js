import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, ScrollView, RefreshControl
} from 'react-native';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { COLORS, SHADOWS } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

export default function UserManagement({ userData, userRole }) {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'shopkeeper', shopId: '', phone: '' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { Alert.alert('Error', 'Failed to load users.'); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadUsers(); setRefreshing(false); };

  const filteredUsers = users.filter(u => filterRole === 'all' ? true : u.role === filterRole);

  const roleConfig = {
    superadmin: { label: 'Super Admin', color: COLORS.primary, bg: '#FDF0F0' },
    admin: { label: 'Admin', color: COLORS.accent, bg: '#FFF8E7' },
    shopkeeper: { label: 'Shopkeeper', color: COLORS.info, bg: COLORS.infoLight }
  };

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'shopkeeper', shopId: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name || user.ownerName || '', email: user.email || '', password: '', role: user.role || 'shopkeeper', shopId: user.shopId || '', phone: user.phone || '' });
    setShowModal(true);
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      Alert.alert('Required', 'Name and email are required.'); return;
    }
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          name: form.name.trim(), ownerName: form.name.trim(),
          role: form.role, shopId: form.shopId.trim(),
          phone: form.phone.trim(), updatedAt: serverTimestamp()
        });
        Alert.alert('Updated', 'User updated successfully.');
      } else {
        if (!form.password || form.password.length < 6) {
          Alert.alert('Password Required', 'Minimum 6 characters.'); return;
        }
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await addDoc(collection(db, 'users'), {
          uid: cred.user.uid, name: form.name.trim(),
          ownerName: form.name.trim(), email: form.email.trim(),
          role: form.role, shopId: form.shopId.trim(),
          phone: form.phone.trim(), gstin: '36HXAPD1020F1Z7',
          createdAt: serverTimestamp()
        });
        Alert.alert('Created', `User created!\nEmail: ${form.email}\nPassword: ${form.password}\nRole: ${form.role}`);
      }
      setShowModal(false);
      loadUsers();
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') Alert.alert('Error', 'Email already registered.');
      else Alert.alert('Error', e.message);
    }
  };

  const deleteUser = (user) => {
    if (user.role === 'superadmin') { Alert.alert('Not Allowed', 'Cannot delete super admin.'); return; }
    Alert.alert('Delete User', `Delete ${user.name || user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteDoc(doc(db, 'users', user.id)); loadUsers(); } catch (e) { Alert.alert('Error', 'Failed.'); } } }
    ]);
  };

  const roleCounts = {
    superadmin: users.filter(u => u.role === 'superadmin').length,
    admin: users.filter(u => u.role === 'admin').length,
    shopkeeper: users.filter(u => u.role === 'shopkeeper').length,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Users</Text>
          <Text style={styles.headerSub}>{users.length} total users</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add User</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {Object.entries(roleConfig).map(([role, config]) => (
          <TouchableOpacity key={role} style={[styles.statChip, filterRole === role && { backgroundColor: config.bg, borderColor: config.color }]} onPress={() => setFilterRole(filterRole === role ? 'all' : role)}>
            <Text style={[styles.statNum, { color: config.color }]}>{roleCounts[role]}</Text>
            <Text style={styles.statLabel}>{config.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => {
          const config = roleConfig[item.role] || roleConfig.shopkeeper;
          return (
            <View style={styles.userCard}>
              <View style={[styles.roleBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.roleText, { color: config.color }]}>{config.label}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name || item.ownerName || 'No Name'}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                {item.shopId ? <Text style={styles.userShop}>Shop: {item.shopId}</Text> : null}
                {item.phone ? <Text style={styles.userPhone}>{item.phone}</Text> : null}
              </View>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(item)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No users found</Text></View>}
      />

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User' : 'Add User'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'name', label: 'Full Name *', placeholder: 'Enter full name' },
                { key: 'email', label: 'Email *', placeholder: 'user@email.com', keyboard: 'email-address', editable: !editingUser },
                { key: 'password', label: editingUser ? 'Password (leave blank to keep)' : 'Password *', placeholder: 'Min 6 characters', secure: true },
                { key: 'shopId', label: 'Shop ID', placeholder: 'ALK-001' },
                { key: 'phone', label: 'Phone', placeholder: '10-digit number', keyboard: 'phone-pad' },
              ].map(field => (
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

              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleOptions}>
                {(userRole === 'superadmin' ? ['shopkeeper', 'admin', 'superadmin'] : ['shopkeeper']).map(role => {
                  const config = roleConfig[role];
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleOption, form.role === role && { backgroundColor: config.bg, borderColor: config.color }]}
                      onPress={() => setForm(p => ({ ...p, role }))}
                    >
                      <Text style={[styles.roleOptionText, form.role === role && { color: config.color, fontWeight: '700' }]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={saveUser}>
                <Text style={styles.saveBtnText}>{editingUser ? 'Update User' : 'Create User'}</Text>
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
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statChip: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  statNum: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  list: { padding: 16 },
  userCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, ...SHADOWS.small },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  roleText: { fontSize: 11, fontWeight: '700' },
  userInfo: {},
  userName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  userShop: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  userPhone: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  actionBtns: { position: 'absolute', right: 14, top: 14, flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#FDF0F0', padding: 8, borderRadius: 8 },
  deleteBtn: { backgroundColor: COLORS.errorLight, padding: 8, borderRadius: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  inputDisabled: { backgroundColor: COLORS.borderLight, color: COLORS.textLight },
  roleOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  roleOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  roleOptionText: { fontSize: 13, color: COLORS.textSecondary },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 }
});
