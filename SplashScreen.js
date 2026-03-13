import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Auth'); // navigate to Auth screen after 10 seconds
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image source={require('/Users/maheerjeen/PragmagicAPM/assets/logo.jpeg')} style={styles.logo} />
      <Text style={styles.title}> Welcome to Pragmagic APM </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4D8462' },
  logo: { width: 340, height: 100, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
});
