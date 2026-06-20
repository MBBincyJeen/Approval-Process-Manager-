import 'react-native-gesture-handler';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, Alert } from 'react-native';
import { supabase } from './supabaseClient';

import Auth from './Auth';
// Import your other role-based screens
import RequesterScreen from './RequesterScreen';
import AuthorizerScreen from './AuthorizerScreen';
import ApproverScreen from './ApproverScreen';
import CoordinatorScreen from './CoordinatorScreen';
import ProprietorScreen from './ProprietorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id, session.user.email);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id, session.user.email);
      else setProfile(null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, userEmail) => {
    console.log('Fetching profile for:', userEmail);
    let profileData = null;
    let fetchError = null;

    // 1. Try to find profile by email (case-insensitive and trimmed)
    if (userEmail) {
      const normalizedEmail = userEmail.trim();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      
      profileData = data;
      fetchError = error;
    }

    // 2. If not found by email, try by id
    if (!profileData && !fetchError) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .maybeSingle();
      
      profileData = data;
      fetchError = error;
    }

    if (fetchError) {
      console.error('Error querying profile:', fetchError);
      Alert.alert('Database Error', `Error checking profile: ${fetchError.message}`);
      setProfile(null);
      return;
    }

    if (profileData) {
      // 3. If the profile's ID does not match the Auth ID, update it to link them
      if (profileData.id !== userId) {
        console.log(`Linking profile for ${userEmail} (updating ID ${profileData.id} to ${userId})`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ id: userId })
          .ilike('email', profileData.email);
        
        if (updateError) {
          console.error('Failed to link profile ID:', updateError);
        } else {
          profileData.id = userId;
        }
      }
      console.log('Profile successfully loaded:', profileData);
      setProfile(profileData);
    } else {
      console.error(`Profile not found for: ${userEmail}`);
      Alert.alert(
        'Profile Not Found',
        `No profile matches the email "${userEmail}" in the database. Please ensure you are logging in with a registered email.`
      );
      setProfile(null);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session || !profile ? (
          <Stack.Screen name="Auth" component={Auth} options={{ headerShown: false }} />
        ) : profile.role === 'requester' ? (
          <Stack.Screen name="Requester" options={{ headerShown: false }}>
            {props => <RequesterScreen {...props} user={session.user} profile={profile} />}
          </Stack.Screen>
        ) : profile.role === 'authorizer' ? (
          <Stack.Screen name="Authorizer" options={{ headerShown: false }}>
            {props => <AuthorizerScreen {...props} user={session.user} profile={profile} />}
          </Stack.Screen>
        ) : profile.role === 'approver' ? (
          <Stack.Screen name="Approver" options={{ headerShown: false }}>
            {props => <ApproverScreen {...props} user={session.user} profile={profile} />}
          </Stack.Screen>
        ) : profile.role === 'coordinator' ? (
          <Stack.Screen name="Coordinator" options={{ headerShown: false }}>
            {props => <CoordinatorScreen {...props} user={session.user} profile={profile} />}
          </Stack.Screen>
        ) : profile.role === 'proprietor' ? (      // <-- Add this block
        <Stack.Screen name="Proprietor" options={{ headerShown: false }}>
          {props => <ProprietorScreen {...props} user={session.user} profile={profile} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="UnknownRole" component={Auth} options={{ headerShown: false }} />
      )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
