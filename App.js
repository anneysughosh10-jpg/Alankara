import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from './src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLORS, COMPANY } from './src/config/theme';
import LoginScreen from './src/screens/auth/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';

const Stack = createStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const q = query(
            collection(db, 'users'),
            where('uid', '==', firebaseUser.uid)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setUserRole(data.role);
            setUserData(data);
            setUser(firebaseUser);
            setReady(true);
          } else {
            setReady(true);
          }
        } catch (e) {
          console.log('User fetch error:', e);
          setReady(true);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setUserData(null);
        setReady(true);
      }
    });
    return unsubscribe;
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>AT</Text>
          </View>
          <Text style={styles.loadingBrand}>{COMPANY.name}</Text>
          <Text style={styles.loadingSubtitle}>Point of Sale System</Text>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <Stack.Screen name="Main">
              {props => (
                <AppNavigator
                  {...props}
                  userRole={userRole}
                  userId={user.uid}
                  userData={userData}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  loadingBrand: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  loadingText: {
    color: COLORS.textLight,
    marginTop: 12,
    fontSize: 13,
  },
});
