import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iotavlgqnpmxbkfhsgfj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvdGF2bGdxbnBteGJrZmhzZ2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MjEwNDUsImV4cCI6MjA3OTA5NzA0NX0.Bdg_sho_0a5Ain969wKPQrHLFVbS87M8dmyWF8Yrkew'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
