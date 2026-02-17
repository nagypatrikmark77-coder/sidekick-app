import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://hqfynnoifimsrmhoxsea.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZnlubm9pZmltc3JtaG94c2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTM0MjIsImV4cCI6MjA4NTAyOTQyMn0.-KPsLZh8lRc8-SDSASzFy9BJlGq34g2x-paJEgfueqg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // fontos mobilon
  },
})
