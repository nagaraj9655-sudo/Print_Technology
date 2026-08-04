import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { canAccess } from '../lib/menus'
import { colors, font } from '../theme'
import type { RootStackParamList, TabParamList } from './types'

import { LoginScreen } from '../screens/LoginScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { BillsScreen } from '../screens/BillsScreen'
import { QuotationsScreen } from '../screens/QuotationsScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { BillFormScreen } from '../screens/BillFormScreen'
import { BillDetailScreen } from '../screens/BillDetailScreen'
import { QuoteFormScreen } from '../screens/QuoteFormScreen'
import { QuoteDetailScreen } from '../screens/QuoteDetailScreen'
import { CustomersScreen } from '../screens/CustomersScreen'
import { CustomerFormScreen } from '../screens/CustomerFormScreen'
import { CompaniesScreen } from '../screens/CompaniesScreen'
import { CompanyFormScreen } from '../screens/CompanyFormScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { UsersScreen } from '../screens/UsersScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<TabParamList>()

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } }

function Tabs() {
  const { currentUser } = useStore()
  const allowed = (key: string) => canAccess(currentUser?.role ?? 'Operator', currentUser?.allowedMenus, key)
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Bills: focused ? 'receipt' : 'receipt-outline',
            Quotations: focused ? 'document-text' : 'document-text-outline',
            More: focused ? 'menu' : 'menu-outline',
          }
          return <Ionicons name={map[route.name]} size={22} color={color} />
        },
      })}
    >
      {allowed('dashboard') && <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />}
      {allowed('bills') && <Tab.Screen name="Bills" component={BillsScreen} />}
      {allowed('quotations') && <Tab.Screen name="Quotations" component={QuotationsScreen} options={{ title: 'Quotes' }} />}
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  )
}

export function RootNavigator() {
  const { ready, currentUser } = useStore()

  if (!ready) return <Splash />

  return (
    <NavigationContainer theme={navTheme}>
      {!currentUser ? (
        <LoginScreen />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="BillForm" component={BillFormScreen} />
          <Stack.Screen name="BillDetail" component={BillDetailScreen} />
          <Stack.Screen name="QuoteForm" component={QuoteFormScreen} />
          <Stack.Screen name="QuoteDetail" component={QuoteDetailScreen} />
          <Stack.Screen name="CustomersList" component={CustomersScreen} />
          <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
          <Stack.Screen name="CompaniesList" component={CompaniesScreen} />
          <Stack.Screen name="CompanyForm" component={CompanyFormScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Users" component={UsersScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  )
}

function Splash() {
  return (
    <LinearGradient colors={colors.gradBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.splash}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>M</Text>
      </View>
      <Text style={styles.brand}>Magizhini</Text>
      <Text style={styles.tag}>Billing & Quotations</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoText: { color: '#fff', fontSize: 46, fontWeight: '800' },
  brand: { ...font.h1, color: '#fff', fontSize: 30, letterSpacing: 0.5 },
  tag: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, fontWeight: '600' },
})
