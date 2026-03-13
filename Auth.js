import { useState} from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { Input, Button } from '@rn-vui/themed';
import { signIn } from './auth copy'; // import your signIn function
import { Colors } from './theme';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const { user, error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Logged in successfully!');
      // Proceed to next app screen or store session here
    }
  }

  return (
    <View style={styles.container}>
      <Input
        label="Email"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
        inputContainerStyle={{ borderBottomColor: Colors.primary }}
        labelStyle={{ color: Colors.primary }}
      />
      <Input
        label="Password"
        secureTextEntry
        autoCapitalize="none"
        onChangeText={setPassword}
        value={password}
        inputContainerStyle={{ borderBottomColor: Colors.primary }}
        labelStyle={{ color: Colors.primary }}
      />
      <Button
        title="Sign In"
        onPress={handleSignIn}
        disabled={loading}
        buttonStyle={{ backgroundColor: Colors.primary, marginVertical: 5 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: (Colors && Colors.white) ? Colors.white : '#fff',
  },
});
