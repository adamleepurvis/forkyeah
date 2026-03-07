import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useColors, type Colors } from '../../lib/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const C = useColors();
  const styles = makeStyles(C);

  async function signIn() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>ForkYeah</Text>
        <Text style={styles.tagline}>Your meal planner</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    logo: { fontSize: 40, fontWeight: '800', color: C.red, textAlign: 'center', marginBottom: 8 },
    tagline: { fontSize: 16, color: C.textMuted, textAlign: 'center', marginBottom: 48 },
    input: {
      backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 16,
      paddingVertical: 14, fontSize: 16, marginBottom: 12,
      borderWidth: 1, borderColor: C.border, color: C.text,
    },
    button: { backgroundColor: C.red, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  });
}
