import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto'
const supabaseUrl = 'https://whniypziummucobjifug.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indobml5cHppdW1tdWNvYmppZnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzY0OTQsImV4cCI6MjA3NTI1MjQ5NH0.5aS9UZy2_39MpgYgT3ZJPTWegwIcw7iVHwJpVIYtknY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
