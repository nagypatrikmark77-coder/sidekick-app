import { Tabs } from 'expo-router';
import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopWidth: 1,
          borderTopColor: Colors.card,
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
