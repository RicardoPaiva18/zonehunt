import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

export default function Index() {
  const [status, setStatus] = useState('A ligar ao Firebase...');

  useEffect(() => {
    signInAnonymously(auth)
      .then((result) => {
        setStatus(`Ligado! User ID: ${result.user.uid.slice(0, 8)}...`);
      })
      .catch((error) => {
        setStatus(`Erro: ${error.message}`);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZoneHunt</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 20,
  },
  status: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
});