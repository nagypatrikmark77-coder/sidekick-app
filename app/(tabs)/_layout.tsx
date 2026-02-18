import { Tabs } from 'expo-router';
import React from 'react';
import { Feather } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';

const COLORS = {
  background: '#0A0A0F',
  active: '#3B82F6',
  inactive: '#6B7280',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: '#1A1A2E',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Főoldal',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="home" size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Jegyzetek',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="file-text" size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="message-circle" size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Szokások',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="target" size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="user" size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
